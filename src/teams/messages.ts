import type { MeResponse } from '@hamesh/teams-contract';
import type { TeamsErrorCode } from './errors';
import { isOperationName, type TeamsOpName } from './operation-names';
import type { ParamsOf, ResultOf } from './operations';

/**
 * Messages between Hamesh's own pages and the background service worker for
 * Teams. Pages never see the session token; they ask the worker to act and
 * get back the account's status as the server reported it.
 */
export const TEAMS_OPS = ['status', 'signIn', 'signOut'] as const;
export type TeamsOp = (typeof TEAMS_OPS)[number];

export interface TeamsRequest {
  type: 'TEAMS';
  op: TeamsOp;
}

/**
 * Everything else a page can ask for — see ./operations.ts, which is also
 * what the worker validates `params` against before it calls the server.
 */
export interface TeamsOperationRequest<K extends TeamsOpName = TeamsOpName> {
  type: 'TEAMS_OP';
  op: K;
  params: ParamsOf<K>;
}

/**
 * An operation's answer. Never an `Error`: only what crosses `sendMessage`
 * cleanly, and never anything the page didn't ask for.
 */
export type TeamsResult<T> =
  { ok: true; data: T } | { ok: false; error: TeamsErrorCode; fields?: string[] };

export type ResultFor<K extends TeamsOpName> = TeamsResult<ResultOf<K>>;

export type TeamsStatus =
  /** This build has no Teams. */
  | { state: 'unavailable' }
  /** Teams is available but the user hasn't turned it on (or turned it off). */
  | { state: 'permission_needed' }
  | { state: 'signed_out' }
  /**
   * Signed in. `me` is the server's latest answer, or null when it couldn't be
   * reached just now (the reply's `error` says why).
   */
  | { state: 'signed_in'; me: MeResponse | null };

export interface TeamsReply {
  status: TeamsStatus;
  /** Set when the requested operation failed; `status` is still current. */
  error?: TeamsErrorCode;
}

export function isTeamsRequest(message: unknown): message is TeamsRequest {
  if (!message || typeof message !== 'object') return false;
  const m = message as Record<string, unknown>;
  return m.type === 'TEAMS' && (TEAMS_OPS as readonly unknown[]).includes(m.op);
}

export function isTeamsOperationRequest(message: unknown): message is TeamsOperationRequest {
  if (!message || typeof message !== 'object') return false;
  const m = message as Record<string, unknown>;
  return m.type === 'TEAMS_OP' && isOperationName(m.op);
}
