import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChangesResponse, TeamNote } from '@hamesh/teams-contract';
import { createTeamSync } from '@/teams/sync';
import { createSyncStore, type SyncStore, type TeamSyncState } from '@/teams/sync-store';
import type { CachedTeamNote } from '@/teams/page-cache';
import { TeamsError } from '@/teams/errors';

const TEAM = '01J0000000000000000000000A';
const OTHER_TEAM = '01J0000000000000000000000B';

const ANCHOR = {
  primarySelector: 'p',
  signals: { tagName: 'p' },
  fallbackDocumentPosition: { x: 0, y: 0 },
};

function note(id: string, url: string, overrides: Partial<TeamNote> = {}): TeamNote {
  return {
    id,
    folderId: null,
    authorId: '01J0000000000000000000000U',
    originalUrl: url,
    pageTitle: null,
    content: `note ${id}`,
    anchor: ANCHOR,
    version: 1,
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

const changes = (over: Partial<ChangesResponse> = {}): ChangesResponse => ({
  notes: [],
  folders: [],
  cursor: 'c1',
  hasMore: false,
  ...over,
});

/** A sync store held in memory, with the same parsing the real one does. */
function memoryStore(): SyncStore & { states: Map<string, TeamSyncState> } {
  const states = new Map<string, TeamSyncState>();
  return {
    states,
    get: async (teamId) =>
      structuredClone(states.get(teamId) ?? { cursor: null, pages: {}, folders: [], syncedAt: 0 }),
    set: async (teamId, state) => {
      states.set(teamId, structuredClone(state));
    },
    remove: async (teamId) => {
      states.delete(teamId);
    },
    teamIds: async () => [...states.keys()],
  };
}

/** The page buckets, in memory, keyed exactly as `page-cache` keys them. */
function setup(answers: (ChangesResponse | Error)[]) {
  const buckets = new Map<string, CachedTeamNote[]>();
  const queue = [...answers];
  const run = vi.fn(async (name: string, params: unknown) => {
    expect(name).toBe('notes.changes');
    void params;
    const next = queue.shift();
    if (!next) throw new Error('no answer left');
    if (next instanceof Error) throw next;
    return next;
  });
  const store = memoryStore();
  const sync = createTeamSync({
    api: { run } as never,
    store,
    readBucket: async (pageKey) => structuredClone(buckets.get(pageKey) ?? []),
    writeBucket: async (pageKey, notes) => {
      if (notes.length === 0) buckets.delete(pageKey);
      else buckets.set(pageKey, structuredClone(notes));
    },
    // Stand-in page key: the real one normalises a URL, which is not what is
    // being tested here.
    pageKeyOf: (url) => `key:${url}`,
    now: () => 1000,
  });
  return { sync, buckets, store, run };
}

beforeEach(() => vi.clearAllMocks());

describe('pulling a team’s changes', () => {
  it('files every note under the page it belongs to, and remembers where', async () => {
    const { sync, buckets, store } = setup([
      changes({
        notes: [note('n1', 'https://a.test/'), note('n2', 'https://b.test/')],
        folders: [{ id: 'f1', parentId: null, name: 'Reading', createdAt: 1, updatedAt: 1 }],
        cursor: 'c9',
      }),
    ]);

    const outcome = await sync.syncTeam(TEAM);

    expect(outcome).toEqual({ rounds: 1, resynced: false, folders: [expect.anything()] });
    expect([...buckets.keys()]).toEqual(['key:https://a.test/', 'key:https://b.test/']);
    expect(buckets.get('key:https://a.test/')![0]).toMatchObject({ id: 'n1', teamId: TEAM });
    const state = store.states.get(TEAM)!;
    expect(state.cursor).toBe('c9');
    expect(state.pages).toEqual({ n1: 'key:https://a.test/', n2: 'key:https://b.test/' });
    expect(state.folders[0].name).toBe('Reading');
    expect(state.syncedAt).toBe(1000);
  });

  it('keeps asking while there is more, sending the cursor it was last given', async () => {
    const { sync, run } = setup([
      changes({ notes: [note('n1', 'https://a.test/')], cursor: 'c1', hasMore: true }),
      changes({ notes: [note('n2', 'https://b.test/')], cursor: 'c2', hasMore: false }),
    ]);
    expect((await sync.syncTeam(TEAM)).rounds).toBe(2);
    expect(run.mock.calls[0]![1]).toEqual({ teamId: TEAM });
    expect(run.mock.calls[1]![1]).toEqual({ teamId: TEAM, since: 'c1' });
  });

  it('applies an edit, a move to another page, and a deletion', async () => {
    const { sync, buckets, store } = setup([
      changes({ notes: [note('n1', 'https://a.test/'), note('n2', 'https://a.test/')] }),
      changes({
        notes: [
          note('n1', 'https://moved.test/', { version: 2, content: 'now elsewhere' }),
          { id: 'n2', deleted: true },
        ],
        cursor: 'c2',
      }),
    ]);
    await sync.syncTeam(TEAM);
    await sync.syncTeam(TEAM);

    expect(buckets.get('key:https://a.test/'), 'the old page has nothing left').toBeUndefined();
    expect(buckets.get('key:https://moved.test/')![0]).toMatchObject({
      id: 'n1',
      version: 2,
      content: 'now elsewhere',
    });
    expect(store.states.get(TEAM)!.pages).toEqual({ n1: 'key:https://moved.test/' });
  });

  it('applying the same round twice changes nothing, which is what makes a repeat safe', async () => {
    const round = changes({ notes: [note('n1', 'https://a.test/')], cursor: 'c1' });
    const { sync, buckets } = setup([round, structuredClone(round)]);
    await sync.syncTeam(TEAM);
    const first = structuredClone(buckets.get('key:https://a.test/'));
    await sync.syncTeam(TEAM);
    expect(buckets.get('key:https://a.test/')).toEqual(first);
  });

  it('starts again from nothing when its cursor is too old to resume from', async () => {
    const { sync, buckets, store, run } = setup([
      changes({ notes: [note('n1', 'https://gone.test/')], cursor: 'old' }),
      new TeamsError('cursor_expired'),
      changes({ notes: [note('n2', 'https://fresh.test/')], cursor: 'new' }),
    ]);
    await sync.syncTeam(TEAM);
    const outcome = await sync.syncTeam(TEAM);

    expect(outcome.resynced).toBe(true);
    expect(buckets.get('key:https://gone.test/'), 'the stale copy goes').toBeUndefined();
    expect(buckets.get('key:https://fresh.test/')).toHaveLength(1);
    expect(store.states.get(TEAM)!.cursor).toBe('new');
    expect(run.mock.calls[2]![1], 'and the retry sends no cursor at all').toEqual({ teamId: TEAM });
  });

  it('lets anything else through to the caller, with the cache untouched', async () => {
    const { sync, buckets } = setup([new TeamsError('network')]);
    await expect(sync.syncTeam(TEAM)).rejects.toThrow(TeamsError);
    expect(buckets.size).toBe(0);
  });

  it('forgets one team’s notes without touching another’s on the same page', async () => {
    const { sync, buckets, store } = setup([
      changes({ notes: [note('n1', 'https://shared.test/')] }),
    ]);
    await sync.syncTeam(TEAM);
    // Another team's note on the same page, as the other team's own sync left it.
    buckets.get('key:https://shared.test/')!.push({
      id: 'other',
      teamId: OTHER_TEAM,
      originalUrl: 'https://shared.test/',
      pageTitle: null,
      content: 'theirs',
      anchor: ANCHOR,
      folderId: null,
      authorId: null,
      version: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    await sync.forgetTeam(TEAM);

    expect(buckets.get('key:https://shared.test/')).toEqual([
      expect.objectContaining({ id: 'other' }),
    ]);
    expect(store.states.has(TEAM)).toBe(false);
  });

  it('drops the cache of a team the account is no longer in', async () => {
    const { sync, buckets, store } = setup([
      changes({ notes: [note('n1', 'https://a.test/')] }),
      changes({ notes: [note('n2', 'https://b.test/')] }),
    ]);
    await sync.syncTeam(TEAM);
    await sync.syncTeam(OTHER_TEAM);

    expect(await sync.reconcile([TEAM])).toEqual([OTHER_TEAM]);
    expect(store.states.has(OTHER_TEAM)).toBe(false);
    expect(buckets.get('key:https://b.test/')).toBeUndefined();
    expect(buckets.get('key:https://a.test/')).toHaveLength(1);
  });

  it('gathers a team’s notes back out of the pages they were filed under', async () => {
    const { sync } = setup([
      changes({
        notes: [
          note('n1', 'https://a.test/', { updatedAt: 10 }),
          note('n2', 'https://b.test/', { updatedAt: 30 }),
          note('n3', 'https://a.test/', { updatedAt: 20 }),
        ],
        folders: [{ id: 'f1', parentId: null, name: 'Reading', createdAt: 1, updatedAt: 1 }],
      }),
    ]);
    await sync.syncTeam(TEAM);

    const snapshot = await sync.snapshot(TEAM);
    expect(
      snapshot.notes.map((n) => n.id),
      'newest first',
    ).toEqual(['n2', 'n3', 'n1']);
    expect(snapshot.folders.map((f) => f.name)).toEqual(['Reading']);
    expect(snapshot.syncedAt).toBe(1000);
  });

  it('stops after a bounded number of rounds, however long the server says there is more', async () => {
    const endless = Array.from({ length: 200 }, () =>
      changes({ notes: [], cursor: 'c', hasMore: true }),
    );
    const { sync } = setup(endless);
    expect((await sync.syncTeam(TEAM)).rounds).toBe(100);
  });
});

describe('the sync bookkeeping', () => {
  it('treats state it cannot parse as none, which costs one resync and no wrong answers', async () => {
    const kv = new Map<string, unknown>();
    const store = createSyncStore({
      kv: {
        get: async (key) => kv.get(key),
        put: async (key, value) => void kv.set(key, value),
        del: async (key) => void kv.delete(key),
        keys: async () => [...kv.keys()].filter((k): k is string => typeof k === 'string'),
      },
    });
    kv.set(`sync:${TEAM}`, { cursor: 42, pages: { n1: 7 }, folders: [{ id: 'f' }] });
    expect(await store.get(TEAM)).toEqual({ cursor: null, pages: {}, folders: [], syncedAt: 0 });

    await store.set(TEAM, { cursor: 'c', pages: { n1: 'p' }, folders: [], syncedAt: 3 });
    expect(await store.teamIds()).toEqual([TEAM]);
    await store.remove(TEAM);
    expect(await store.teamIds()).toEqual([]);
  });
});
