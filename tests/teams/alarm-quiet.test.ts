import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ME_EVERY_MS, createTeamsService, type SharedNotesDeps } from '@/teams/service';
import { CONFIG, LIVE, memorySessions } from './support';

const ALPHA = '01J0000000000000000000000A';
const BETA = '01J0000000000000000000000B';

/**
 * What the five-minute timer costs.
 *
 * It exists for the device with no socket, which is the only device that can
 * miss a change. While every team this account is in holds a live one, waking
 * up has nothing to learn: asking "who am I" and then every team for its
 * changes is the request bill of a user who is doing nothing at all.
 */

const me = (teams: { id: string; changeSeq: number }[]) => ({
  user: { id: '01J0000000000000000000000U', email: 'me@example.test', displayName: 'Me' },
  entitlement: { state: 'none', plan: null, until: null, limits: null, sources: [] },
  subscription: { state: 'none', canceled: false, pendingPayment: null },
  teams: teams.map((t) => ({ id: t.id, name: t.id, role: 'owner', changeSeq: t.changeSeq })),
  serverTime: 1,
});

function setup(opts: { teams?: { id: string; changeSeq: number }[]; fail?: Set<string> } = {}) {
  const teams = opts.teams ?? [{ id: ALPHA, changeSeq: 7 }];
  const clock = { now: 1_000 };
  const live = { ids: teams.map((t) => t.id) };
  const syncTeam = vi.fn(async (teamId: string, _seq?: number) => {
    if (opts.fail?.has(teamId)) throw new Error('offline');
    return { rounds: 1, resynced: false, folders: [], changed: false };
  });
  const shared: SharedNotesDeps = {
    sync: {
      syncTeam,
      forgetTeam: vi.fn(),
      reconcile: vi.fn(async () => []),
      snapshot: vi.fn(),
    } as never,
    realtime: {
      follow: vi.fn(async () => {}),
      stop: vi.fn(),
      stopAll: vi.fn(),
      connected: () => [...live.ids],
    } as never,
    writeIndex: vi.fn(async () => {}),
    clearCache: vi.fn(async () => {}),
    notify: vi.fn(),
    now: () => clock.now,
    random: () => 0,
    wait: async () => {},
  };
  const api = { me: vi.fn(async () => me(teams)), run: vi.fn(async () => ({})) };
  const service = createTeamsService({
    config: CONFIG,
    sessions: memorySessions(LIVE),
    api: api as never,
    hasPermissions: async () => true,
    auth: () => ({ redirectUri: '', launchWebAuthFlow: async () => '' }),
    shared,
  });
  return { service, api, syncTeam, clock, live, shared };
}

/** Lets the fire-and-forget work the service starts settle. */
const settle = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

beforeEach(() => vi.clearAllMocks());

describe('the timer, when nothing can have been missed', () => {
  it('asks who I am the first time it wakes, whatever the sockets say', async () => {
    const { service, api } = setup();
    await service.tick();
    expect(api.me).toHaveBeenCalledTimes(1);
  });

  it('stops asking once every team it knows holds a socket', async () => {
    const { service, api } = setup({
      teams: [
        { id: ALPHA, changeSeq: 7 },
        { id: BETA, changeSeq: 2 },
      ],
    });
    await service.tick();
    await settle();

    await service.tick();
    await service.tick();
    expect(api.me).toHaveBeenCalledTimes(1);
  });

  it('asks again the moment a team is without one', async () => {
    const { service, api, live } = setup({
      teams: [
        { id: ALPHA, changeSeq: 7 },
        { id: BETA, changeSeq: 2 },
      ],
    });
    await service.tick();
    await settle();

    live.ids = [ALPHA];
    await service.tick();
    expect(api.me).toHaveBeenCalledTimes(2);
  });

  it('asks again after a couple of hours: a team joined elsewhere arrives on no socket', async () => {
    const { service, api, clock } = setup();
    await service.tick();
    await settle();

    clock.now += ME_EVERY_MS - 1;
    await service.tick();
    expect(api.me).toHaveBeenCalledTimes(1);

    clock.now += 1;
    await service.tick();
    expect(api.me).toHaveBeenCalledTimes(2);
  });

  it('still retries the team whose pull failed, and asks for no other', async () => {
    const { service, syncTeam, api } = setup({ fail: new Set([ALPHA]) });
    await service.tick();
    await settle();
    expect(syncTeam).toHaveBeenCalledTimes(1);

    await service.tick();
    await settle();
    // Quiet about "who am I", loud about the one pull that did not land.
    expect(api.me).toHaveBeenCalledTimes(1);
    expect(syncTeam).toHaveBeenCalledTimes(2);
    expect(syncTeam.mock.calls[1]![0]).toBe(ALPHA);
  });

  it('asks for nothing at all once that pull lands', async () => {
    const failing = new Set([ALPHA]);
    const { service, syncTeam, api } = setup({ fail: failing });
    await service.tick();
    await settle();

    failing.clear();
    await service.tick();
    await settle();
    expect(syncTeam).toHaveBeenCalledTimes(2);

    await service.tick();
    await settle();
    expect(api.me).toHaveBeenCalledTimes(1);
    expect(syncTeam).toHaveBeenCalledTimes(2);
  });
});

describe('what the answer to “who am I” now saves', () => {
  it('pulls each team for the counter that answer gave, so an unmoved team costs nothing', async () => {
    const { service, syncTeam } = setup({
      teams: [
        { id: ALPHA, changeSeq: 7 },
        { id: BETA, changeSeq: 0 },
      ],
    });
    await service.tick();
    await settle();

    expect(syncTeam.mock.calls).toEqual([
      [ALPHA, 7],
      [BETA, 0],
    ]);
  });
});
