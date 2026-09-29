import type { MeResponse } from '@hamesh/teams-contract';
import type { TeamsConfig } from './config';
import type { SessionStore } from './session-store';
import type { TeamsApi } from './api';
import { authorizeWithGoogle, type GoogleAuthDeps } from './google-auth';
import { TeamsError, codeOf } from './errors';
import type {
  ResultFor,
  TeamCacheResult,
  TeamsCacheOp,
  TeamsOp,
  TeamsReply,
  TeamsStatus,
} from './messages';
import type { TeamsOpName } from './operation-names';
import type { ParamsOf } from './operations';
import type { CachedTeam } from './page-cache';
import type { TeamSync } from './sync';
import type { Realtime } from './realtime';

/**
 * What the background service worker does for Teams, independent of the
 * browser APIs it is wired to (see ./background.ts), so it can be tested as
 * plain code.
 */
export interface TeamsServiceDeps {
  config: TeamsConfig | null;
  sessions: SessionStore;
  api: TeamsApi | null;
  /** Whether the user has granted the Teams permissions right now. */
  hasPermissions: () => Promise<boolean>;
  /** Read at sign-in time: `identity` only exists once the permission is granted. */
  auth: () => Omit<GoogleAuthDeps, 'config'>;
  /** The team-note cache and its links. Absent leaves the service exactly as it was. */
  shared?: SharedNotesDeps | null;
}

/**
 * Keeping the team-note cache in step with the account, in one place: what
 * `/v1/me` said is what the cache holds, so a team the server no longer lists is
 * a team whose notes leave this device.
 */
export interface SharedNotesDeps {
  sync: TeamSync;
  realtime: Realtime;
  /** The team names the content script reads to label a shared note. */
  writeIndex: (teams: CachedTeam[], now: number) => Promise<void>;
  /** Forgets every cached team note on this device. */
  clearCache: () => Promise<void>;
  now: () => number;
}

/** The operations that leave a team's notes or folders different from before. */
const CHANGES_TEAM_NOTES = new Set<TeamsOpName>([
  'notes.share',
  'notes.update',
  'notes.delete',
  'notes.unshare',
  'folders.create',
  'folders.rename',
  'folders.delete',
]);

export function createTeamsService(deps: TeamsServiceDeps) {
  let signingIn: Promise<TeamsReply> | null = null;
  /** One pull per team at a time; a second ask joins the one already running. */
  const pulling = new Map<string, Promise<void>>();

  /** Pulls one team's changes, reporting nothing: a failed pull is retried later. */
  function pull(teamId: string): Promise<void> {
    const shared = deps.shared;
    if (!shared) return Promise.resolve();
    let running = pulling.get(teamId);
    if (!running) {
      running = shared.sync
        .syncTeam(teamId)
        .then(
          () => {},
          () => {},
        )
        .finally(() => pulling.delete(teamId));
      pulling.set(teamId, running);
    }
    return running;
  }

  /**
   * Everything that follows from a fresh answer to "who am I": the team names a
   * page shows, the caches that should no longer exist, the sockets to hold, and
   * a pull for each team. Only the index write is awaited — a page must not wait
   * on the network to be drawn.
   */
  async function reconcile(me: MeResponse): Promise<void> {
    const shared = deps.shared;
    if (!shared) return;
    const teams = me.teams.map((team) => ({ id: team.id, name: team.name }));
    await shared.writeIndex(teams, shared.now());
    const ids = teams.map((team) => team.id);
    void shared.sync.reconcile(ids).catch(() => {});
    void shared.realtime.follow(ids).catch(() => {});
    for (const id of ids) void pull(id);
  }

  /** Signed out, or Teams turned off: nothing of the team's stays behind. */
  async function forgetEverything(): Promise<void> {
    const shared = deps.shared;
    if (!shared) return;
    shared.realtime.stopAll();
    await shared.clearCache().catch(() => {});
  }

  async function status(): Promise<TeamsReply> {
    if (!deps.config || !deps.api) return { status: { state: 'unavailable' } };
    if (!(await deps.hasPermissions())) return { status: { state: 'permission_needed' } };
    if (!(await deps.sessions.get())) return { status: { state: 'signed_out' } };
    try {
      const me = await deps.api.me();
      await reconcile(me);
      return { status: { state: 'signed_in', me } };
    } catch (err) {
      // A 401 has already dropped the session; report whatever is true now.
      const signedIn = !!(await deps.sessions.get());
      if (!signedIn) await forgetEverything();
      const now: TeamsStatus = signedIn
        ? { state: 'signed_in', me: null }
        : { state: 'signed_out' };
      return { status: now, error: codeOf(err) };
    }
  }

  async function signIn(): Promise<TeamsReply> {
    const config = deps.config;
    const api = deps.api;
    if (!config || !api) return { status: { state: 'unavailable' }, error: 'not_configured' };
    if (!(await deps.hasPermissions())) {
      return { status: { state: 'permission_needed' }, error: 'permission_missing' };
    }
    try {
      const request = await authorizeWithGoogle({ ...deps.auth(), config });
      await api.signInWithGoogle(request);
    } catch (err) {
      return { ...(await status()), error: codeOf(err) };
    }
    return status();
  }

  async function signOut(): Promise<TeamsReply> {
    if (deps.api) await deps.api.signOut();
    else await deps.sessions.clear();
    await forgetEverything();
    return status();
  }

  /** One Google window at a time: a second click joins the first attempt. */
  function signInOnce(): Promise<TeamsReply> {
    signingIn ??= signIn().finally(() => {
      signingIn = null;
    });
    return signingIn;
  }

  /**
   * Performs one listed operation for a page. Whatever the page sent is checked
   * against that operation's own schema before anything is sent (in `api.run`,
   * the one place a request is built), so the worker — which holds the session —
   * only ever asks the server for what the contract allows.
   */
  async function perform<K extends TeamsOpName>(name: K, params: unknown): Promise<ResultFor<K>> {
    if (!deps.api) return { ok: false, error: 'not_configured' };
    if (!(await deps.hasPermissions())) return { ok: false, error: 'permission_missing' };
    try {
      const data = await deps.api.run(name, params as ParamsOf<K>);
      // A write that changed a team's notes or folders is pulled back at once,
      // so the page that made it sees the server's version rather than its own
      // idea of what it should now be.
      if (deps.shared && CHANGES_TEAM_NOTES.has(name)) {
        void pull((params as { teamId: string }).teamId);
      }
      return { ok: true, data };
    } catch (err) {
      const fields = err instanceof TeamsError ? err.fields : undefined;
      return { ok: false, error: codeOf(err), ...(fields ? { fields } : {}) };
    }
  }

  /** A local read of the team-note cache for one of Hamesh's own pages. */
  async function readCache(op: TeamsCacheOp, teamId: string): Promise<TeamCacheResult> {
    const shared = deps.shared;
    if (!shared) return { ok: false, error: 'not_configured' };
    if (!(await deps.hasPermissions())) return { ok: false, error: 'permission_missing' };
    if (op === 'sync') await pull(teamId);
    try {
      return { ok: true, data: await shared.sync.snapshot(teamId) };
    } catch {
      return { ok: false, error: 'internal' };
    }
  }

  return {
    status,
    perform,
    readCache,
    signIn: signInOnce,
    signOut,
    /**
     * Something changed in a team, as its socket just said. The socket carries
     * no content, so this is where the change is actually read.
     */
    changed(teamId: string): Promise<void> {
      return pull(teamId);
    },
    /**
     * A team's membership changed, or its access ended for a reason of its own.
     * Either way the server is asked who this account is now, and the cache
     * follows that answer.
     */
    async accountChanged(): Promise<void> {
      await status().catch(() => undefined);
    },
    /**
     * The server says this device is signed out. Nothing local is kept: the
     * session goes, and so does every cached team note.
     */
    async revoked(): Promise<void> {
      await deps.sessions.clear();
      await forgetEverything();
    },
    /** The worker woke up on its timer: catch up on whatever was missed. */
    tick(): Promise<void> {
      return status().then(
        () => {},
        () => {},
      );
    },
    /**
     * Some permission was removed. If Teams can no longer run, the user turned
     * it off: forget the session on this device too, and everything it cached.
     */
    async permissionsRemoved(): Promise<void> {
      if (await deps.hasPermissions()) return;
      await deps.sessions.clear();
      await forgetEverything();
    },
    handle(op: TeamsOp): Promise<TeamsReply> {
      switch (op) {
        case 'status':
          return status();
        case 'signIn':
          return signInOnce();
        case 'signOut':
          return signOut();
      }
    },
  };
}

export type TeamsService = ReturnType<typeof createTeamsService>;
