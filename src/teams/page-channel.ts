import { MAX_COMMENT_LENGTH } from '@hamesh/teams-contract/mentions';
import type { Anchor } from '@/domain/note';
import type { TeamsErrorCode } from './errors';

/**
 * The one narrow way a web page's content script reaches the Teams worker.
 *
 * Everything else about Teams is answered only to Hamesh's own pages (see
 * `isExtensionPageSender`): the content script runs inside whatever site is
 * open, so it is never handed the session, and it draws team notes from what
 * the worker already cached in storage. A shared note's popup on the page,
 * though, shows the latest of its discussion and takes a reply, and the
 * composer can put a new note straight into a team. Those few things come
 * through here, and nothing else:
 *
 * - `thread` / `reply`: only for a team note the worker has cached for the
 *   very page the request comes from (its URL is the browser's, not the
 *   page's say-so);
 * - `share`: only a note this device holds for that page — the worker reads
 *   the note itself, so no text from the page is trusted as the note;
 * - `delete`: only a team note the worker has cached for that page — the
 *   server decides whether this member may;
 * - `reanchor`: puts a team note that lost its place somewhere new on that same
 *   page; only a note the worker has cached for it, only from its author, and
 *   the server decides again;
 * - `open`: opens the note's discussion beside the page (Chrome's side panel),
 *   or its page in Hamesh (`in: 'hamesh'`); carries no data.
 * - `join`: only from Hamesh's own join page (`./join-link.ts`), with the
 *   invitation token from its link. The worker keeps it for the Teams page,
 *   which shows the invitation before anything is accepted.
 *
 * The server still decides every one of them, as it does for the Library.
 */

/** A server-issued id, the contract's own pattern. */
const ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

export type PageRequest =
  | { op: 'thread'; teamId: string; noteId: string }
  | { op: 'reply'; teamId: string; noteId: string; body: string; requestId: string }
  | { op: 'share'; noteId: string; teamId: string; folderId: string | null }
  | { op: 'destinations' }
  | { op: 'delete'; teamId: string; noteId: string }
  | { op: 'reanchor'; teamId: string; noteId: string; anchor: Anchor }
  | { op: 'open'; teamId: string; noteId: string; in?: 'panel' | 'hamesh' }
  | { op: 'join'; token: string };

export interface TeamsPageMessage {
  type: 'TEAMS_PAGE';
  request: PageRequest;
}

/** One line of a discussion, as the page shows it: who, when, what. */
/** A run of what was said: words, or a person named with @ (by name). */
export type ThreadText = { text: string } | { mention: string };

export interface ThreadLine {
  id: string;
  /** The author's name as the team lists them; null once they have left. Their
   *  face is the page's own copy (`people-cache.ts`), found by `authorId`. */
  author: string | null;
  authorId: string | null;
  /** What was said, with each @ already the name it stands for. */
  parts: ThreadText[];
  createdAt: number;
}

/** The latest of a note's discussion, and how long the whole of it is. */
export interface ThreadPreview {
  total: number;
  latest: ThreadLine[];
}

/** A team a new note can go to, with its folders. */
export interface Destination {
  id: string;
  name: string;
  folders: { id: string; name: string; parentId: string | null }[];
}

export type PageResult<T> = { ok: true; data: T } | { ok: false; error: TeamsErrorCode };

const isId = (v: unknown): v is string => typeof v === 'string' && ULID.test(v);

/** The most an anchor may weigh, written out: the contract bounds each field, and this bounds
 *  the whole before the worker spends anything on it. */
const MAX_ANCHOR_JSON = 16_000;

/** A text or element anchor in its documented shape. The contract checks every field again
 *  before anything is sent; this keeps the worker from even reading a note for junk. */
function isPlaceAnchor(value: unknown): value is Anchor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  let size: number;
  try {
    size = JSON.stringify(value).length;
  } catch {
    return false;
  }
  if (size > MAX_ANCHOR_JSON) return false;
  const a = value as Record<string, unknown>;
  if (a.type === 'text') {
    return (
      a.version === 1 &&
      typeof a.exact === 'string' &&
      a.exact.length > 0 &&
      !!a.context &&
      typeof a.context === 'object' &&
      !!a.textPosition &&
      typeof a.textPosition === 'object'
    );
  }
  if (a.type !== undefined && a.type !== 'element') return false;
  const signals = a.signals as Record<string, unknown> | undefined;
  return (
    !!signals &&
    typeof signals === 'object' &&
    typeof signals.tagName === 'string' &&
    signals.tagName.length > 0 &&
    !!a.fallbackDocumentPosition &&
    typeof a.fallbackDocumentPosition === 'object'
  );
}

/** Whether `message` is a well-formed page request — nothing else is answered. */
export function isTeamsPageMessage(message: unknown): message is TeamsPageMessage {
  if (!message || typeof message !== 'object') return false;
  const m = message as { type?: unknown; request?: unknown };
  if (m.type !== 'TEAMS_PAGE' || !m.request || typeof m.request !== 'object') return false;
  const r = m.request as Record<string, unknown>;
  switch (r.op) {
    case 'thread':
    case 'delete':
      return isId(r.teamId) && isId(r.noteId);
    case 'reanchor':
      return isId(r.teamId) && isId(r.noteId) && isPlaceAnchor(r.anchor);
    case 'open':
      return (
        isId(r.teamId) &&
        isId(r.noteId) &&
        (r.in === undefined || r.in === 'panel' || r.in === 'hamesh')
      );
    case 'reply':
      return (
        isId(r.teamId) &&
        isId(r.noteId) &&
        typeof r.body === 'string' &&
        r.body.trim().length > 0 &&
        r.body.length <= MAX_COMMENT_LENGTH &&
        typeof r.requestId === 'string' &&
        r.requestId.length > 0 &&
        r.requestId.length <= 64
      );
    case 'share':
      return (
        typeof r.noteId === 'string' &&
        r.noteId.length > 0 &&
        r.noteId.length <= 64 &&
        isId(r.teamId) &&
        (r.folderId === null || isId(r.folderId))
      );
    case 'destinations':
      return true;
    case 'join':
      return typeof r.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(r.token);
    default:
      return false;
  }
}

/**
 * Whether a message comes from this extension's own content script, in the top
 * frame of an ordinary web page. Its URL is then the page's, as the browser
 * reports it — what the requests above are checked against.
 */
export function isContentScriptSender(
  sender: { id?: string; url?: string; tab?: unknown; frameId?: number },
  runtimeId: string,
): boolean {
  if (sender.id !== runtimeId || !sender.tab || sender.frameId !== 0 || !sender.url) return false;
  try {
    const { protocol } = new URL(sender.url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}
