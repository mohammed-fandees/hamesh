import { useEffect, useState } from 'react';
import type { AnchorHealthMap } from '@/domain/anchor-health';
import type { Note } from '@/domain/note';
import type { AnchorHealthRepository } from '@/storage/anchor-health-repository';

const NO_HEALTH: AnchorHealthMap = {};

/**
 * What this device has seen of each note's place, kept live for Hamesh's own pages. Once the
 * notes are in, entries for notes that no longer exist are dropped (a write happens only when
 * there are some). An empty list prunes nothing: it is as likely a read that failed as a library
 * with no notes, and a stale entry costs nothing.
 */
export function useAnchorHealthMap(
  repo: AnchorHealthRepository,
  notes: readonly Note[] | null,
): AnchorHealthMap {
  const [health, setHealth] = useState<AnchorHealthMap>(NO_HEALTH);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const map = await repo.read().catch(() => NO_HEALTH);
      if (!cancelled) setHealth(map);
    })();
    const unwatch = repo.watch(setHealth);
    return () => {
      cancelled = true;
      unwatch();
    };
  }, [repo]);

  useEffect(() => {
    if (!notes || notes.length === 0) return;
    void repo.prune(new Set(notes.map((n) => n.id))).catch(() => {});
  }, [repo, notes]);

  return health;
}
