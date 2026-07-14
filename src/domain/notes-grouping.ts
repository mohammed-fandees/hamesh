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
}

export interface ContinueWebsite {
  domain: string;
  count: number;
  lastActivity: string;
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

function latestUpdatedAt(notes: Note[]): string {
  return notes.reduce(
    (latest, n) => (n.updatedAt > latest ? n.updatedAt : latest),
    notes[0].updatedAt,
  );
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
    result.push({
      domain,
      notes: groupNotes,
      count: groupNotes.length,
      lastActivity: latestUpdatedAt(groupNotes),
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
    .map(({ domain, count, lastActivity }) => ({ domain, count, lastActivity }))
    .sort((a, b) =>
      a.lastActivity > b.lastActivity ? -1 : a.lastActivity < b.lastActivity ? 1 : 0,
    )
    .slice(0, limit);
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
