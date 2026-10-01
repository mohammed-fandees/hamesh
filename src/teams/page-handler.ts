import type { Comment } from '@hamesh/teams-contract';
import { MENTION_PATTERN } from '@hamesh/teams-contract/mentions';
import { generatePageKey } from '@/domain/page-key';
import type { NotesRepository } from '@/storage/notes-repository';
import type {
  Destination,
  PageRequest,
  PageResult,
  ThreadLine,
  ThreadPreview,
  ThreadText,
} from './page-channel';
import { readPageBucket, readTeamIndex } from './page-cache';
import type { TeamsService } from './service';
import { shareParams } from './share-request';

/** How much of a discussion the page's popup shows. */
const PREVIEW_LINES = 2;
/** How many pages of comments are read to find the latest — a discussion
 *  longer than this is previewed from what was read, which is plenty. */
const MAX_PAGES = 5;

export interface PageHandlerDeps {
  service: TeamsService;
  notes: NotesRepository;
  /** Opens one of Hamesh's own pages in a new tab. */
  openPage: (path: string) => Promise<void>;
}

/**
 * Answers a web page's content script — see `./page-channel.ts` for what may
 * be asked and why. `pageUrl` is the browser's URL for the requesting frame,
 * never one the page supplied: every request is checked against the notes
 * this device holds for exactly that page.
 */
export async function handlePageRequest(
  deps: PageHandlerDeps,
  request: PageRequest,
  pageUrl: string,
): Promise<PageResult<unknown>> {
  const pageKey = generatePageKey(pageUrl);

  /** Whether this team note is one the worker holds for this very page. */
  const onThisPage = async (teamId: string, noteId: string) =>
    (await readPageBucket(pageKey)).some((n) => n.id === noteId && n.teamId === teamId);

  switch (request.op) {
    case 'thread': {
      if (!(await onThisPage(request.teamId, request.noteId))) return notFound();
      return readThread(deps.service, request.teamId, request.noteId);
    }
    case 'reply': {
      if (!(await onThisPage(request.teamId, request.noteId))) return notFound();
      const created = await deps.service.perform('comments.create', {
        teamId: request.teamId,
        noteId: request.noteId,
        requestId: request.requestId,
        body: request.body,
      });
      return created.ok ? { ok: true, data: null } : created;
    }
    case 'share': {
      // The note as this device holds it for this page — not as the page says.
      const note = (await deps.notes.getForPage(pageKey)).find((n) => n.id === request.noteId);
      if (!note) return notFound();
      const shared = await deps.service.perform(
        'notes.share',
        shareParams(note, request.teamId, request.folderId),
      );
      if (!shared.ok) return shared;
      // Sharing moves the note: the team's copy, pulled back by the write, is
      // what the page draws now, and a personal one too would draw it twice.
      await deps.notes.delete(note.id, pageKey);
      return { ok: true, data: null };
    }
    case 'destinations':
      return { ok: true, data: await destinations(deps.service) };
    case 'delete': {
      if (!(await onThisPage(request.teamId, request.noteId))) return notFound();
      // The pull that follows a delete takes it off this page's shelf, and the
      // page redraws from that, as it does for any change.
      const gone = await deps.service.perform('notes.delete', {
        teamId: request.teamId,
        noteId: request.noteId,
      });
      return gone.ok ? { ok: true, data: null } : gone;
    }
    case 'open': {
      const params = new URLSearchParams({
        view: 'teams',
        team: request.teamId,
        page: 'note',
        note: request.noteId,
      });
      await deps.openPage(`/notes.html?${params}`);
      return { ok: true, data: null };
    }
  }
}

const notFound = (): PageResult<never> => ({ ok: false, error: 'not_found' });

/** The latest lines of a note's discussion, with each author's name. */
async function readThread(
  service: TeamsService,
  teamId: string,
  noteId: string,
): Promise<PageResult<ThreadPreview>> {
  const comments: Comment[] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await service.perform('comments.list', {
      teamId,
      noteId,
      ...(after ? { after } : {}),
    });
    if (!result.ok) return result;
    comments.push(...result.data.comments);
    if (!result.data.nextAfter) break;
    after = result.data.nextAfter;
  }

  // Every line, top-level and replies alike, in the order it was said.
  const lines: Comment[] = [];
  let total = 0;
  for (const comment of comments) {
    if (!comment.deleted) {
      lines.push(comment);
      total += 1;
    }
    total += comment.replyCount ?? 0;
    lines.push(...(comment.replies ?? []).filter((r) => !r.deleted));
  }
  lines.sort((a, b) => a.createdAt - b.createdAt);

  const members = await service.perform('members.list', { teamId });
  const names = new Map(
    members.ok ? members.data.members.map((m) => [m.userId, m.displayName] as const) : [],
  );
  const latest: ThreadLine[] = lines.slice(-PREVIEW_LINES).map((line) => ({
    id: line.id,
    author: line.authorId ? (names.get(line.authorId) ?? null) : null,
    authorId: line.authorId,
    parts: partsOf(line.body, names),
    createdAt: line.createdAt,
  }));
  return { ok: true, data: { total, latest } };
}

/**
 * A comment's words, its mentions turned into the names they stand for: the
 * page holds no member list, and draws a name as a name, not as an id.
 */
export function partsOf(body: string, names: ReadonlyMap<string, string>): ThreadText[] {
  const parts: ThreadText[] = [];
  let from = 0;
  for (const match of body.matchAll(MENTION_PATTERN)) {
    if (match.index > from) parts.push({ text: body.slice(from, match.index) });
    parts.push({ mention: names.get(match[1]) ?? '…' });
    from = match.index + match[0].length;
  }
  if (from < body.length) parts.push({ text: body.slice(from) });
  return parts;
}

/** The teams a new note can go to, each with its folders as last pulled. */
async function destinations(service: TeamsService): Promise<Destination[]> {
  const { teams } = await readTeamIndex();
  const out: Destination[] = [];
  for (const team of teams) {
    const snapshot = await service.readCache('notes', team.id);
    out.push({
      id: team.id,
      name: team.name,
      folders: snapshot.ok
        ? snapshot.data.folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }))
        : [],
    });
  }
  return out;
}
