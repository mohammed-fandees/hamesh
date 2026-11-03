import type { Announcement } from '@/domain/announcements';

const CACHE_KEY = 'local:hamesh:announcements';
/** Often enough for news; rare enough that nobody's Library waits on the server. */
const REFRESH_MS = 6 * 60 * 60 * 1000;

interface Cached {
  fetchedAt: number;
  items: Announcement[];
}

export interface AnnouncementsDeps {
  apiOrigin: string;
  fetch: typeof fetch;
  now: () => number;
}

async function parse(data: unknown): Promise<Announcement[] | null> {
  // Reached only here, so the page that never shows one never loads the schema.
  const { AnnouncementsResponse } = await import('@hamesh/teams-contract/announcements');
  const parsed = AnnouncementsResponse.safeParse(data);
  return parsed.success ? parsed.data.announcements : null;
}

async function readCache(): Promise<Cached | null> {
  const raw = await storage.getItem<Cached>(CACHE_KEY);
  if (!raw || typeof raw.fetchedAt !== 'number') return null;
  const items = await parse({ announcements: raw.items });
  return items ? { fetchedAt: raw.fetchedAt, items } : null;
}

/**
 * What the server is announcing, from this device's copy while that is fresh.
 *
 * The request is public and carries nothing: no session, no cookie, no referrer,
 * so it works before anyone has turned Teams on, and says nothing about them
 * when it does. It needs no host permission either, only the server's CORS. A
 * server that can't be reached is no reason to bother the reader: the last copy
 * stands, or there is simply nothing to show.
 */
export async function readAnnouncements(deps: AnnouncementsDeps): Promise<Announcement[]> {
  const cached = await readCache();
  if (cached && deps.now() - cached.fetchedAt < REFRESH_MS) return cached.items;
  try {
    const response = await deps.fetch(`${deps.apiOrigin}/v1/announcements`, {
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) return cached?.items ?? [];
    const items = await parse(await response.json());
    if (!items) return cached?.items ?? [];
    await storage.setItem<Cached>(CACHE_KEY, { fetchedAt: deps.now(), items });
    return items;
  } catch {
    return cached?.items ?? [];
  }
}
