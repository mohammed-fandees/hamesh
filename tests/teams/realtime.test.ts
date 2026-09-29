import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CLOSE_REVOKED } from '@hamesh/teams-contract';
import { backoffMs, checkedSocketUrl, createRealtime, type SocketLike } from '@/teams/realtime';
import { CONFIG } from './support';

const TEAM = '01J0000000000000000000000A';
const OTHER = '01J0000000000000000000000B';
const NOTE = '01J0000000000000000000000N';

/** A socket a test drives by hand. */
class FakeSocket implements SocketLike {
  sent: string[] = [];
  closed: number | null = null;
  private readonly handlers = new Map<string, ((event: unknown) => void)[]>();

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(data);
  }
  close(code?: number): void {
    this.closed = code ?? 1000;
  }
  addEventListener(type: string, fn: (event: never) => void): void {
    const list = this.handlers.get(type) ?? [];
    list.push(fn as (event: unknown) => void);
    this.handlers.set(type, list);
  }
  emit(type: string, event?: unknown): void {
    for (const fn of this.handlers.get(type) ?? []) fn(event);
  }
  frame(message: unknown): void {
    this.emit('message', { data: JSON.stringify(message) });
  }
}

function setup(opts: { url?: string; failTicket?: boolean } = {}) {
  const sockets: FakeSocket[] = [];
  /** Scheduled work, and cancelling it — the link cancels its own timers. */
  const scheduled = new Map<number, { fn: () => void; ms: number }>();
  let nextHandle = 1;
  const onChanged = vi.fn();
  const onMembers = vi.fn();
  const onRevoked = vi.fn();
  const run = vi.fn(async (name: string) => {
    expect(name).toBe('realtime.ticket');
    if (opts.failTicket) throw new Error('nope');
    return {
      ticket: 't',
      url: opts.url ?? `wss://api.example.com/v1/realtime?ticket=t`,
      expiresAt: 1,
    };
  });
  const realtime = createRealtime({
    config: CONFIG,
    api: { run } as never,
    open: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    onChanged,
    onMembers,
    onRevoked,
    setTimeout: (fn, ms) => {
      const handle = nextHandle++;
      scheduled.set(handle, { fn, ms });
      return handle;
    },
    clearTimeout: (handle) => void scheduled.delete(handle),
    now: () => 0,
    random: () => 0.5,
  });
  /** Runs whatever was scheduled, as the browser eventually would. */
  const tick = async () => {
    const due = [...scheduled.values()];
    scheduled.clear();
    for (const timer of due) timer.fn();
    await Promise.resolve();
    await Promise.resolve();
  };
  const timers = () => [...scheduled.values()];
  return { realtime, sockets, timers, tick, onChanged, onMembers, onRevoked, run };
}

beforeEach(() => vi.clearAllMocks());

describe('the URL the server hands back', () => {
  it('is connected to only when it is this build’s own API', () => {
    expect(checkedSocketUrl('wss://api.example.com/v1/realtime?ticket=t', CONFIG.apiOrigin)).toBe(
      'wss://api.example.com/v1/realtime?ticket=t',
    );
    for (const url of [
      'wss://evil.example.com/v1/realtime?ticket=t',
      'ws://api.example.com/v1/realtime?ticket=t',
      'https://api.example.com/v1/realtime?ticket=t',
      'wss://api.example.com/socket',
      'wss://api.example.com/v1/../socket',
      'wss://api.example.com:8443/v1/realtime',
      'not a url',
    ]) {
      expect(checkedSocketUrl(url, CONFIG.apiOrigin), url).toBeNull();
    }
  });

  it('is ws:// for a local server, and only for one', () => {
    expect(checkedSocketUrl('ws://localhost:8787/v1/realtime', 'http://localhost:8787')).toBe(
      'ws://localhost:8787/v1/realtime',
    );
    expect(
      checkedSocketUrl('wss://localhost:8787/v1/realtime', 'http://localhost:8787'),
    ).toBeNull();
  });
});

describe('reconnection delay', () => {
  it('grows, and stops growing', () => {
    const exact = (attempt: number) => backoffMs(attempt, () => 0.5);
    expect(exact(1)).toBe(1000);
    expect(exact(2)).toBe(2000);
    expect(exact(5)).toBe(16_000);
    expect(exact(20)).toBe(60_000);
    // Jitter stays inside a quarter either side, so a crowd does not return at once.
    expect(backoffMs(3, () => 0)).toBe(3000);
    expect(backoffMs(3, () => 1)).toBe(5000);
  });
});

describe('the realtime link', () => {
  it('pulls on connect, and again whenever the server says something changed', async () => {
    const { realtime, sockets, onChanged, onMembers } = setup();
    await realtime.follow([TEAM]);
    sockets[0].emit('open');
    expect(onChanged).toHaveBeenCalledWith(TEAM);

    sockets[0].frame({ t: 'changed', seq: 7 });
    sockets[0].frame({ t: 'hello', teamId: TEAM, seq: 7 });
    expect(onChanged).toHaveBeenCalledTimes(3);

    sockets[0].frame({ t: 'members' });
    expect(onMembers).toHaveBeenCalledWith(TEAM);
  });

  it('ignores a frame it cannot recognise instead of guessing at it', async () => {
    const { realtime, sockets, onChanged, onMembers, onRevoked } = setup();
    await realtime.follow([TEAM]);
    sockets[0].emit('open');
    onChanged.mockClear();

    sockets[0].emit('message', { data: 'not json' });
    sockets[0].emit('message', { data: new ArrayBuffer(4) });
    sockets[0].frame({ t: 'changed' });
    sockets[0].frame({ t: 'changed', seq: 1, extra: true });
    sockets[0].frame({ t: 'nonsense' });
    sockets[0].frame({ t: 'revoked', reason: 'because' });
    sockets[0].frame({ t: 'comments', noteId: NOTE });

    expect(onChanged).not.toHaveBeenCalled();
    expect(onMembers).not.toHaveBeenCalled();
    expect(onRevoked).not.toHaveBeenCalled();
  });

  it('takes a lease running out as a reconnection, not as a refusal', async () => {
    const { realtime, sockets, tick, onRevoked } = setup();
    await realtime.follow([TEAM]);
    sockets[0].emit('open');

    sockets[0].frame({ t: 'revoked', reason: 'expired' });
    sockets[0].emit('close', { code: CLOSE_REVOKED });
    expect(onRevoked, 'nothing for the caller to act on').not.toHaveBeenCalled();

    await tick();
    expect(sockets, 'a fresh ticket, and a new socket').toHaveLength(2);
  });

  it('stops and reports when access itself ended, and does not come back on its own', async () => {
    const { realtime, sockets, tick, onRevoked } = setup();
    await realtime.follow([TEAM]);
    sockets[0].emit('open');

    sockets[0].frame({ t: 'revoked', reason: 'removed' });
    expect(onRevoked).toHaveBeenCalledWith(TEAM, 'removed');
    sockets[0].emit('close', { code: CLOSE_REVOKED });
    await tick();
    await realtime.follow([TEAM]);

    expect(sockets).toHaveLength(1);
  });

  it('backs off after an ordinary close, and after a ticket it could not get', async () => {
    const { realtime, sockets, timers, tick } = setup();
    await realtime.follow([TEAM]);
    sockets[0].emit('open');
    sockets[0].emit('close', { code: 1006 });
    expect(
      timers().map((t) => t.ms),
      'the keep-alive is cancelled with it',
    ).toEqual([1000]);
    await tick();
    expect(sockets).toHaveLength(2);

    const failing = setup({ failTicket: true });
    await failing.realtime.follow([TEAM]);
    expect(failing.sockets).toHaveLength(0);
    expect(failing.timers()[0].ms).toBe(1000);
  });

  it('never connects to a URL that is not this build’s API, and does not retry it', async () => {
    const { realtime, sockets, timers } = setup({ url: 'wss://evil.example.com/v1/realtime' });
    await realtime.follow([TEAM]);
    expect(sockets).toHaveLength(0);
    expect(timers()).toHaveLength(0);
  });

  it('holds one socket per team, and closes the ones it is no longer asked to hold', async () => {
    const { realtime, sockets } = setup();
    await realtime.follow([TEAM, OTHER]);
    for (const socket of sockets) socket.emit('open');
    expect(realtime.connected().sort()).toEqual([TEAM, OTHER].sort());

    await realtime.follow([TEAM]);
    expect(sockets[1].closed).toBe(1000);
    expect(realtime.connected()).toEqual([TEAM]);

    // Asking again while it is already connected does not open a second one.
    await realtime.follow([TEAM]);
    expect(sockets).toHaveLength(2);
  });

  it('keeps the connection warm with the one frame a client may send', async () => {
    const { realtime, sockets, tick } = setup();
    await realtime.follow([TEAM]);
    sockets[0].emit('open');
    await tick();
    expect(sockets[0].sent).toEqual(['ping']);
  });

  it('opens nothing for a team it was told to drop while the ticket was in flight', async () => {
    const { realtime, sockets } = setup();
    const following = realtime.follow([TEAM]);
    realtime.stopAll();
    await following;
    expect(sockets).toHaveLength(0);
  });

  it('closes everything when the account signs out', async () => {
    const { realtime, sockets } = setup();
    await realtime.follow([TEAM, OTHER]);
    for (const socket of sockets) socket.emit('open');
    realtime.stopAll();
    expect(sockets.every((s) => s.closed === 1000)).toBe(true);
    expect(realtime.connected()).toEqual([]);
  });
});
