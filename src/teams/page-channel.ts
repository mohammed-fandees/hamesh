import { MAX_COMMENT_LENGTH } from '@hamesh/teams-contract/mentions';
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
 * - `open`: opens the note's discussion in Hamesh's own page; carries no data.
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
  | { op: 'open'; teamId: string; noteId: string };

export interface TeamsPageMessage {
  type: 'TEAMS_PAGE';
  request: PageRequest;
}

/** One line of a discussion, as the page shows it: who, when, what. */
export interface ThreadLine {
  id: string;
  /** The author's name as the team lists them; null once they have left. */
  author: string | null;
  authorId: string | null;
  body: string;
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

/** Whether `message` is a well-formed page request — nothing else is answered. */
export function isTeamsPageMessage(message: unknown): message is TeamsPageMessage {
  if (!message || typeof message !== 'object') return false;
  const m = message as { type?: unknown; request?: unknown };
  if (m.type !== 'TEAMS_PAGE' || !m.request || typeof m.request !== 'object') return false;
  const r = m.request as Record<string, unknown>;
  switch (r.op) {
    case 'thread':
    case 'open':
      return isId(r.teamId) && isId(r.noteId);
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
