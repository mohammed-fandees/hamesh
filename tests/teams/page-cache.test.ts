import { describe, it, expect, beforeEach } from 'vitest';
import { fakeStorage, resetStorage, store } from './fake-storage';
import {
  clearAllPages,
  parseCachedNotes,
  parseTeamIndex,
  readPageBucket,
  readPageNotes,
  readTeamIndex,
  watchPageNotes,
  writePageBucket,
  writeTeamIndex,
  type CachedTeamNote,
} from '@/teams/page-cache';

const TEAM = '01J0000000000000000000000A';
const PAGE = 'https://example.test/page';

function cached(overrides: Partial<CachedTeamNote> = {}): CachedTeamNote {
  return {
    id: '01J0000000000000000000000N',
    teamId: TEAM,
    originalUrl: PAGE,
    pageTitle: 'A page',
    content: 'A shared thought',
    anchor: {
      primarySelector: 'p',
      signals: { tagName: 'p' },
      fallbackDocumentPosition: { x: 1, y: 2 },
    },
    folderId: null,
    authorId: '01J0000000000000000000000U',
    version: 3,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_100_000,
    ...overrides,
  };
}

beforeEach(resetStorage);

describe('the team-note cache the content script reads', () => {
  it('drops a stored entry it cannot make sense of, rather than trusting it', () => {
    expect(parseCachedNotes('not an array')).toEqual([]);
    expect(
      parseCachedNotes([
        cached(),
        null,
        { ...cached(), id: 42 },
        { ...cached(), anchor: { nothing: true } },
        { ...cached(), version: 'three' },
      ]),
    ).toHaveLength(1);
  });

  it('reads a note back as a note, marked with the team it lives in', async () => {
    await writeTeamIndex([{ id: TEAM, name: 'Alpha' }], 5);
    await writePageBucket(PAGE, [cached()]);

    const [note] = await readPageNotes(PAGE);
    expect(note.content).toBe('A shared thought');
    expect(note.pageKey).toBe(PAGE);
    expect(note.pageContext).toEqual({ title: 'A page' });
    expect(note.team).toEqual({
      id: TEAM,
      name: 'Alpha',
      version: 3,
      authorId: '01J0000000000000000000000U',
      folderId: null,
    });
    // Server milliseconds become the ISO strings every other note carries.
    expect(note.updatedAt).toBe(new Date(1_700_000_100_000).toISOString());
    expect(note.pinned, 'a team note is nothing this device pinned').toBeUndefined();
  });

  it('does not draw a note whose team this account is no longer in', async () => {
    await writeTeamIndex([], 5);
    await writePageBucket(PAGE, [cached()]);
    expect(await readPageNotes(PAGE)).toEqual([]);
  });

  it('removes a page’s shelf entirely once nothing is left on it', async () => {
    await writePageBucket(PAGE, [cached()]);
    expect(store.has(`local:hamesh:team-notes:${PAGE}`)).toBe(true);
    await writePageBucket(PAGE, []);
    expect(store.has(`local:hamesh:team-notes:${PAGE}`)).toBe(false);
    expect(await readPageBucket(PAGE)).toEqual([]);
  });

  it('tells the page it is drawn on when the worker writes to it', async () => {
    const seen: number[] = [];
    const unwatch = watchPageNotes(PAGE, () => seen.push(1));
    await writePageBucket(PAGE, [cached()]);
    expect(seen).toHaveLength(1);
    unwatch();
    await writePageBucket(PAGE, []);
    expect(seen, 'and stops when the page goes').toHaveLength(1);
  });

  it('forgets every team note on this device, and leaves personal notes alone', async () => {
    store.set('local:hamesh:notes:https://example.test/page', [{ id: 'mine' }]);
    await writeTeamIndex([{ id: TEAM, name: 'Alpha' }], 5);
    await writePageBucket(PAGE, [cached()]);
    await writePageBucket('https://other.test/', [cached({ originalUrl: 'https://other.test/' })]);

    await clearAllPages();

    expect(await readPageNotes(PAGE)).toEqual([]);
    expect(await readTeamIndex()).toEqual({ teams: [], syncedAt: 0 });
    expect(store.get('local:hamesh:notes:https://example.test/page')).toEqual([{ id: 'mine' }]);
  });

  it('does not rewrite a team list that has not changed', async () => {
    const teams = [{ id: TEAM, name: 'Alpha' }];
    await writeTeamIndex(teams, 5);
    fakeStorage.setItem.mockClear();

    await writeTeamIndex([{ id: TEAM, name: 'Alpha' }], 6);
    expect(fakeStorage.setItem, 'every open tab would redraw for nothing').not.toHaveBeenCalled();

    await writeTeamIndex([{ id: TEAM, name: 'Renamed' }], 7);
    expect(fakeStorage.setItem).toHaveBeenCalledTimes(1);
    expect((await readTeamIndex()).teams).toEqual([{ id: TEAM, name: 'Renamed' }]);
  });

  it('treats an index it cannot parse as no teams at all', () => {
    expect(parseTeamIndex(null)).toEqual({ teams: [], syncedAt: 0 });
    expect(
      parseTeamIndex({ teams: [{ id: 1 }, { id: 'x', name: 'X' }], syncedAt: 'soon' }),
    ).toEqual({
      teams: [{ id: 'x', name: 'X' }],
      syncedAt: 0,
    });
  });
});
