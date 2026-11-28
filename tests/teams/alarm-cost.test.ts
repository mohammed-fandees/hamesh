import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTeamsService, type SharedNotesDeps } from '@/teams/service';
import { CONFIG, LIVE, memorySessions } from './support';

const ALPHA = '01J0000000000000000000000A';
const BETA = '01J0000000000000000000000B';

/**
 * What the five-minute timer costs, and what it must still pay for.
 *
 * Asking every team for its changes on every wake was the bill of a user doing
 * nothing at all: measured at 132 requests an hour for a user in three teams.
 * The counter each team comes with in the answer to "who am I" is what removes
 * it — and that answer is the part the timer may never skip, because a team
 * joined on another device, an entitlement that ran out or a seat taken away
 * reach this device on no socket.
 */

const me = (teams: { id: string; changeSeq: number }[]) => ({
  user: { id: '01J0000000000000000000000U', email: 'me@example.test', displayName: 'Me' },
  entitlement: { state: 'none', plan: null, until: null, limits: null, sources: [] },
  subscription: { state: 'none', canceled: false, pendingPayment: null },
  teams: teams.map((t) => ({ id: t.id, name: t.id, role: 'owner', changeSeq: t.changeSeq })),
  serverTime: 1,
});

function setup(initial: { id: string; changeSeq: number }[] = [{ id: ALPHA, changeSeq: 7 }]) {
  const account = { teams: initial };
  const syncTeam = vi.fn(async (_teamId: string, _seq?: number) => ({
    rounds: 1,
    resynced: false,
    folders: [],
    changed: false,
  }));
  const follow = vi.fn(async () => {});
  const shared: SharedNotesDeps = {
    sync: {
      syncTeam,
      forgetTeam: vi.fn(),
      reconcile: vi.fn(async () => []),
      snapshot: vi.fn(),
    } as never,
    realtime: {
      follow,
      stop: vi.fn(),
      stopAll: vi.fn(),
      connected: () => account.teams.map((t) => t.id),
    } as never,
    writeIndex: vi.fn(async () => {}),
    clearCache: vi.fn(async () => {}),
    notify: vi.fn(),
    now: () => 1,
    random: () => 0,
    wait: async () => {},
  };
  const api = { me: vi.fn(async () => me(account.teams)), run: vi.fn(async () => ({})) };
  const service = createTeamsService({
    config: CONFIG,
    sessions: memorySessions(LIVE),
    api: api as never,
    hasPermissions: async () => true,
    auth: () => ({ redirectUri: '', launchWebAuthFlow: async () => '' }),
    shared,
  });
  return { service, api, syncTeam, follow, account };
}

/** Lets the fire-and-forget work the service starts settle. */
const settle = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

beforeEach(() => vi.clearAllMocks());

describe('what the timer asks for', () => {
  it('pulls each team for the counter that answer gave, so an unmoved team costs nothing', async () => {
    const { service, syncTeam } = setup([
      { id: ALPHA, changeSeq: 7 },
      { id: BETA, changeSeq: 0 },
    ]);
    await service.tick();
    await settle();

    expect(syncTeam.mock.calls).toEqual([
      [ALPHA, 7],
      [BETA, 0],
    ]);
  });

  it('asks who I am on every wake, however healthy the sockets are', async () => {
    // The saving is in what follows the answer, never in skipping it: a device
    // that stopped asking could not be told it had been added to a team.
    const { service, api } = setup();
    await service.tick();
    await settle();
    await service.tick();
    await settle();
    await service.tick();
    expect(api.me).toHaveBeenCalledTimes(3);
  });

  it('notices a team this account was added to somewhere else, and follows it', async () => {
    const { service, api, follow, account, syncTeam } = setup();
    await service.tick();
    await settle();

    account.teams = [
      { id: ALPHA, changeSeq: 7 },
      { id: BETA, changeSeq: 4 },
    ];
    await service.tick();
    await settle();

    expect(api.me).toHaveBeenCalledTimes(2);
    expect(follow).toHaveBeenLastCalledWith([ALPHA, BETA]);
    expect(syncTeam).toHaveBeenLastCalledWith(BETA, 4);
  });
});
