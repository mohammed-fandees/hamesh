import type { MeResponse } from '@hamesh/teams-contract';
import type { TeamsErrorCode } from './errors';
import { isOperationName, type TeamsOpName } from './operation-names';
import type { ParamsOf, ResultOf } from './operations';
import type { CachedTeamNote } from './page-cache';
import type { CachedFolder } from './sync-store';

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

/**
 * The team-note cache, as one of Hamesh's own pages reads it.
 *
 * A local read, not a request: `notes` answers from what the last pull left on
 * this device, and `sync` asks the worker to pull now (after sharing something,
 * say, so the list does not wait for a poke). The cache itself is written only
 * by the worker.
 *
 * The content script uses none of this — it reads the page's own cached notes
 * straight from `chrome.storage.local` (see ./page-cache.ts), so the rule that
 * only extension pages may send Teams messages stays exactly as it was.
 */
export const TEAMS_CACHE_OPS = ['notes', 'sync'] as const;
export type TeamsCacheOp = (typeof TEAMS_CACHE_OPS)[number];

export interface TeamsCacheRequest {
  type: 'TEAMS_CACHE';
  op: TeamsCacheOp;
  teamId: string;
}

export interface TeamCacheSnapshot {
  notes: CachedTeamNote[];
  folders: CachedFolder[];
  /** When the last complete pull finished, or 0 if there has not been one. */
  syncedAt: number;
}

export type TeamCacheResult = TeamsResult<TeamCacheSnapshot>;

/**
 * The worker telling Hamesh's own pages that something changed in a team, so a
 * page already showing it can catch up.
 *
 * The only message that travels worker → page, and it carries ids and nothing
 * else — the same rule the socket it comes from follows. A page that cares
 * fetches through the ordinary authorized path; a page that does not, ignores
 * it. Broadcast with `runtime.sendMessage`, which reaches the extension's own
 * pages and never a content script.
 */
export interface TeamsEvent {
  type: 'TEAMS_EVENT';
  event: 'comments';
  teamId: string;
  noteId: string;
}

export function isTeamsEvent(message: unknown): message is TeamsEvent {
  if (!message || typeof message !== 'object') return false;
  const m = message as Record<string, unknown>;
  return (
    m.type === 'TEAMS_EVENT' &&
    m.event === 'comments' &&
    typeof m.teamId === 'string' &&
    typeof m.noteId === 'string'
  );
}

/**
 * A session handed straight to the worker, for a development build pointed at a
 * server running on this machine.
 *
 * Signing in needs Google, and Google needs a redirect URI registered for this
 * exact build — which is a lot of ceremony for trying a feature against
 * `wrangler dev`. The local server can mint a session row directly (see the API
 * repo's `dev:session`), and this is how that token reaches the one place
 * allowed to hold one.
 *
 * It is not a way past anything. The token has to be one the server already
 * issued — a made-up one is refused on the first request, like any other — and
 * the worker only handles this at all in a build that asked for it
 * (`WXT_TEAMS_DEV_SIGN_IN`), from Hamesh's own pages, as with every other Teams
 * message.
 */
export interface TeamsDevSignIn {
  type: 'TEAMS_DEV_SIGN_IN';
  token: string;
}

export function isTeamsDevSignIn(message: unknown): message is TeamsDevSignIn {
  if (!message || typeof message !== 'object') return false;
  const m = message as Record<string, unknown>;
  // The same shape the server issues: 32 bytes, base64url.
  return (
    m.type === 'TEAMS_DEV_SIGN_IN' &&
    typeof m.token === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(m.token)
  );
}

export function isTeamsCacheRequest(message: unknown): message is TeamsCacheRequest {
  if (!message || typeof message !== 'object') return false;
  const m = message as Record<string, unknown>;
  return (
    m.type === 'TEAMS_CACHE' &&
    (TEAMS_CACHE_OPS as readonly unknown[]).includes(m.op) &&
    typeof m.teamId === 'string'
  );
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
