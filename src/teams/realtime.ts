import {
  CLIENT_PING,
  CLOSE_REVOKED,
  ServerMessage,
  type RevokeReason,
} from '@hamesh/teams-contract';
import type { TeamsConfig } from './config';
import type { TeamsApi } from './api';

/**
 * The realtime link: one socket per team, carrying pokes only.
 *
 * A frame never contains note text, a name, an email or a URL — just "something
 * changed, here is the sequence". Everything is then read through the ordinary
 * authorized API (see ./sync.ts), so a socket that lingers for a moment after
 * someone's access ends cannot show them anything.
 *
 * The socket is a convenience, never the source of truth: the worker also pulls
 * on its own schedule, so a dropped connection (or a service worker the browser
 * shut down) delays an update rather than losing it.
 *
 * Runs only in the background service worker.
 */

/** Just enough of `WebSocket` to drive it, so tests can stand in for one. */
export interface SocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'open', fn: () => void): void;
  addEventListener(type: 'message', fn: (event: { data: unknown }) => void): void;
  addEventListener(type: 'close', fn: (event: { code: number }) => void): void;
  addEventListener(type: 'error', fn: () => void): void;
}

export interface RealtimeDeps {
  config: TeamsConfig;
  api: TeamsApi;
  open: (url: string) => SocketLike;
  /** Notes or folders changed in this team: pull the delta. */
  onChanged: (teamId: string) => void;
  /** Membership or roles changed: ask the server who this account is now. */
  onMembers: (teamId: string) => void;
  /** Comment activity on one note: tell whichever page is showing it. */
  onComments: (teamId: string, noteId: string) => void;
  /**
   * Access to this team ended. `expired` is an ordinary lease rotation and is
   * handled here (a fresh ticket, a new socket); every other reason is the
   * caller's to act on, and nothing reconnects until it says so.
   */
  onRevoked: (teamId: string, reason: RevokeReason) => void;
  setTimeout?: (fn: () => void, ms: number) => number;
  clearTimeout?: (handle: number) => void;
  now?: () => number;
  /** Jitter, injectable so a test gets exact delays. */
  random?: () => number;
}

/** Reconnection delay for attempt `n` (1-based), with jitter. */
export function backoffMs(attempt: number, random = Math.random): number {
  const base = Math.min(1000 * 2 ** Math.max(0, attempt - 1), 60_000);
  return Math.round(base * (0.75 + random() * 0.5));
}

/** A lease ending is expected every few minutes; it is not a failure. */
const RELEASE_DELAY_MS = 250;
const PING_MS = 45_000;
/**
 * How long a team is left alone after the server ended its authorization for a
 * reason that is not a lease rotation. Long enough not to hammer a team that is
 * locked or not entitled, short enough that access coming back is picked up
 * without waiting for the browser to restart the worker.
 */
const COOLOFF_MS = 10 * 60_000;

/**
 * The URL the server handed back, but only if it is this build's own API: the
 * right scheme for the configured origin, the same host, and an API path. The
 * server says where to connect; it does not get to say "somewhere else".
 */
export function checkedSocketUrl(url: string, apiOrigin: string): string | null {
  let parsed: URL;
  let api: URL;
  try {
    parsed = new URL(url);
    api = new URL(apiOrigin);
  } catch {
    return null;
  }
  if (parsed.protocol !== (api.protocol === 'https:' ? 'wss:' : 'ws:')) return null;
  if (parsed.host !== api.host) return null;
  if (!parsed.pathname.startsWith('/v1/') || parsed.pathname.includes('..')) return null;
  return parsed.toString();
}

interface Link {
  socket: SocketLike | null;
  /** Set while a ticket is being fetched or a socket is opening. */
  starting: boolean;
  attempt: number;
  reconnect: number | null;
  ping: number | null;
  /** When something other than a lease ending stopped this team; null if not. */
  stoppedAt: number | null;
  /**
   * Set when the server ended this connection's authorization lease, which it
   * does on a timer. The close that follows reconnects instead of standing down.
   */
  releasing: boolean;
}

export function createRealtime(deps: RealtimeDeps) {
  const later = deps.setTimeout ?? ((fn, ms) => setTimeout(fn, ms) as unknown as number);
  const cancel = deps.clearTimeout ?? ((handle) => clearTimeout(handle));
  const now = deps.now ?? Date.now;
  const links = new Map<string, Link>();

  const linkFor = (teamId: string): Link => {
    let link = links.get(teamId);
    if (!link) {
      link = {
        socket: null,
        starting: false,
        attempt: 0,
        reconnect: null,
        ping: null,
        stoppedAt: null,
        releasing: false,
      };
      links.set(teamId, link);
    }
    return link;
  };

  function clearTimers(link: Link): void {
    if (link.reconnect !== null) cancel(link.reconnect);
    if (link.ping !== null) cancel(link.ping);
    link.reconnect = null;
    link.ping = null;
  }

  function schedule(teamId: string, link: Link, delayMs: number): void {
    if (link.stoppedAt !== null || link.reconnect !== null) return;
    link.reconnect = later(() => {
      link.reconnect = null;
      void start(teamId);
    }, delayMs);
  }

  function keepPinging(teamId: string, link: Link): void {
    if (link.ping !== null) cancel(link.ping);
    link.ping = later(() => {
      link.ping = null;
      if (link.socket) {
        try {
          link.socket.send(CLIENT_PING);
        } catch {
          return; // the close handler will deal with it
        }
        keepPinging(teamId, link);
      }
    }, PING_MS);
  }

  function handle(teamId: string, link: Link, raw: unknown): void {
    if (typeof raw !== 'string') return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const message = ServerMessage.safeParse(parsed);
    // Anything that is not a frame this version knows is ignored, never guessed
    // at: the socket only ever says "pull", and pulling is always safe.
    if (!message.success) return;
    switch (message.data.t) {
      case 'hello':
      case 'changed':
        deps.onChanged(teamId);
        return;
      case 'members':
        deps.onMembers(teamId);
        return;
      case 'comments':
        deps.onComments(teamId, message.data.noteId);
        return;
      case 'revoked':
        if (message.data.reason === 'expired') {
          // The authorization lease ran out, which happens on a timer. The
          // close that follows this frame is what reconnects: scheduling it
          // here instead would be cancelled by that very close.
          link.attempt = 0;
          link.releasing = true;
        } else {
          link.stoppedAt = now();
          deps.onRevoked(teamId, message.data.reason);
        }
    }
  }

  async function start(teamId: string): Promise<void> {
    const link = linkFor(teamId);
    if (link.stoppedAt !== null || link.starting || link.socket) return;
    link.starting = true;
    let socket: SocketLike;
    try {
      const ticket = await deps.api.run('realtime.ticket', { teamId });
      const url = checkedSocketUrl(ticket.url, deps.config.apiOrigin);
      // A URL that is not this build's own API is not connected to, and not
      // retried either: nothing about waiting will make it ours.
      if (!url) {
        link.stoppedAt = now();
        return;
      }
      // Signing out (or losing access) while the ticket was in flight: there is
      // nothing to connect for any more, and an opened socket would be left
      // behind with nobody holding it.
      if (link.stoppedAt !== null || !links.has(teamId)) return;
      socket = deps.open(url);
    } catch {
      link.attempt += 1;
      schedule(teamId, link, backoffMs(link.attempt, deps.random));
      return;
    } finally {
      link.starting = false;
    }

    link.socket = socket;
    socket.addEventListener('open', () => {
      link.attempt = 0;
      keepPinging(teamId, link);
      // The socket says nothing about what was missed while it was down, so a
      // fresh connection always pulls once.
      deps.onChanged(teamId);
    });
    socket.addEventListener('message', (event) => handle(teamId, link, event.data));
    socket.addEventListener('error', () => {
      /* a close always follows; nothing to do here */
    });
    socket.addEventListener('close', (event) => {
      link.socket = null;
      clearTimers(link);
      if (link.stoppedAt !== null) return;
      // 4003 is the server ending this connection's authorization. It always
      // follows a `revoked` frame, which has already said which of the two this
      // is: a lease that ran out, or access that ended.
      if (event.code === CLOSE_REVOKED) {
        if (!link.releasing) return;
        link.releasing = false;
        schedule(teamId, link, RELEASE_DELAY_MS);
        return;
      }
      link.attempt += 1;
      schedule(teamId, link, backoffMs(link.attempt, deps.random));
    });
  }

  function stop(teamId: string): void {
    const link = links.get(teamId);
    if (!link) return;
    link.stoppedAt = now();
    clearTimers(link);
    link.socket?.close(1000, 'done');
    link.socket = null;
    links.delete(teamId);
  }

  return {
    /**
     * Opens (or keeps) a socket for each of these teams, and closes the rest. A
     * team the server cut off is left alone for a while and then tried again,
     * so access coming back does not wait for the browser to restart the worker.
     */
    async follow(teamIds: readonly string[]): Promise<void> {
      for (const teamId of [...links.keys()]) {
        if (!teamIds.includes(teamId)) stop(teamId);
      }
      for (const teamId of teamIds) {
        const link = links.get(teamId);
        if (link?.stoppedAt !== null && link?.stoppedAt !== undefined) {
          if (now() - link.stoppedAt >= COOLOFF_MS) link.stoppedAt = null;
        }
      }
      await Promise.all(teamIds.map((teamId) => start(teamId)));
    },
    stop,
    stopAll(): void {
      for (const teamId of [...links.keys()]) stop(teamId);
    },
    /** Which teams currently hold an open socket — for tests and diagnostics. */
    connected(): string[] {
      return [...links.entries()].filter(([, link]) => !!link.socket).map(([teamId]) => teamId);
    },
  };
}

export type Realtime = ReturnType<typeof createRealtime>;
