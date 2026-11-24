import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnchorHealthMap, VisitOutcome } from '@/domain/anchor-health';
import type { AnchorHealthRepository } from '@/storage/anchor-health-repository';
import { watchVisit } from './visit-watch';

const NO_HEALTH: AnchorHealthMap = {};

export interface AnchorHealthState {
  /** Every note's health on this device, kept live. */
  health: AnchorHealthMap;
  /** False until the store has been read once. */
  loaded: boolean;
  /** "Keep without a place"; resolves to whether it was written. */
  keep(noteId: string, pageKey: string): Promise<boolean>;
  /** Forgets a note's health once it has a place again; resolves to whether it was written. */
  clear(noteId: string): Promise<boolean>;
}

/**
 * The page's side of "notes that lost their place": reads and watches the health store, and
 * watches each visit to a page (one per page key, so an SPA navigation starts a new one) until
 * its verdict, which it records. `evaluate` is read when a check runs, never captured, so the
 * visit always sees the notes the page holds by then.
 */
export function useAnchorHealth(
  repo: AnchorHealthRepository | undefined,
  pageKey: string,
  evaluate: () => ReadonlyMap<string, VisitOutcome>,
): AnchorHealthState {
  const [health, setHealth] = useState<AnchorHealthMap>(NO_HEALTH);
  const [loaded, setLoaded] = useState(false);
  const evaluateRef = useRef(evaluate);
  useEffect(() => {
    evaluateRef.current = evaluate;
  });

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    void (async () => {
      const map = await repo.read().catch(() => NO_HEALTH);
      if (cancelled) return;
      setHealth(map);
      setLoaded(true);
    })();
    const unwatch = repo.watch(setHealth);
    return () => {
      cancelled = true;
      unwatch();
    };
  }, [repo]);

  useEffect(() => {
    if (!repo) return;
    return watchVisit({
      evaluate: () => evaluateRef.current(),
      onVerdict: (outcomes) => {
        if (outcomes.size === 0) return;
        repo.recordVisit(pageKey, outcomes).then(setHealth, () => {});
      },
    });
  }, [repo, pageKey]);

  const keep = useCallback(
    async (noteId: string, notePageKey: string) => {
      if (!repo) return false;
      try {
        setHealth(await repo.keepWithoutPlace(noteId, notePageKey));
        return true;
      } catch {
        return false;
      }
    },
    [repo],
  );

  const clear = useCallback(
    async (noteId: string) => {
      if (!repo) return false;
      try {
        setHealth(await repo.clear(noteId));
        return true;
      } catch {
        return false;
      }
    },
    [repo],
  );

  return { health, loaded, keep, clear };
}
