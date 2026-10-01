import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetStorage, store } from './fake-storage';
import {
  MAX_PEOPLE,
  clearPeople,
  parsePeople,
  readPeople,
  watchPeople,
  writePeople,
  type PeopleDirectory,
} from '@/teams/people-cache';
import { MAX_PHOTO_BYTES, PEOPLE_TTL, createPeople, fetchPhoto, photoSource } from '@/teams/people';

const ALPHA = '01J0000000000000000000000A';
const BETA = '01J0000000000000000000000B';
const SARA = '01J0000000000000000000000S';
const OMAR = '01J0000000000000000000000O';
const ME = '01J0000000000000000000000M';
const PICTURE = 'https://lh3.googleusercontent.com/a/sara=s96-c';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const PNG_URL = 'data:image/png;base64,iVBORw==';

function image(bytes: Uint8Array<ArrayBuffer> = PNG, type = 'image/png', status = 200): Response {
  return new Response(bytes, { status, headers: { 'content-type': type } });
}

beforeEach(resetStorage);

describe('the people directory a page reads', () => {
  it('keeps what the worker wrote, and tells a watching page', async () => {
    const seen: PeopleDirectory[] = [];
    const unwatch = watchPeople((d) => seen.push(d));
    const directory = {
      people: { [SARA]: { name: 'Sara', photo: PNG_URL, source: PICTURE } },
      me: ME,
      teamIds: [ALPHA],
      syncedAt: 5,
    };
    await writePeople(directory);
    expect(await readPeople()).toEqual(directory);
    expect(seen).toEqual([directory]);

    await clearPeople();
    expect(await readPeople()).toEqual({ people: {}, me: null, teamIds: [], syncedAt: 0 });
    unwatch();
  });

  it('draws only a picture the worker made: an image as a data: URL, never an address', () => {
    const parsed = parsePeople({
      people: {
        a: { name: 'A', photo: 'https://tracker.example/pixel.png' },
        b: { name: 'B', photo: 'data:text/html;base64,PHNjcmlwdD4=' },
        c: { name: 'C', photo: 'javascript:alert(1)' },
        d: { name: 'D', photo: PNG_URL },
        e: { photo: PNG_URL },
        f: 'nonsense',
      },
    });
    expect(parsed.people.a.photo).toBeNull();
    expect(parsed.people.b.photo).toBeNull();
    expect(parsed.people.c.photo).toBeNull();
    expect(parsed.people.d.photo).toBe(PNG_URL);
    expect(Object.keys(parsed.people)).toEqual(['a', 'b', 'c', 'd']);
    expect(parsePeople('nonsense')).toEqual({ people: {}, me: null, teamIds: [], syncedAt: 0 });
  });

  it('holds no more than its limit', () => {
    const people = Object.fromEntries(
      Array.from({ length: MAX_PEOPLE + 5 }, (_, i) => [`u${i}`, { name: `P${i}` }]),
    );
    expect(Object.keys(parsePeople({ people }).people)).toHaveLength(MAX_PEOPLE);
  });
});

describe('a picture, fetched in the worker', () => {
  it('takes only Google’s image host, over https', () => {
    expect(photoSource(PICTURE)).toBe(PICTURE);
    expect(photoSource('http://lh3.googleusercontent.com/a/x')).toBeNull();
    expect(photoSource('https://googleusercontent.com.evil.example/a')).toBeNull();
    expect(photoSource('https://tracker.example/a.png')).toBeNull();
    expect(photoSource('not a url')).toBeNull();
    expect(photoSource(null)).toBeNull();
  });

  it('becomes a data: URL, asked for without cookies or a referrer', async () => {
    const fetcher = vi.fn(async () => image());
    expect(await fetchPhoto(fetcher as never, PICTURE)).toBe(PNG_URL);
    expect(fetcher).toHaveBeenCalledWith(PICTURE, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  });

  it('is nothing when it is not an image, too big, missing, or unreachable', async () => {
    const svg = vi.fn(async () => image(PNG, 'image/svg+xml'));
    const big = vi.fn(async () => image(new Uint8Array(MAX_PHOTO_BYTES + 1)));
    const gone = vi.fn(async () => image(PNG, 'image/png', 404));
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    for (const fetcher of [svg, big, gone, offline]) {
      expect(await fetchPhoto(fetcher as never, PICTURE)).toBeNull();
    }
  });
});

describe('gathering who is in the teams', () => {
  function setup(members: Record<string, unknown[]>, now = 1_000) {
    const api = {
      run: vi.fn(async (_op: string, params: { teamId: string }) => {
        const list = members[params.teamId];
        if (!list) throw new Error('offline');
        return { members: list };
      }),
    };
    const fetcher = vi.fn(async () => image());
    const clock = { now };
    const people = createPeople({
      api: api as never,
      read: readPeople,
      write: writePeople,
      fetch: fetcher as never,
      now: () => clock.now,
    });
    return { people, api, fetcher, clock };
  }

  const sara = { userId: SARA, displayName: 'Sara', role: 'owner', joinedAt: 1 };
  const omar = { userId: OMAR, displayName: 'Omar', role: 'member', joinedAt: 2 };

  it('names everyone once across teams, with the picture fetched once', async () => {
    const { people, fetcher } = setup({
      [ALPHA]: [{ ...sara, avatarUrl: PICTURE, email: 'sara@example.test' }, omar],
      [BETA]: [{ ...sara, avatarUrl: PICTURE }],
    });
    await people.refresh([ALPHA, BETA], ME);

    const directory = await readPeople();
    expect(directory.people).toEqual({
      [SARA]: { name: 'Sara', photo: PNG_URL, source: PICTURE },
      [OMAR]: { name: 'Omar', photo: null, source: null },
    });
    expect(directory.teamIds).toEqual([ALPHA, BETA]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    // No email reaches the page's side.
    expect(JSON.stringify(store.get('local:hamesh:team-people'))).not.toContain('@');
  });

  it('asks nothing again for the same teams until it is stale, or told to', async () => {
    const { people, api, clock } = setup({ [ALPHA]: [sara] });
    await people.refresh([ALPHA], ME);
    await people.refresh([ALPHA], ME);
    expect(api.run).toHaveBeenCalledTimes(1);

    await people.refresh([ALPHA], ME, true);
    expect(api.run).toHaveBeenCalledTimes(2);

    clock.now += PEOPLE_TTL;
    await people.refresh([ALPHA], ME);
    expect(api.run).toHaveBeenCalledTimes(3);
  });

  it('asks again at once when the teams themselves change', async () => {
    const { people, api } = setup({ [ALPHA]: [sara], [BETA]: [omar] });
    await people.refresh([ALPHA], ME);
    await people.refresh([ALPHA, BETA], ME);
    expect(api.run).toHaveBeenCalledTimes(3);
    expect(Object.keys((await readPeople()).people)).toEqual([SARA, OMAR]);
  });

  it('keeps a picture it already has, and fetches one that changed', async () => {
    const { people, fetcher } = setup({ [ALPHA]: [{ ...sara, avatarUrl: PICTURE }] });
    await people.refresh([ALPHA], ME);
    await people.refresh([ALPHA], ME, true);
    expect(fetcher).toHaveBeenCalledTimes(1);

    const later = 'https://lh3.googleusercontent.com/a/later=s96-c';
    const next = setup({ [ALPHA]: [{ ...sara, avatarUrl: later }] });
    await next.people.refresh([ALPHA], ME, true);
    expect(next.fetcher).toHaveBeenCalledWith(later, expect.anything());
    expect((await readPeople()).people[SARA].source).toBe(later);
  });

  it('leaves the directory as it was when a team cannot be asked', async () => {
    const { people } = setup({ [ALPHA]: [sara] });
    await people.refresh([ALPHA], ME);
    const before = await readPeople();

    await expect(people.refresh([ALPHA, BETA], ME, true)).rejects.toThrow('offline');
    expect(await readPeople()).toEqual(before);
  });

  it('runs one gathering at a time', async () => {
    const { people, api } = setup({ [ALPHA]: [sara] });
    await Promise.all([people.refresh([ALPHA], ME), people.refresh([ALPHA], ME)]);
    expect(api.run).toHaveBeenCalledTimes(1);
  });
});
