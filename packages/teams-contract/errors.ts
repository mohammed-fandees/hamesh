/**
 * Error envelope and codes returned by every endpoint. Part of the public wire
 * contract: codes are stable, bodies
 * never carry internal detail.
 */
export const ERROR_CODES = [
  'invalid_request',
  'unauthenticated',
  'account_disabled',
  'forbidden',
  'not_found',
  'team_not_entitled',
  /** The caller needs an active plan of their own (e.g. to create a team). */
  'subscription_required',
  'team_locked',
  'limit_reached',
  'already_member',
  /** The owner must transfer ownership or delete the team before leaving. */
  'owner_must_transfer',
  'invitation_expired',
  'invitation_revoked',
  'invitation_used',
  /** A sync cursor older than the server keeps deletions for: resync from scratch. */
  'cursor_expired',
  'version_conflict',
  'conflict',
  'rate_limited',
  'unavailable',
  'internal',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorBody {
  error: ErrorCode;
  /** Present for `invalid_request`: which fields failed, never the values. */
  fields?: string[];
}
