/**
 * Whether a note can still find its place on its page, as this device has seen it.
 *
 * Kept apart from the note on purpose: it is an observation, not something the reader wrote. It
 * never moves `updatedAt`, never travels in a backup, and the next visit recreates it. One map
 * for every page, by note id, under one storage key (see `anchor-health-repository.ts`).
 *
 * A note is only called lost after two separate visits each ended without finding it, so one
 * broken load (a paywall, a cookie wall, an A/B test) never flags anything. Any visit that finds
 * it again clears it.
 */

export type AnchorHealthStatus = 'suspect' | 'lost' | 'kept-without-place';

export interface AnchorHealth {
  status: AnchorHealthStatus;
  /** Visits that ended without finding the note, capped at `MISSES_TO_LOSE`. */
  misses: number;
  lastCheckedAt: string;
  pageKey: string;
}

export type AnchorHealthMap = Readonly<Record<string, AnchorHealth>>;

/** How one visit ended for one note. */
export type VisitOutcome = 'found' | 'missed';

/** Separate visits that must each miss before a note is lost. */
export const MISSES_TO_LOSE = 2;

const STATUSES: ReadonlySet<string> = new Set<AnchorHealthStatus>([
  'suspect',
  'lost',
  'kept-without-place',
]);

/**
 * The note's health after one visit. `undefined` means healthy: there is nothing to keep.
 *
 * Kept-without-place is the reader's choice, so a miss leaves it alone; finding the note again
 * means it has a place after all, and clears it like any other state.
 */
export function nextAnchorHealth(
  previous: AnchorHealth | undefined,
  outcome: VisitOutcome,
  visit: { pageKey: string; now: string },
): AnchorHealth | undefined {
  if (outcome === 'found') return undefined;
  if (previous?.status === 'kept-without-place') return previous;
  const misses = Math.min(MISSES_TO_LOSE, (previous?.misses ?? 0) + 1);
  return {
    status: misses >= MISSES_TO_LOSE ? 'lost' : 'suspect',
    misses,
    lastCheckedAt: visit.now,
    pageKey: visit.pageKey,
  };
}

function parseEntry(value: unknown): AnchorHealth | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.status !== 'string' || !STATUSES.has(raw.status)) return null;
  if (typeof raw.pageKey !== 'string' || raw.pageKey === '') return null;
  if (typeof raw.lastCheckedAt !== 'string') return null;
  const misses = raw.misses;
  if (typeof misses !== 'number' || !Number.isInteger(misses) || misses < 0) return null;
  return {
    status: raw.status as AnchorHealthStatus,
    misses: Math.min(MISSES_TO_LOSE, misses),
    lastCheckedAt: raw.lastCheckedAt,
    pageKey: raw.pageKey,
  };
}

/** The stored map, read by hand (the content script stays zod-free). Bad entries are dropped. */
export function parseAnchorHealth(value: unknown): AnchorHealthMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const map: Record<string, AnchorHealth> = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    const parsed = parseEntry(entry);
    if (id && parsed) map[id] = parsed;
  }
  return map;
}

function sameEntry(a: AnchorHealth | undefined, b: AnchorHealth | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.status === b.status &&
    a.misses === b.misses &&
    a.lastCheckedAt === b.lastCheckedAt &&
    a.pageKey === b.pageKey
  );
}

/**
 * The whole map after one visit to `pageKey`, or `null` when nothing in it changed, so a visit
 * that found every note writes nothing (a write wakes every tab that watches the store).
 */
export function applyVisit(
  map: AnchorHealthMap,
  pageKey: string,
  outcomes: ReadonlyMap<string, VisitOutcome>,
  now: string,
): AnchorHealthMap | null {
  const next: Record<string, AnchorHealth> = { ...map };
  let changed = false;
  for (const [noteId, outcome] of outcomes) {
    const before = map[noteId];
    const after = nextAnchorHealth(before, outcome, { pageKey, now });
    if (sameEntry(before, after)) continue;
    changed = true;
    if (after) next[noteId] = after;
    else delete next[noteId];
  }
  return changed ? next : null;
}

/** Lost: the reader is told about it. */
export function isLost(entry: AnchorHealth | undefined): boolean {
  return entry?.status === 'lost';
}

/** Lost, or kept without a place: either way it has no place on its page. */
export function isPlaceless(entry: AnchorHealth | undefined): boolean {
  return entry?.status === 'lost' || entry?.status === 'kept-without-place';
}

/** The ids, out of `map`, that `which` selects. */
export function healthIds(
  map: AnchorHealthMap,
  which: (entry: AnchorHealth) => boolean,
): ReadonlySet<string> {
  return new Set(
    Object.entries(map)
      .filter(([, entry]) => which(entry))
      .map(([id]) => id),
  );
}
