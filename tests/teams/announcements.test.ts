import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readAnnouncements } from '@/teams/announcements';

const ANNOUNCEMENT = {
  id: '01J0000000000000000000000A',
  title: { en: 'Teams', ar: 'الفرق' },
  body: null,
  action: { label: { en: 'See', ar: 'شاهد' }, to: { open: 'teams' } },
  audience: 'not_in_a_team',
};

let stored: Record<string, unknown> = {};
beforeEach(() => {
  stored = {};
  (globalThis as unknown as { storage: unknown }).storage = {
    getItem: async (key: string) => stored[key] ?? null,
    setItem: async (key: string, value: unknown) => {
      stored[key] = value;
    },
  };
});

const answering = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
const deps = (fetchFn: typeof fetch, now = 1_000) => ({
  apiOrigin: 'https://api.example.test',
  fetch: fetchFn,
  now: () => now,
});

describe('readAnnouncements', () => {
  it('asks for them without any credential or referrer', async () => {
    const fetchFn = answering({ announcements: [ANNOUNCEMENT] });
    expect(await readAnnouncements(deps(fetchFn))).toEqual([ANNOUNCEMENT]);
    expect(fetchFn).toHaveBeenCalledWith('https://api.example.test/v1/announcements', {
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
  });

  it('answers from this device’s copy while it is fresh', async () => {
    await readAnnouncements(deps(answering({ announcements: [ANNOUNCEMENT] })));
    const again = answering({ announcements: [] });
    expect(await readAnnouncements(deps(again, 2_000))).toEqual([ANNOUNCEMENT]);
    expect(again).not.toHaveBeenCalled();
  });

  it('asks again once the copy is stale', async () => {
    await readAnnouncements(deps(answering({ announcements: [ANNOUNCEMENT] })));
    const later = answering({ announcements: [] });
    expect(await readAnnouncements(deps(later, 7 * 60 * 60 * 1000))).toEqual([]);
    expect(later).toHaveBeenCalledTimes(1);
  });

  it('keeps the last copy when the server can’t be reached', async () => {
    await readAnnouncements(deps(answering({ announcements: [ANNOUNCEMENT] })));
    const failing = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await readAnnouncements(deps(failing, 7 * 60 * 60 * 1000))).toEqual([ANNOUNCEMENT]);
  });

  it('shows nothing, and never throws, with no copy and no server', async () => {
    const failing = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await readAnnouncements(deps(failing))).toEqual([]);
  });

  it.each([
    ['an unknown field', { ...ANNOUNCEMENT, extra: 1 }],
    [
      'a link that is not https',
      { ...ANNOUNCEMENT, action: { ...ANNOUNCEMENT.action, to: { url: 'http://x.test' } } },
    ],
    [
      'a javascript link',
      { ...ANNOUNCEMENT, action: { ...ANNOUNCEMENT.action, to: { url: 'javascript:alert(1)' } } },
    ],
    [
      'a place that does not exist',
      { ...ANNOUNCEMENT, action: { ...ANNOUNCEMENT.action, to: { open: 'elsewhere' } } },
    ],
    ['a missing language', { ...ANNOUNCEMENT, title: { en: 'Teams' } }],
  ])('refuses the whole answer for %s', async (_name, bad) => {
    expect(await readAnnouncements(deps(answering({ announcements: [bad] })))).toEqual([]);
    expect(stored).toEqual({});
  });

  it('refuses more than the server is allowed to hand out', async () => {
    const many = Array.from({ length: 4 }, () => ANNOUNCEMENT);
    expect(await readAnnouncements(deps(answering({ announcements: many })))).toEqual([]);
  });
});
