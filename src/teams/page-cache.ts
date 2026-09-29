import type { Anchor, Note } from '@/domain/note';
import { DEFAULT_WORKSPACE_ID } from '@/domain/workspace';

/**
 * The local read model for team notes: what the content script draws from.
 *
 * Team notes are pulled once per team by the background worker (see ./sync.ts)
 * and filed here by page, exactly the way personal notes are stored
 * (`hamesh:notes:<pageKey>`). That is what keeps the server out of the user's
 * browsing: nothing asks "what notes exist for this URL" over the network — the
 * whole team's notes arrive as one delta stream and the match to a page happens
 * on this device.
 *
 * Written only by the background worker. Read (and watched) by the content
 * script, which cannot reach the worker's Teams messages at all, and by
 * Hamesh's own pages. Deliberately zod-free and contract-free: the content
 * script ships in every build, so nothing it imports may drag the contract's
 * schemas into a build that has no Teams. Stored values are parsed by hand
 * here, dropping anything malformed, the same way `parseStoredNotes` and
 * `parseFolderState` treat their own areas.
 *
 * No session token, and nothing here that a content script could not already
 * see: the notes it holds are the ones about to be drawn on the page.
 */

const PAGE_PREFIX = 'hamesh:team-notes:';
const INDEX_KEY = 'local:hamesh:teams';

const pageKeyFor = (pageKey: string) => `local:${PAGE_PREFIX}${pageKey}` as const;

/** One team note as it is kept on this device, for one page. */
export interface CachedTeamNote {
  /** The team note's own id, as the server issued it. */
  id: string;
  teamId: string;
  originalUrl: string;
  pageTitle: string | null;
  content: string;
  anchor: Anchor;
  folderId: string | null;
  /** The member who shared it, or null once they have left the team. */
  authorId: string | null;
  /** The server's version, quoted back on an edit so a stale one is refused. */
  version: number;
  /** Epoch milliseconds, as the server keeps them. */
  createdAt: number;
  updatedAt: number;
}

/** The teams this account is in, as the server last reported them. */
export interface CachedTeam {
  id: string;
  name: string;
}

export interface TeamIndex {
  teams: CachedTeam[];
  /** When the worker last wrote this, or 0 when it never has. */
  syncedAt: number;
}

export const EMPTY_INDEX: TeamIndex = { teams: [], syncedAt: 0 };

function isAnchor(value: unknown): value is Anchor {
  if (!value || typeof value !== 'object') return false;
  const a = value as { type?: unknown; videoId?: unknown; exact?: unknown; signals?: unknown };
  if (a.type === 'video') return typeof a.videoId === 'string';
  if (a.type === 'text') return typeof a.exact === 'string';
  return !!a.signals && typeof a.signals === 'object';
}

function parseNote(value: unknown): CachedTeamNote | null {
  if (!value || typeof value !== 'object') return null;
  const n = value as Record<string, unknown>;
  if (typeof n.id !== 'string' || typeof n.teamId !== 'string') return null;
  if (typeof n.originalUrl !== 'string' || typeof n.content !== 'string') return null;
  if (!isAnchor(n.anchor)) return null;
  if (typeof n.version !== 'number' || !Number.isFinite(n.version)) return null;
  if (typeof n.createdAt !== 'number' || typeof n.updatedAt !== 'number') return null;
  return {
    id: n.id,
    teamId: n.teamId,
    originalUrl: n.originalUrl,
    pageTitle: typeof n.pageTitle === 'string' ? n.pageTitle : null,
    content: n.content,
    anchor: n.anchor,
    folderId: typeof n.folderId === 'string' ? n.folderId : null,
    authorId: typeof n.authorId === 'string' ? n.authorId : null,
    version: n.version,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

export function parseCachedNotes(data: unknown): CachedTeamNote[] {
  if (!Array.isArray(data)) return [];
  const notes: CachedTeamNote[] = [];
  for (const item of data) {
    const note = parseNote(item);
    if (note) notes.push(note);
  }
  return notes;
}

export function parseTeamIndex(data: unknown): TeamIndex {
  if (!data || typeof data !== 'object') return EMPTY_INDEX;
  const raw = data as { teams?: unknown; syncedAt?: unknown };
  const teams: CachedTeam[] = [];
  if (Array.isArray(raw.teams)) {
    for (const item of raw.teams) {
      if (!item || typeof item !== 'object') continue;
      const t = item as { id?: unknown; name?: unknown };
      if (typeof t.id !== 'string' || typeof t.name !== 'string') continue;
      teams.push({ id: t.id, name: t.name });
    }
  }
  return { teams, syncedAt: typeof raw.syncedAt === 'number' ? raw.syncedAt : 0 };
}

/**
 * A cached team note as the rest of Hamesh sees notes, so every marker, anchor
 * resolver and card works on it unchanged. `team` is what tells them apart: a
 * note carrying it lives in a team, not on this device, and nothing local may
 * write it (see `Note.team`).
 *
 * `pageKey` is the bucket this note was filed under, which is how it was found;
 * `teamName` comes from the index, and is left as the id's placeholder only if
 * the index has not caught up with a brand-new team yet.
 */
export function toNote(cached: CachedTeamNote, pageKey: string, teamName: string): Note {
  return {
    id: cached.id,
    schemaVersion: 1,
    pageKey,
    originalUrl: cached.originalUrl,
    content: cached.content,
    anchor: cached.anchor,
    workspaceId: DEFAULT_WORKSPACE_ID,
    ...(cached.pageTitle ? { pageContext: { title: cached.pageTitle } } : {}),
    team: {
      id: cached.teamId,
      name: teamName,
      version: cached.version,
      authorId: cached.authorId,
      folderId: cached.folderId,
    },
    createdAt: new Date(cached.createdAt).toISOString(),
    updatedAt: new Date(cached.updatedAt).toISOString(),
  };
}

/** Every team note cached for one page, already shaped as notes. */
export async function readPageNotes(pageKey: string): Promise<Note[]> {
  const [raw, index] = await Promise.all([
    storage.getItem<unknown>(pageKeyFor(pageKey)),
    readTeamIndex(),
  ]);
  return projectPage(parseCachedNotes(raw), pageKey, index);
}

/** The same projection, for a value that has already been read or delivered. */
export function projectPage(cached: CachedTeamNote[], pageKey: string, index: TeamIndex): Note[] {
  const names = new Map(index.teams.map((t) => [t.id, t.name]));
  // A note whose team is no longer in the index belongs to a team this account
  // has left: it is dropped rather than drawn with a team nobody recognises.
  return cached
    .filter((note) => names.has(note.teamId))
    .map((note) => toNote(note, pageKey, names.get(note.teamId) as string));
}

export function readTeamIndex(): Promise<TeamIndex> {
  return storage.getItem<unknown>(INDEX_KEY).then(parseTeamIndex);
}

/** Fires whenever the worker rewrites this page's team notes. */
export function watchPageNotes(pageKey: string, cb: () => void): () => void {
  return storage.watch<unknown>(pageKeyFor(pageKey), () => cb());
}

/** Fires when the set of teams (or a team's name) changes. */
export function watchTeamIndex(cb: (index: TeamIndex) => void): () => void {
  return storage.watch<unknown>(INDEX_KEY, (value) => cb(parseTeamIndex(value)));
}

// ---- The worker's side: the only writer ----

/**
 * Records the teams this account is in, and does nothing at all when they are
 * the ones already recorded.
 *
 * Every answer to "who am I" passes through here, which is several times an
 * hour. A write fires a storage change in every open tab, and the content script
 * redraws its page's shared notes when it sees one — so writing an unchanged list
 * would have every tab re-read the same notes on a timer, for nothing.
 */
export async function writeTeamIndex(teams: CachedTeam[], now: number): Promise<void> {
  const current = await readTeamIndex();
  const same =
    current.teams.length === teams.length &&
    current.teams.every((team, i) => team.id === teams[i].id && team.name === teams[i].name);
  if (same && current.syncedAt > 0) return;
  await storage.setItem<TeamIndex>(INDEX_KEY, { teams, syncedAt: now });
}

export function readPageBucket(pageKey: string): Promise<CachedTeamNote[]> {
  return storage.getItem<unknown>(pageKeyFor(pageKey)).then(parseCachedNotes);
}

/** Writes one page's bucket, removing it entirely when nothing is left in it. */
export async function writePageBucket(pageKey: string, notes: CachedTeamNote[]): Promise<void> {
  if (notes.length === 0) await storage.removeItem(pageKeyFor(pageKey));
  else await storage.setItem<CachedTeamNote[]>(pageKeyFor(pageKey), notes);
}

/**
 * Forgets every cached team note on this device — what signing out, or turning
 * Teams off, leaves behind. Found by scanning rather than from the worker's own
 * bookkeeping, so a bucket survives no matter what state that bookkeeping is
 * in.
 */
export async function clearAllPages(): Promise<void> {
  const snapshot = await storage.snapshot('local');
  const keys = Object.keys(snapshot)
    .filter((key) => key.startsWith(PAGE_PREFIX))
    .map((key) => `local:${key}` as const);
  if (keys.length > 0) await storage.removeItems(keys);
  await storage.removeItem(INDEX_KEY);
}
