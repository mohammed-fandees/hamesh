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
 */
export interface TeamsPage {
  status: TeamsStatus | null;
  me: MeResponse | null;
  /** Set when the last thing the page tried failed. */
  error: TeamsErrorCode | null;
  busy: boolean;
  clearError: () => void;
  refresh: () => Promise<void>;
  run<K extends TeamsOpName>(op: K, params: ParamsOf<K>): Promise<ResultOf<K> | null>;
  /**
   * Reads the team notes this device already holds — no request, unless `sync`
   * is asked for, which has the worker pull first.
   */
  cache(teamId: string, op?: TeamsCacheOp): Promise<TeamCacheSnapshot | null>;
  /** Subscribes to the worker's notices; returns the unsubscribe. */
  onEvent(listener: (event: TeamsEvent) => void): () => void;
}

export function useTeams(client: TeamsClient): TeamsPage {
  const [status, setStatus] = useState<TeamsStatus | null>(null);
  const [error, setError] = useState<TeamsErrorCode | null>(null);
  const [busy, setBusy] = useState(false);
  // Answers that arrive after the page has gone are dropped rather than
  // setting state on something that is no longer there.
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const reply = await client.send('status');
    if (!live.current) return;
    setStatus(reply.status);
    if (reply.error) setError(reply.error);
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
      if (reply.error) setError(reply.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const run = useCallback(
    async <K extends TeamsOpName>(op: K, params: ParamsOf<K>): Promise<ResultOf<K> | null> => {
      setBusy(true);
      setError(null);
      try {
        const result = await client.request(op, params);
        if (!live.current) return null;
        if (!result.ok) {
          setError(result.error);
          return null;
        }
        return result.data;
      } finally {
        if (live.current) setBusy(false);
      }
    },
    [client],
  );

  const cache = useCallback(
    async (teamId: string, op: TeamsCacheOp = 'notes'): Promise<TeamCacheSnapshot | null> => {
      setBusy(true);
      setError(null);
      try {
        const result = await client.cache(op, teamId);
        if (!live.current) return null;
        if (!result.ok) {
          setError(result.error);
          return null;
        }
        return result.data;
      } finally {
        if (live.current) setBusy(false);
      }
    },
    [client],
  );

  const onEvent = useCallback(
    (listener: (event: TeamsEvent) => void) => client.onEvent(listener),
    [client],
  );

  return {
    status,
    me: status?.state === 'signed_in' ? status.me : null,
    error,
    busy,
    clearError: useCallback(() => setError(null), []),
    refresh,
    run,
    cache,
    onEvent,
  };
}
