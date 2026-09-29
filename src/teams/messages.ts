import type { MeResponse } from '@hamesh/teams-contract';
import type { TeamsErrorCode } from './errors';

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
