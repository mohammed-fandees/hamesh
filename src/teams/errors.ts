// From the contract's own error module rather than its barrel: these are a
// plain list of strings, and going through the barrel would pull every schema
// (and zod with them) into builds that have no Teams.
import { ERROR_CODES, type ErrorCode } from '@hamesh/teams-contract/errors';

/**
 * Everything a Teams call can fail with: the server's stable error codes, plus
 * the few that only the client can observe.
 */
export type TeamsErrorCode =
  | ErrorCode
  /** The request never got an answer (offline, DNS, timeout). */
  | 'network'
  /** This build has no Teams configuration. */
  | 'not_configured'
  /** The user has not granted (or has since removed) the Teams permissions. */
  | 'permission_missing'
  /** The user closed or declined the Google sign-in window. */
  | 'cancelled'
  /** The server answered with something that does not match the contract. */
  | 'bad_response'
  /** There is no session on this device. */
  | 'signed_out';

export class TeamsError extends Error {
  constructor(
    readonly code: TeamsErrorCode,
    readonly fields?: string[],
  ) {
    super(code);
    this.name = 'TeamsError';
  }
}

const SERVER_CODES = new Set<string>(ERROR_CODES);

/** Reads a server error body, trusting nothing about its shape. */
export function errorFromBody(body: unknown): TeamsError {
  if (body && typeof body === 'object' && 'error' in body) {
    const { error, fields } = body as { error: unknown; fields?: unknown };
    if (typeof error === 'string' && SERVER_CODES.has(error)) {
      const safeFields = Array.isArray(fields)
        ? fields.filter((f): f is string => typeof f === 'string').slice(0, 20)
        : undefined;
      return new TeamsError(error as ErrorCode, safeFields);
    }
  }
  return new TeamsError('bad_response');
}

/** Any thrown value as a `TeamsErrorCode`, for replies that must not carry an `Error`. */
export function codeOf(err: unknown): TeamsErrorCode {
  return err instanceof TeamsError ? err.code : 'internal';
}
