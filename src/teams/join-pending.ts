/**
 * An invitation opened from its link, waiting for Hamesh's Teams page to show
 * it.
 *
 * It sits in `storage.session`: web pages and Hamesh's content script cannot
 * read that area, and the browser empties it when it closes. It waits ten
 * minutes at most, long enough to sign in first. It is read, not taken, so a
 * page that loads twice still sees it; it is cleared once the invitation is
 * accepted or the reader turns to another link.
 */

const KEY = 'session:hamesh:join-pending';
export const PENDING_JOIN_TTL_MS = 10 * 60_000;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

interface Pending {
  token: string;
  savedAt: number;
}

export async function savePendingJoin(token: string, now: number): Promise<void> {
  await storage.setItem<Pending>(KEY, { token, savedAt: now });
}

export async function readPendingJoin(now: number): Promise<string | null> {
  const raw = await storage.getItem<Pending>(KEY);
  if (!raw || typeof raw !== 'object') return null;
  const { token, savedAt } = raw;
  if (typeof token !== 'string' || !TOKEN.test(token) || typeof savedAt !== 'number') return null;
  if (now - savedAt >= PENDING_JOIN_TTL_MS) {
    await storage.removeItem(KEY);
    return null;
  }
  return token;
}

export async function clearPendingJoin(): Promise<void> {
  await storage.removeItem(KEY);
}
