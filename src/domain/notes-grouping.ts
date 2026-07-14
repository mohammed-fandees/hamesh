import type { Note } from './note';

/** Number of monogram tint slots defined in `src/ui/notes-library.css`
 *  (`.hm-monogram--0` … `.hm-monogram--4`). Kept in sync manually — there is
 *  no runtime coupling between the two, so a CSS review should walk both. */
const MONOGRAM_PALETTE_SIZE = 5;

export interface WebsiteGroup {
  /** Grouping key and display label — registrable hostname with a leading
   *  `www.` stripped. Deliberately not a curated "pretty name" lookup (e.g.
   *  "github.com" → "GitHub"): that requires an unmaintainable per-site table
   *  and is exactly the kind of speculative complexity this project avoids. */
  domain: string;
  notes: Note[];
  count: number;
  /** ISO timestamp of the most recently updated note in this group. */
  lastActivity: string;
  /** `originalUrl` of the most recently updated note — where a "Continue"
   *  card for this group links to. */
  latestNoteUrl: string;
  /** id of that same note — the Open Note flow's restore target. */
  latestNoteId: string;
}

export interface ContinueWebsite {
  domain: string;
  count: number;
  lastActivity: string;
  latestNoteUrl: string;
  latestNoteId: string;
}

export interface Monogram {
  letter: string;
  colorIndex: number;
}

/** Registrable hostname, lowercased, `www.` stripped. Never throws — a
 *  malformed `originalUrl` (which shouldn't occur since it's always captured
 *  from `location.href`) degrades to grouping under the raw string rather
 *  than silently dropping the note. */
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch {
    return url;
  }
}

/** The most recently updated note in a (non-empty) list. Computed once so
 *  `lastActivity` and `latestNoteUrl` always agree on which note "wins" a
 *  tie, rather than two separate reduces potentially picking different
 *  notes with identical timestamps. */
function latestNote(notes: Note[]): Note {
  return notes.reduce((latest, n) => (n.updatedAt > latest.updatedAt ? n : latest), notes[0]);
}

/** Groups notes by website, sorted alphabetically by domain. Recency-based
 *  ordering for this list is deliberately deferred — see `getContinueWebsites`
 *  for the one place recency drives ordering in this phase. */
export function groupNotesByDomain(notes: Note[]): WebsiteGroup[] {
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    const domain = extractDomain(note.originalUrl);
    const bucket = groups.get(domain);
    if (bucket) bucket.push(note);
    else groups.set(domain, [note]);
  }

  const result: WebsiteGroup[] = [];
  for (const [domain, groupNotes] of groups) {
    const latest = latestNote(groupNotes);
    result.push({
      domain,
      notes: groupNotes,
      count: groupNotes.length,
      lastActivity: latest.updatedAt,
      latestNoteUrl: latest.originalUrl,
      latestNoteId: latest.id,
    });
  }
  result.sort((a, b) => a.domain.localeCompare(b.domain));
  return result;
}

/** The websites a returning user most recently left notes on — a shortcut to
 *  resume a train of thought, not a browsing-history feature. Derived purely
 *  from existing note timestamps (no new tracking), sorted most-recent-first,
 *  capped at `limit`. Empty when there are no notes at all. */
export function getContinueWebsites(notes: Note[], limit = 3): ContinueWebsite[] {
  return groupNotesByDomain(notes)
    .map(({ domain, count, lastActivity, latestNoteUrl, latestNoteId }) => ({
      domain,
      count,
      lastActivity,
      latestNoteUrl,
      latestNoteId,
    }))
    .sort((a, b) =>
      a.lastActivity > b.lastActivity ? -1 : a.lastActivity < b.lastActivity ? 1 : 0,
    )
    .slice(0, limit);
}

export type GroupSortMode = 'alphabetical' | 'recent';

/** Reorders already-grouped websites — alphabetical (the `groupNotesByDomain`
 *  default) or by most recent activity first. A separate step from grouping
 *  itself so the two concerns (which notes belong together vs. what order to
 *  present the groups in) stay independently testable. */
export function sortWebsiteGroups(groups: WebsiteGroup[], mode: GroupSortMode): WebsiteGroup[] {
  const sorted = [...groups];
  if (mode === 'recent') {
    sorted.sort((a, b) =>
      a.lastActivity > b.lastActivity ? -1 : a.lastActivity < b.lastActivity ? 1 : 0,
    );
  } else {
    sorted.sort((a, b) => a.domain.localeCompare(b.domain));
  }
  return sorted;
}

/** A human-meaningful label for the page a note was created on. Prefers the
 *  captured page title; when unavailable (an older note, or a page with no
 *  `<title>`), falls back to the URL's pathname rather than a generic
 *  "Untitled page" placeholder, so the row still communicates *something*
 *  real about the page instead of reading as broken/missing metadata. */
export function derivePageLabel(note: Note): string {
  const title = note.pageContext?.title?.trim();
  if (title) return title;

  try {
    const url = new URL(note.originalUrl);
    const path = url.pathname.replace(/\/+$/, '');
    return path || url.hostname;
  } catch {
    return note.originalUrl;
  }
}

/** Live search filter — matches note text, the page label (captured title,
 *  or the same pathname fallback `derivePageLabel` shows in the UI), and the
 *  website domain. Case-insensitive substring match; an empty/whitespace-only
 *  query matches everything (the "not searching" state). */
export function filterNotesByQuery(notes: Note[], query: string): Note[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter((note) => {
    const domain = extractDomain(note.originalUrl).toLowerCase();
    const label = derivePageLabel(note).toLowerCase();
    return note.content.toLowerCase().includes(q) || label.includes(q) || domain.includes(q);
  });
}

/** Deterministic letter + palette-slot for a domain, used when no favicon is
 *  available. Same domain always yields the same monogram. */
export function deriveMonogram(domain: string): Monogram {
  const firstAlnum = domain.match(/[a-z0-9]/i)?.[0] ?? '#';
  const letter = firstAlnum.toUpperCase();

  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash * 31 + domain.charCodeAt(i)) >>> 0;
  }
  return { letter, colorIndex: hash % MONOGRAM_PALETTE_SIZE };
}
