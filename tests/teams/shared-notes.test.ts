import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTeamsService, type SharedNotesDeps } from '@/teams/service';
import { CONFIG, LIVE, memorySessions, respond } from './support';

const TEAM = '01J0000000000000000000000A';
const GONE = '01J0000000000000000000000B';
const NOTE = '01J0000000000000000000000N';

const me = {
  user: { id: '01J0000000000000000000000U', email: 'me@example.test', displayName: 'Me' },
  entitlement: { state: 'none', plan: null, until: null, limits: null, sources: [] },
  subscription: { state: 'none', canceled: false, pendingPayment: null },
  teams: [{ id: TEAM, name: 'Alpha', role: 'owner' }],
  serverTime: 1,
};

function setup(opts: { fetch?: ReturnType<typeof respond>; permitted?: boolean } = {}) {
  const sync = {
    syncTeam: vi.fn(async () => ({ rounds: 1, resynced: false, folders: [] })),
    forgetTeam: vi.fn(async () => {}),
    reconcile: vi.fn(async () => [GONE]),
    snapshot: vi.fn(async () => ({ notes: [], folders: [], syncedAt: 7 })),
  };
  const realtime = {
    follow: vi.fn(async () => {}),
    stop: vi.fn(),
    stopAll: vi.fn(),
    connected: () => [],
  };
  const shared: SharedNotesDeps = {
    sync: sync as never,
    realtime: realtime as never,
    writeIndex: vi.fn(async () => {}),
    clearCache: vi.fn(async () => {}),
    people: { refresh: vi.fn(async () => {}) },
    now: () => 99,
  };
  const sessions = memorySessions(LIVE);
  const fetch = opts.fetch ?? respond(200, me);
  const api = {
    me: vi.fn(async () => me),
    run: vi.fn(async () => ({ note: { id: NOTE } })),
    signOut: vi.fn(async () => {
      await sessions.clear();
    }),
    signInWithGoogle: vi.fn(),
    call: vi.fn(),
  };
  const service = createTeamsService({
    config: CONFIG,
    sessions,
    api: api as never,
    hasPermissions: async () => opts.permitted ?? true,
    auth: () => ({ redirectUri: '', launchWebAuthFlow: async () => '' }),
    shared,
  });
  void fetch;
  return { service, shared, sync, realtime, sessions, api };
}

/** Lets the fire-and-forget work the service starts settle. */
const settle = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

beforeEach(() => vi.clearAllMocks());

describe('keeping the team-note cache in step with the account', () => {
  it('records the teams, drops the ones it left, follows them, and pulls', async () => {
    const { service, shared, sync, realtime } = setup();
    const reply = await service.status();
    await settle();

    expect(reply.status).toEqual({ state: 'signed_in', me });
    expect(shared.writeIndex).toHaveBeenCalledWith([{ id: TEAM, name: 'Alpha' }], 99);
    expect(sync.reconcile).toHaveBeenCalledWith([TEAM]);
    expect(realtime.follow).toHaveBeenCalledWith([TEAM]);
    expect(sync.syncTeam).toHaveBeenCalledWith(TEAM);
  });

  it('gathers who is in the teams, and gathers again regardless once members change', async () => {
    const { service, shared } = setup();
    await service.status();
    await settle();
    expect(shared.people!.refresh).toHaveBeenLastCalledWith([TEAM], me.user.id, false);

    await service.accountChanged();
    await settle();
    expect(shared.people!.refresh).toHaveBeenLastCalledWith([TEAM], me.user.id, true);

    // Forced once, not from then on.
    await service.status();
    await settle();
    expect(shared.people!.refresh).toHaveBeenLastCalledWith([TEAM], me.user.id, false);
  });

  it('pulls once for a team, however many times it is asked at once', async () => {
    const { service, sync } = setup();
    let release = () => {};
    sync.syncTeam.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ rounds: 1, resynced: false, folders: [] });
        }) as never,
    );
    const asked = [service.changed(TEAM), service.changed(TEAM), service.changed(TEAM)];
    await settle();
    release();
    await Promise.all(asked);
    expect(sync.syncTeam).toHaveBeenCalledTimes(1);

    // And once that one has finished, the next ask is a new pull.
    sync.syncTeam.mockResolvedValue({ rounds: 1, resynced: false, folders: [] } as never);
    await service.changed(TEAM);
    expect(sync.syncTeam).toHaveBeenCalledTimes(2);
  });

  it('keeps going when a pull fails: a failed pull is retried, never reported as a page error', async () => {
    const { service, sync } = setup();
    sync.syncTeam.mockRejectedValue(new Error('offline'));
    await expect(service.changed(TEAM)).resolves.toBeUndefined();
  });

  it('pulls straight after a write, so the page sees the server’s version', async () => {
    const { service, sync } = setup();
    expect((await service.perform('notes.unshare', { teamId: TEAM, noteId: NOTE })).ok).toBe(true);
    await settle();
    expect(sync.syncTeam).toHaveBeenCalledWith(TEAM);

    sync.syncTeam.mockClear();
    await service.perform('notes.changes', { teamId: TEAM });
    await settle();
    expect(sync.syncTeam, 'reading changes is not a change').not.toHaveBeenCalled();
  });

  it('reads the cache for a page, and pulls first when asked to', async () => {
    const { service, sync } = setup();
    expect(await service.readCache('notes', TEAM)).toEqual({
      ok: true,
      data: { notes: [], folders: [], syncedAt: 7 },
    });
    expect(sync.syncTeam).not.toHaveBeenCalled();

    await service.readCache('sync', TEAM);
    expect(sync.syncTeam).toHaveBeenCalledWith(TEAM);
  });

  it('reads nothing from the cache without the Teams permissions', async () => {
    const { service, sync } = setup({ permitted: false });
    expect(await service.readCache('notes', TEAM)).toEqual({
      ok: false,
      error: 'permission_missing',
    });
    expect(sync.snapshot).not.toHaveBeenCalled();
  });

  it('leaves nothing of the team behind when the account signs out', async () => {
    const { service, shared, realtime, sessions } = setup();
    await service.signOut();
    expect(realtime.stopAll).toHaveBeenCalled();
    expect(shared.clearCache).toHaveBeenCalled();
    expect(sessions.current).toBeNull();
  });

  it('does the same when the server says this device is no longer signed in', async () => {
    const { service, shared, realtime, sessions } = setup();
    await service.revoked();
    expect(sessions.current).toBeNull();
    expect(realtime.stopAll).toHaveBeenCalled();
    expect(shared.clearCache).toHaveBeenCalled();
  });

  it('does the same when the user turns Teams off in the browser', async () => {
    const { service, shared, sessions } = setup({ permitted: false });
    await service.permissionsRemoved();
    expect(sessions.current).toBeNull();
    expect(shared.clearCache).toHaveBeenCalled();
  });

  it('keeps everything when a permission the user still has was merely re-checked', async () => {
    const { service, shared, sessions } = setup({ permitted: true });
    await service.permissionsRemoved();
    expect(sessions.current).not.toBeNull();
    expect(shared.clearCache).not.toHaveBeenCalled();
  });

  it('forgets the cache once a session the server refused is gone', async () => {
    const { service, shared, api, sessions } = setup();
    api.me.mockImplementation(async () => {
      // What a 401 does inside the API client: the session is dropped first.
      await sessions.clear();
      throw new Error('unauthenticated');
    });
    const reply = await service.status();
    expect(reply.status).toEqual({ state: 'signed_out' });
    expect(shared.clearCache).toHaveBeenCalled();
  });
});
