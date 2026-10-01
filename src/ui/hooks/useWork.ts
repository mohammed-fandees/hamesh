import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A task's way of failing with something to say — a code, a message — rather
 * than an accident. `failureOf` reads it back; anything else thrown is an
 * accident, reported as the caller's fallback.
 */
export class Failure<F> extends Error {
  constructor(readonly reason: F) {
    super(String(reason));
  }
}

/** The reason a task failed with, or `fallback` for an accident. */
export function failureOf<F>(error: unknown, fallback: F): F {
  return error instanceof Failure ? (error.reason as F) : fallback;
}

/**
 * What a surface is doing, and what it failed at — per control.
 *
 * Every piece of work carries the key of whatever it acts on: a note, a folder,
 * a member, a form. So "busy" and "failed" can be said on that row alone, beside
 * the control that did it, rather than as a page-wide spinner that greys out
 * everything because one button was pressed, or an error at the top of the page
 * far from what failed.
 *
 * `run` never throws. A task that throws is recorded as that key's failure —
 * turned into whatever the surface reports failures as by `toFailure` — and
 * `run` resolves to `null`. Anything that finishes after the surface has gone
 * is dropped rather than set on something that is no longer there.
 */
export interface Work<F> {
  run<T>(key: string, task: () => Promise<T>): Promise<T | null>;
  /** Whether this key's work is in flight. */
  working(key: string): boolean;
  /** This key's last failure, until it is tried again or cleared. */
  failed(key: string): F | null;
  clear(key: string): void;
}

export function useWork<F>(toFailure: (error: unknown) => F): Work<F> {
  /** Every key in flight — several rows may act at once, and one key twice. */
  const [pending, setPending] = useState<readonly string[]>([]);
  const [failures, setFailures] = useState<ReadonlyMap<string, F>>(() => new Map());
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const toFailureRef = useRef(toFailure);
  useEffect(() => {
    toFailureRef.current = toFailure;
  });

  const setFailure = useCallback((key: string, failure: F | null) => {
    setFailures((prev) => {
      if (failure === null && !prev.has(key)) return prev;
      const next = new Map(prev);
      if (failure === null) next.delete(key);
      else next.set(key, failure);
      return next;
    });
  }, []);

  const run = useCallback(
    async <T>(key: string, task: () => Promise<T>): Promise<T | null> => {
      setPending((keys) => [...keys, key]);
      // A new attempt clears only its own last refusal, so one row's failure
      // does not vanish because another row was pressed.
      setFailure(key, null);
      try {
        const result = await task();
        return live.current ? result : null;
      } catch (error) {
        if (live.current) setFailure(key, toFailureRef.current(error));
        return null;
      } finally {
        if (live.current) {
          setPending((keys) => {
            const at = keys.indexOf(key);
            return at === -1 ? keys : [...keys.slice(0, at), ...keys.slice(at + 1)];
          });
        }
      }
    },
    [setFailure],
  );

  return {
    run,
    working: useCallback((key: string) => pending.includes(key), [pending]),
    failed: useCallback((key: string) => failures.get(key) ?? null, [failures]),
    clear: useCallback((key: string) => setFailure(key, null), [setFailure]),
  };
}
