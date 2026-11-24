import {
  applyVisit,
  parseAnchorHealth,
  type AnchorHealthMap,
  type VisitOutcome,
} from '@/domain/anchor-health';

const STORAGE_KEY = 'local:hamesh:anchor-health';

/**
 * Where this device keeps what it has seen of each note's place (see `domain/anchor-health.ts`).
 * Written by the content script after a visit and by the reader's choices; read by the page and
 * the Library. Every write is skipped when it would change nothing.
 */
export interface AnchorHealthRepository {
  read(): Promise<AnchorHealthMap>;
  /** One visit's verdict for the notes it checked on `pageKey`. */
  recordVisit(
    pageKey: string,
    outcomes: ReadonlyMap<string, VisitOutcome>,
    now?: Date,
  ): Promise<AnchorHealthMap>;
  /** The reader's "Keep without a place": stays, and is no longer flagged. */
  keepWithoutPlace(noteId: string, pageKey: string, now?: Date): Promise<AnchorHealthMap>;
  /** Forgets a note's health, after it was put back in its place. */
  clear(noteId: string): Promise<AnchorHealthMap>;
  /** Drops entries for notes that no longer exist. */
  prune(existingIds: ReadonlySet<string>): Promise<AnchorHealthMap>;
  watch(onChange: (map: AnchorHealthMap) => void): () => void;
}

export function createAnchorHealthRepository(): AnchorHealthRepository {
  const read = async () => parseAnchorHealth(await storage.getItem<unknown>(STORAGE_KEY));

  /** Reads, changes, and writes only when `change` returns a new map. */
  const change = async (
    next: (map: AnchorHealthMap) => AnchorHealthMap | null,
  ): Promise<AnchorHealthMap> => {
    const map = await read();
    const updated = next(map);
    if (!updated) return map;
    await storage.setItem(STORAGE_KEY, updated);
    return updated;
  };

  return {
    read,

    recordVisit: (pageKey, outcomes, now = new Date()) =>
      change((map) => applyVisit(map, pageKey, outcomes, now.toISOString())),

    keepWithoutPlace: (noteId, pageKey, now = new Date()) =>
      change((map) => {
        if (map[noteId]?.status === 'kept-without-place') return null;
        return {
          ...map,
          [noteId]: {
            status: 'kept-without-place',
            misses: map[noteId]?.misses ?? 0,
            lastCheckedAt: now.toISOString(),
            pageKey,
          },
        };
      }),

    clear: (noteId) =>
      change((map) => {
        if (!(noteId in map)) return null;
        const next = { ...map };
        delete next[noteId];
        return next;
      }),

    prune: (existingIds) =>
      change((map) => {
        const stale = Object.keys(map).filter((id) => !existingIds.has(id));
        if (stale.length === 0) return null;
        const next = { ...map };
        for (const id of stale) delete next[id];
        return next;
      }),

    watch: (onChange) =>
      storage.watch<unknown>(STORAGE_KEY, (value) => onChange(parseAnchorHealth(value))),
  };
}
