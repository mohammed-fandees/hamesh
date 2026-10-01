import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetStorage } from './fake-storage';
import { writePageBucket, writeTeamIndex, type CachedTeamNote } from '@/teams/page-cache';
import { isContentScriptSender, isTeamsPageMessage } from '@/teams/page-channel';
import { handlePageRequest, type PageHandlerDeps } from '@/teams/page-handler';
import { generatePageKey } from '@/domain/page-key';
import type { Note } from '@/domain/note';
import type { NotesRepository } from '@/storage/notes-repository';
import type { TeamsService } from '@/teams/service';

const TEAM = '01J0000000000000000000000A';
const OTHER_TEAM = '01J0000000000000000000000Z';
const NOTE = '01J000000000000000000000N1';
const SARA = '01J0000000000000000000000S';
const PAGE = 'https://example.test/article';
const ELSEWHERE = 'https://example.test/another';
const RUNTIME = 'extension-id';

const anchor = {
  primarySelector: 'p',
  signals: { tagName: 'p' },
  fallbackDocumentPosition: { x: 0, y: 0 },
};

const cached = (overrides: Partial<CachedTeamNote> = {}): CachedTeamNote => ({
  id: NOTE,
  teamId: TEAM,
  originalUrl: PAGE,
  pageTitle: 'An article',
  content: 'shared',
  anchor,
  folderId: null,
  authorId: SARA,
  version: 1,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const local: Note = {
  id: 'local-note',
  schemaVersion: 1,
  pageKey: generatePageKey(PAGE),
  originalUrl: PAGE,
  content: 'mine, as this device holds it',
  anchor,
  workspaceId: 'default',
  pageContext: { title: 'An article' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function deps(answers: Record<string, unknown> = {}) {
  const perform = vi.fn(async (op: string) =>
    op in answers ? { ok: true, data: answers[op] } : { ok: true, data: null },
  );
  const readCache = vi.fn(async () => ({
    ok: true,
    data: { notes: [], folders: [{ id: 'F', name: 'Papers', parentId: null }], syncedAt: 1 },
  }));
  const notes = {
    getForPage: vi.fn(async (pageKey: string) => (pageKey === local.pageKey ? [local] : [])),
    delete: vi.fn(async () => true),
  };
  const openPage = vi.fn(async () => {});
  const all = {
    service: { perform, readCache } as unknown as TeamsService,
    notes: notes as unknown as NotesRepository,
    openPage,
  } satisfies PageHandlerDeps;
  return { all, perform, notes, openPage };
}

beforeEach(async () => {
  resetStorage();
  await writePageBucket(generatePageKey(PAGE), [cached()]);
  await writeTeamIndex([{ id: TEAM, name: 'Research' }], 1);
});

describe('what a page may send', () => {
  const message = (request: object) => ({ type: 'TEAMS_PAGE', request });

  it('takes the few known requests, well formed', () => {
    expect(isTeamsPageMessage(message({ op: 'thread', teamId: TEAM, noteId: NOTE }))).toBe(true);
    expect(
      isTeamsPageMessage(
        message({ op: 'reply', teamId: TEAM, noteId: NOTE, body: 'yes', requestId: 'r-1' }),
      ),
    ).toBe(true);
    expect(
      isTeamsPageMessage(message({ op: 'share', noteId: 'local', teamId: TEAM, folderId: null })),
    ).toBe(true);
  });

  it('refuses anything else — other operations, malformed ids, empty or oversized replies', () => {
    expect(isTeamsPageMessage(message({ op: 'members.remove', teamId: TEAM }))).toBe(false);
    expect(isTeamsPageMessage(message({ op: 'thread', teamId: 'nope', noteId: NOTE }))).toBe(false);
    for (const body of ['', '   ', 'x'.repeat(4001)]) {
      expect(
        isTeamsPageMessage(
          message({ op: 'reply', teamId: TEAM, noteId: NOTE, body, requestId: 'r' }),
        ),
      ).toBe(false);
    }
    expect(isTeamsPageMessage({ type: 'TEAMS_OP', op: 'notes.delete' })).toBe(false);
  });

  it('answers only this extension’s own content script, in a page’s top frame', () => {
    const tab = { id: 1 };
    expect(isContentScriptSender({ id: RUNTIME, tab, frameId: 0, url: PAGE }, RUNTIME)).toBe(true);
    expect(isContentScriptSender({ id: 'another', tab, frameId: 0, url: PAGE }, RUNTIME)).toBe(
      false,
    );
    expect(isContentScriptSender({ id: RUNTIME, tab, frameId: 3, url: PAGE }, RUNTIME)).toBe(false);
    expect(isContentScriptSender({ id: RUNTIME, frameId: 0, url: PAGE }, RUNTIME)).toBe(false);
    expect(
      isContentScriptSender(
        { id: RUNTIME, tab, frameId: 0, url: `chrome-extension://${RUNTIME}/notes.html` },
        RUNTIME,
      ),
    ).toBe(false);
  });
});

describe('a shared note’s discussion, from the page', () => {
  it('reads the latest of it, with names, and mentions as names', async () => {
    const { all } = deps({
      'comments.list': {
        comments: [
          {
            id: 'c1',
            parentId: null,
            authorId: SARA,
            body: 'first',
            mentions: [],
            createdAt: 1,
            editedAt: null,
            deleted: false,
            replyCount: 1,
            replies: [
              {
                id: 'c2',
                parentId: 'c1',
                authorId: SARA,
                body: `thanks <@${SARA}>`,
                mentions: [SARA],
                createdAt: 3,
                editedAt: null,
                deleted: false,
              },
            ],
          },
          {
            id: 'c3',
            parentId: null,
            authorId: null,
            body: 'from someone gone',
            mentions: [],
            createdAt: 2,
            editedAt: null,
            deleted: false,
            replyCount: 0,
          },
        ],
        nextAfter: null,
      },
      'members.list': { members: [{ userId: SARA, displayName: 'Sara', role: 'member' }] },
    });
    const result = await handlePageRequest(all, { op: 'thread', teamId: TEAM, noteId: NOTE }, PAGE);
    expect(result).toEqual({
      ok: true,
      data: {
        total: 3,
        latest: [
          {
            id: 'c3',
            author: null,
            avatarUrl: null,
            authorId: null,
            body: 'from someone gone',
            createdAt: 2,
          },
          {
            id: 'c2',
            author: 'Sara',
            avatarUrl: null,
            authorId: SARA,
            body: 'thanks @Sara',
            createdAt: 3,
          },
        ],
      },
    });
  });

  it('answers nothing about a note that is not on the page asking', async () => {
    const { all, perform } = deps();
    for (const [teamId, url] of [
      [TEAM, ELSEWHERE],
      [OTHER_TEAM, PAGE],
    ] as const) {
      const result = await handlePageRequest(all, { op: 'thread', teamId, noteId: NOTE }, url);
      expect(result).toEqual({ ok: false, error: 'not_found' });
      const reply = await handlePageRequest(
        all,
        { op: 'reply', teamId, noteId: NOTE, body: 'hi', requestId: 'r' },
        url,
      );
      expect(reply).toEqual({ ok: false, error: 'not_found' });
    }
    expect(perform, 'and the server is never asked').not.toHaveBeenCalled();
  });

  it('posts a reply to a note on this page', async () => {
    const { all, perform } = deps();
    const result = await handlePageRequest(
      all,
      { op: 'reply', teamId: TEAM, noteId: NOTE, body: 'agreed', requestId: 'r-1' },
      PAGE,
    );
    expect(result).toEqual({ ok: true, data: null });
    expect(perform).toHaveBeenCalledWith('comments.create', {
      teamId: TEAM,
      noteId: NOTE,
      requestId: 'r-1',
      body: 'agreed',
    });
  });
});

describe('sharing from the page', () => {
  it('shares the note as this device holds it, then lets the local copy go', async () => {
    const { all, perform, notes } = deps();
    const result = await handlePageRequest(
      all,
      { op: 'share', noteId: local.id, teamId: TEAM, folderId: 'F0000000000000000000000000' },
      PAGE,
    );
    expect(result).toEqual({ ok: true, data: null });
    expect(perform).toHaveBeenCalledWith(
      'notes.share',
      expect.objectContaining({ teamId: TEAM, requestId: local.id, content: local.content }),
    );
    expect(notes.delete).toHaveBeenCalledWith(local.id, local.pageKey);
  });

  it('shares nothing it does not hold for that page', async () => {
    const { all, perform, notes } = deps();
    const result = await handlePageRequest(
      all,
      { op: 'share', noteId: local.id, teamId: TEAM, folderId: null },
      ELSEWHERE,
    );
    expect(result).toEqual({ ok: false, error: 'not_found' });
    expect(perform).not.toHaveBeenCalled();
    expect(notes.delete).not.toHaveBeenCalled();
  });

  it('keeps the local copy when the server refuses', async () => {
    const { all, perform, notes } = deps();
    perform.mockResolvedValueOnce({ ok: false, error: 'limit_reached' } as never);
    const result = await handlePageRequest(
      all,
      { op: 'share', noteId: local.id, teamId: TEAM, folderId: null },
      PAGE,
    );
    expect(result).toEqual({ ok: false, error: 'limit_reached' });
    expect(notes.delete).not.toHaveBeenCalled();
  });

  it('lists the teams a note can go to, with their folders', async () => {
    const { all } = deps();
    const result = await handlePageRequest(all, { op: 'destinations' }, PAGE);
    expect(result).toEqual({
      ok: true,
      data: [
        { id: TEAM, name: 'Research', folders: [{ id: 'F', name: 'Papers', parentId: null }] },
      ],
    });
  });
});
