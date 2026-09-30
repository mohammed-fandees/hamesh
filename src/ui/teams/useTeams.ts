import { useCallback, useEffect, useRef, useState } from 'react';
import type { MeResponse } from '@hamesh/teams-contract';
import type { TeamsClient } from '@/teams/client';
import type { TeamCacheSnapshot, TeamsCacheOp, TeamsEvent, TeamsStatus } from '@/teams/messages';
import type { TeamsOpName } from '@/teams/operation-names';
import type { ParamsOf, ResultOf } from '@/teams/operations';
import type { TeamsErrorCode } from '@/teams/errors';

/**
 * The Teams page's one connection to the background worker.
 *
 * Every operation goes through `run`, which reports failure as a code rather
 * than throwing, so a component never has to decide what an unknown error
 * means. Nothing here caches server state beyond the last answer: what the
 * page shows is what the server last said, refreshed after anything changes.
 *
 * Both "something is happening" and "something failed" are reported *per
 * control*. A caller passes the key of whatever it is acting on — a member, a
 * note, a folder — and shows the state on that row alone. A page-wide spinner
 * that greys out every button because one of them was pressed tells the reader
 * nothing about which one, and takes away the rest of the page while it does.
 */

/** What is happening, or what failed, and to which of the page's rows. */
export interface PageWork {
  /** The key the caller passed, or null for work the page as a whole is doing. */
  key: string | null;
}

export interface PageFailure extends PageWork {
  code: TeamsErrorCode;
}

export interface TeamsPage {
  status: TeamsStatus | null;
  me: MeResponse | null;
  /** The last failure, and which row it belongs to. */
  failure: PageFailure | null;
  /** True while the page itself is loading, not while one of its rows is acting. */
  busy: boolean;
  /** Whether this exact key is the thing currently being done. */
  working: (key: string) => boolean;
  /** The failure belonging to this key, if the last one was its. */
  failed: (key: string) => TeamsErrorCode | null;
  clearError: () => void;
  refresh: () => Promise<void>;
  /**
   * Performs one operation. `key` names the row it belongs to, so the page can
   * show it working, and show its refusal beside it rather than at the top.
   */
  run<K extends TeamsOpName>(op: K, params: ParamsOf<K>, key?: string): Promise<ResultOf<K> | null>;
  /**
   * Reads the team notes this device already holds — no request, unless `sync`
   * is asked for, which has the worker pull first.
   */
  cache(teamId: string, op?: TeamsCacheOp, key?: string): Promise<TeamCacheSnapshot | null>;
  /** Subscribes to the worker's notices; returns the unsubscribe. */
  onEvent(listener: (event: TeamsEvent) => void): () => void;
}

/** The key a page-level piece of work is tracked under. */
export const PAGE = null;

export function useTeams(client: TeamsClient): TeamsPage {
  const [status, setStatus] = useState<TeamsStatus | null>(null);
  const [failure, setFailure] = useState<PageFailure | null>(null);
  /** Every key currently in flight — several rows may be acting at once. */
  const [pending, setPending] = useState<readonly (string | null)[]>([]);
  // Answers that arrive after the page has gone are dropped rather than
  // setting state on something that is no longer there.
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const start = useCallback((key: string | null) => {
    setPending((keys) => [...keys, key]);
    // A new attempt clears only its own previous refusal, so one row's failure
    // does not vanish because another row was pressed.
    setFailure((f) => (f && f.key === key ? null : f));
  }, []);

  const finish = useCallback((key: string | null) => {
    if (!live.current) return;
    setPending((keys) => {
      const at = keys.indexOf(key);
      return at === -1 ? keys : [...keys.slice(0, at), ...keys.slice(at + 1)];
    });
  }, []);

  const refresh = useCallback(async () => {
    const reply = await client.send('status');
    if (!live.current) return;
    setStatus(reply.status);
    if (reply.error) setFailure({ key: PAGE, code: reply.error });
  }, [client]);

  // The await is inlined here rather than calling `refresh()`: a state change
  // made on an effect's synchronous path cascades an extra render
  // (react-hooks/set-state-in-effect), and this way the answer lands in its
  // own turn.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const reply = await client.send('status');
      if (cancelled) return;
      setStatus(reply.status);
      if (reply.error) setFailure({ key: PAGE, code: reply.error });
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const run = useCallback(
    async <K extends TeamsOpName>(
      op: K,
      params: ParamsOf<K>,
      key?: string,
    ): Promise<ResultOf<K> | null> => {
      const at = key ?? PAGE;
      start(at);
      try {
        const result = await client.request(op, params);
        if (!live.current) return null;
        if (!result.ok) {
          setFailure({ key: at, code: result.error });
          return null;
        }
        return result.data;
      } finally {
        finish(at);
      }
    },
    [client, start, finish],
  );

  const cache = useCallback(
    async (
      teamId: string,
      op: TeamsCacheOp = 'notes',
      key?: string,
    ): Promise<TeamCacheSnapshot | null> => {
      const at = key ?? PAGE;
      start(at);
      try {
        const result = await client.cache(op, teamId);
        if (!live.current) return null;
        if (!result.ok) {
          setFailure({ key: at, code: result.error });
          return null;
        }
        return result.data;
      } finally {
        finish(at);
      }
    },
    [client, start, finish],
  );

  const onEvent = useCallback(
    (listener: (event: TeamsEvent) => void) => client.onEvent(listener),
    [client],
  );

  return {
    status,
    me: status?.state === 'signed_in' ? status.me : null,
    failure,
    busy: pending.includes(PAGE),
    working: useCallback((key: string) => pending.includes(key), [pending]),
    failed: useCallback(
      (key: string) => (failure && failure.key === key ? failure.code : null),
      [failure],
    ),
    clearError: useCallback(() => setFailure(null), []),
    refresh,
    run,
    cache,
    onEvent,
  };
}
