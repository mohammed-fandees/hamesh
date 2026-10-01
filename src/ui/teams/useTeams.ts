import { useCallback, useEffect, useRef, useState } from 'react';
import type { MeResponse } from '@hamesh/teams-contract';
import type { TeamsClient } from '@/teams/client';
import type { TeamCacheSnapshot, TeamsCacheOp, TeamsEvent, TeamsStatus } from '@/teams/messages';
import type { TeamsOpName } from '@/teams/operation-names';
import type { ParamsOf, ResultOf } from '@/teams/operations';
import type { TeamsErrorCode } from '@/teams/errors';
import { Failure, failureOf, useWork } from '../hooks/useWork';

/**
 * The Teams pages' one connection to the background worker.
 *
 * Every operation goes through `run`, which reports failure as a code rather
 * than throwing, so a component never has to decide what an unknown error
 * means. Nothing here caches server state beyond the last answer: what the
 * page shows is what the server last said, refreshed after anything changes.
 *
 * Busy and failed are reported per control — the model every Hamesh surface
 * uses (`useWork`). A caller passes the key of whatever it is acting on — a
 * member, a note, a folder — and shows the state on that row alone.
 */
export interface TeamsPage {
  status: TeamsStatus | null;
  me: MeResponse | null;
  /** True while the page itself is loading, not while one of its rows is acting. */
  busy: boolean;
  /** Whether this exact key is the thing currently being done. */
  working: (key: string) => boolean;
  /** The failure belonging to this key, if its last attempt failed. */
  failed: (key: string) => TeamsErrorCode | null;
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

/** The key the page's own work — loading, or status — is tracked under. */
export const PAGE = 'page';

const toCode = (error: unknown): TeamsErrorCode => failureOf<TeamsErrorCode>(error, 'internal');

export function useTeams(client: TeamsClient): TeamsPage {
  const [status, setStatus] = useState<TeamsStatus | null>(null);
  const work = useWork(toCode);
  const { run: perform } = work;
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const readStatus = useCallback(async () => {
    const reply = await client.send('status');
    if (!live.current) return;
    setStatus(reply.status);
    if (reply.error) throw new Failure<TeamsErrorCode>(reply.error);
  }, [client]);

  const refresh = useCallback(async () => {
    await perform(PAGE, readStatus);
  }, [perform, readStatus]);

  // Inlined rather than calling `refresh()`: a state change made on an effect's
  // synchronous path cascades an extra render (react-hooks/set-state-in-effect),
  // and this way the answer lands in its own turn.
  useEffect(() => {
    void (async () => {
      await perform(PAGE, readStatus);
    })();
  }, [perform, readStatus]);

  const run = useCallback(
    <K extends TeamsOpName>(op: K, params: ParamsOf<K>, key?: string) =>
      perform(key ?? PAGE, async () => {
        const result = await client.request(op, params);
        if (!result.ok) throw new Failure<TeamsErrorCode>(result.error);
        return result.data;
      }),
    [client, perform],
  );

  const cache = useCallback(
    (teamId: string, op: TeamsCacheOp = 'notes', key?: string) =>
      perform(key ?? PAGE, async () => {
        const result = await client.cache(op, teamId);
        if (!result.ok) throw new Failure<TeamsErrorCode>(result.error);
        return result.data;
      }),
    [client, perform],
  );

  const onEvent = useCallback(
    (listener: (event: TeamsEvent) => void) => client.onEvent(listener),
    [client],
  );

  return {
    status,
    me: status?.state === 'signed_in' ? status.me : null,
    busy: work.working(PAGE),
    working: work.working,
    failed: work.failed,
    refresh,
    run,
    cache,
    onEvent,
  };
}
