import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTeamsService, pullDelayMs, type SharedNotesDeps } from '@/teams/service';
import { CONFIG, LIVE, memorySessions } from './support';

const TEAM = '01J0000000000000000000000A';

/**
 * What a poke costs. The socket says "something changed, here is the sequence";
 * everything below is about asking the server once for it, and not twice.
 */

/** A promise the test resolves when it wants the pull to finish. */
function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

const outcome = (changed = true) => ({ rounds: 1, resynced: false, folders: [], changed });

function setup() {
  /** Each `syncTeam` call waits for the test to let it through. */
  const calls: { seq: number | undefined; settle: (v: unknown) => void }[] = [];
  const syncTeam = vi.fn((_teamId: string, seq?: number) => {
    const gate = deferred<unknown>();
    calls.push({ seq, settle: gate.settle });
    return gate.promise;
  });
  const waits: number[] = [];
  const shared: SharedNotesDeps = {
    sync: { syncTeam, forgetTeam: vi.fn(), reconcile: vi.fn(), snapshot: vi.fn() } as never,
    realtime: { follow: vi.fn(), stop: vi.fn(), stopAll: vi.fn(), connected: () => [] } as never,
    writeIndex: vi.fn(async () => {}),
    clearCache: vi.fn(async () => {}),
    notify: vi.fn(),
    now: () => 1,
    random: () => 0.5,
    wait: async (ms) => {
      waits.push(ms);
    },
  };
  const service = createTeamsService({
    config: CONFIG,
    sessions: memorySessions(LIVE),
    api: { run: vi.fn(async () => ({})) } as never,
    hasPermissions: async () => true,
    auth: () => ({ redirectUri: '', launchWebAuthFlow: async () => '' }),
    shared,
  });
  return { service, syncTeam, calls, waits, shared };
}

/** Lets the service's fire-and-forget work get as far as it can. */
const settle = async () => {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

beforeEach(() => vi.clearAllMocks());

describe('how long a poke waits before the pull', () => {
  it('is a spread of up to 400ms, so a team does not ask all at once', () => {
    expect(pullDelayMs(() => 0)).toBe(0);
    expect(pullDelayMs(() => 0.5)).toBe(200);
    expect(pullDelayMs(() => 0.999)).toBeLessThanOrEqual(400);
  });
});

describe('a poke that arrives while a pull is running', () => {
  it('is pulled for after it, instead of being swallowed', async () => {
    const { service, syncTeam, calls } = setup();

    void service.changed(TEAM, 5);
    await settle();
    expect(syncTeam).toHaveBeenCalledTimes(1);

    // Someone wrote while the pull was already reading: its change is not in
    // the answer on its way back.
    void service.changed(TEAM, 6);
    await settle();
    expect(syncTeam).toHaveBeenCalledTimes(1);

    calls[0].settle(outcome());
    await settle();

    expect(syncTeam).toHaveBeenCalledTimes(2);
    expect(calls[1].seq).toBe(6);
  });

  it('costs one pull after it, however many pokes arrived', async () => {
    const { service, syncTeam, calls } = setup();

    void service.changed(TEAM, 1);
    await settle();
    for (const seq of [2, 3, 4, 5]) void service.changed(TEAM, seq);
    await settle();
    expect(syncTeam).toHaveBeenCalledTimes(1);

    calls[0].settle(outcome());
    await settle();

    expect(syncTeam).toHaveBeenCalledTimes(2);
    // The newest sequence is the one worth asking for; the older ones are in it.
    expect(calls[1].seq).toBe(5);
  });

  it('forces a full pull when one of them said nothing about its sequence', async () => {
    const { service, syncTeam, calls } = setup();

    void service.changed(TEAM, 1);
    await settle();
    void service.changed(TEAM, 9);
    void service.changed(TEAM);
    await settle();
    calls[0].settle(outcome());
    await settle();

    expect(syncTeam).toHaveBeenCalledTimes(2);
    expect(calls[1].seq).toBeUndefined();
  });
});

describe('pokes that arrive while the pull is still waiting out its spread', () => {
  it('are answered by that same pull, which asks for the newest of them', async () => {
    const { service, syncTeam, calls, shared } = setup();
    const gate = deferred<void>();
    // Hold the pull in its waiting phase while more pokes land.
    (shared as { wait: (ms: number) => Promise<void> }).wait = () => gate.promise;

    void service.changed(TEAM, 5);
    void service.changed(TEAM, 6);
    void service.changed(TEAM, 7);
    await settle();
    expect(syncTeam).not.toHaveBeenCalled();

    gate.settle();
    await settle();

    expect(syncTeam).toHaveBeenCalledTimes(1);
    expect(calls[0].seq).toBe(7);
  });
});

describe('a pull the reader is waiting for', () => {
  it('does not wait out the spread, because someone is looking at the screen', async () => {
    const { service, waits, calls } = setup();

    const reading = service.readCache('sync', TEAM);
    await settle();
    expect(waits).toEqual([]);

    calls[0].settle(outcome());
    await reading;
  });
});
