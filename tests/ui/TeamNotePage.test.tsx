// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TeamNotePage } from '@/ui/teams/TeamNotePage';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { TeamsPage } from '@/ui/teams/useTeams';
import type { CachedTeamNote } from '@/teams/page-cache';
import type { TeamAction, TeamResponse } from '@hamesh/teams-contract';

const strings = getTeamsStrings('en');
const TEAM = '01J0000000000000000000000A';
const ME = '01J0000000000000000000000Z';
const MATE = '01J0000000000000000000000V';
const FOLDER = '01J0000000000000000000000F';
const NOTE = '01J0000000000000000000000N';

const ANCHOR = {
  primarySelector: 'p',
  signals: { tagName: 'p' },
  fallbackDocumentPosition: { x: 0, y: 0 },
};

function cached(overrides: Partial<CachedTeamNote> = {}): CachedTeamNote {
  return {
    id: NOTE,
    teamId: TEAM,
    originalUrl: 'https://example.test/article',
    pageTitle: 'An article',
    content: 'my shared thought',
    anchor: ANCHOR,
    folderId: null,
    authorId: ME,
    version: 4,
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

const ALL: TeamAction[] = [
  'team.view',
  'notes.edit_own',
  'notes.edit_any',
  'notes.delete_own',
  'notes.delete_any',
  'notes.unshare_own',
  'notes.file_own',
  'notes.file_any',
  'folders.manage',
];

function team(capabilities: TeamAction[] = ALL): TeamResponse {
  return {
    team: { id: TEAM, name: 'Alpha', role: 'owner', state: 'active', readOnlyUntil: null },
    capabilities,
    serverTime: 1,
  };
}

const folder = { id: FOLDER, parentId: null, name: 'Reading', createdAt: 1, updatedAt: 1 };

/** A page whose answers a test steers, recording what was asked of the worker. */
function fakePage(
  snapshot: { notes: CachedTeamNote[]; folders: unknown[] },
  answers: Record<string, unknown> = { 'comments.list': { comments: [], nextAfter: null } },
) {
  const calls: { op: string; params: unknown }[] = [];
  const cache = vi.fn(async () => ({ ...snapshot, syncedAt: 1_700_000_000_000 }) as never);
  const run = vi.fn(async (op: string, params: unknown) => {
    calls.push({ op, params });
    return (Object.hasOwnProperty.call(answers, op) ? answers[op] : undefined) as never;
  });
  const page = {
    status: { state: 'signed_in', me: null },
    me: null,
    failure: null,
    busy: false,
    working: () => false,
    failed: () => null,
    clearError: vi.fn(),
    refresh: vi.fn(async () => {}),
    run,
    cache,
    onEvent: () => () => {},
  } as unknown as TeamsPage;
  return { page, calls, cache, run };
}

const personal = {
  forget: vi.fn(async (_noteId: string) => {}),
  keep: vi.fn(async (_note: { content: string }) => {}),
};

const view = (page: TeamsPage, capabilities?: TeamAction[], onGone = vi.fn(), onRoute = vi.fn()) =>
  render(
    <TeamNotePage
      strings={strings}
      lang="en"
      page={page}
      team={team(capabilities)}
      myUserId={ME}
      members={[]}
      noteId={NOTE}
      personal={personal}
      onGone={onGone}
      onRoute={onRoute}
    />,
  );

/** Presses the note's own "are you sure" button. */
const confirmWith = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('one shared note', () => {
  it('reads what this device holds, pulling first, and shows the note with its trail back', async () => {
    const { page, cache } = fakePage({ notes: [cached()], folders: [] });
    const onRoute = vi.fn();
    view(page, undefined, vi.fn(), onRoute);

    expect(await screen.findByText('my shared thought')).toBeInTheDocument();
    expect(cache).toHaveBeenCalledWith(TEAM, 'sync', 'notes.reload');
    expect(screen.getByRole('link', { name: 'An article' })).toHaveAttribute(
      'href',
      'https://example.test/article',
    );

    // Teams / Alpha / the note — every step but the last is a way back.
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(onRoute).toHaveBeenCalledWith({ page: 'overview', teamId: TEAM });
    fireEvent.click(screen.getByRole('button', { name: strings.teams }));
    expect(onRoute).toHaveBeenLastCalledWith({ page: 'overview', teamId: null });
  });

  it('says so, with the way back, when the note has gone from the team', async () => {
    const onGone = vi.fn();
    const { page } = fakePage({ notes: [], folders: [] });
    view(page, undefined, onGone);

    expect(await screen.findByText(strings.noteGoneTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: strings.backToTeam('Alpha') }));
    expect(onGone).toHaveBeenCalled();
  });

  it('quotes the version it saw when filing a note, so a stale move is refused', async () => {
    const { page, calls } = fakePage({ notes: [cached()], folders: [folder] });
    view(page);
    await screen.findByText('my shared thought');

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: FOLDER } });
    await waitFor(() => expect(calls.some((c) => c.op === 'notes.update')).toBe(true));
    expect(calls.find((c) => c.op === 'notes.update')!.params).toEqual({
      teamId: TEAM,
      noteId: NOTE,
      version: 4,
      folderId: FOLDER,
    });
  });

  it('asks on the note before taking it back, keeps it once told to, and goes back', async () => {
    const note = cached();
    const onGone = vi.fn();
    const { page, calls } = fakePage(
      { notes: [note], folders: [] },
      {
        'comments.list': { comments: [], nextAfter: null },
        'notes.unshare': { note: { ...note, content: 'as it was shared' } },
      },
    );
    view(page, undefined, onGone);
    await screen.findByText('my shared thought');

    fireEvent.click(screen.getByRole('button', { name: strings.unshareNote }));
    // The question is asked here, in the page — never in a browser dialog.
    expect(screen.getByText(strings.unshareConfirm)).toBeInTheDocument();
    expect(
      calls.some((c) => c.op === 'notes.unshare'),
      'nothing has happened yet',
    ).toBe(false);

    confirmWith(strings.unshareNote);
    await waitFor(() => expect(personal.keep).toHaveBeenCalled());
    expect(calls.find((c) => c.op === 'notes.unshare')).toEqual({
      op: 'notes.unshare',
      params: { teamId: TEAM, noteId: note.id },
    });
    expect(personal.keep.mock.calls[0]![0]).toMatchObject({ content: 'as it was shared' });
    expect(onGone).toHaveBeenCalled();
  });

  it('lets the question be backed out of, and then nothing happens', async () => {
    const { page, calls } = fakePage({ notes: [cached()], folders: [] });
    view(page);
    await screen.findByText('my shared thought');

    fireEvent.click(screen.getByRole('button', { name: strings.deleteSharedNote }));
    expect(screen.getByText(strings.deleteSharedConfirm)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: strings.keepIt }));

    expect(screen.queryByText(strings.deleteSharedConfirm)).not.toBeInTheDocument();
    expect(calls.some((c) => c.op === 'notes.delete')).toBe(false);
  });

  it('offers nothing about someone else’s note beyond what the server allowed', async () => {
    const theirs = cached({ authorId: MATE });
    const { page } = fakePage({ notes: [theirs], folders: [] });
    // Only "own" capabilities: someone else's note is not this reader's to touch.
    view(page, ['team.view', 'notes.edit_own', 'notes.delete_own', 'notes.unshare_own']);
    await screen.findByText('my shared thought');

    expect(screen.queryByRole('button', { name: strings.unshareNote })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.editNote })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: strings.deleteSharedNote }),
    ).not.toBeInTheDocument();
  });

  it('lets an admin delete anyone’s note for everyone, once they have said so', async () => {
    const onGone = vi.fn();
    const theirs = cached({ authorId: MATE });
    const { page, calls } = fakePage(
      { notes: [theirs], folders: [] },
      { 'comments.list': { comments: [], nextAfter: null }, 'notes.delete': {} },
    );
    view(page, undefined, onGone);
    await screen.findByText('my shared thought');

    fireEvent.click(screen.getByRole('button', { name: strings.deleteSharedNote }));
    confirmWith(strings.deleteSharedNote);
    await waitFor(() => expect(calls.some((c) => c.op === 'notes.delete')).toBe(true));
    await waitFor(() => expect(onGone).toHaveBeenCalled());
  });

  it('edits a note against the version it saw', async () => {
    const { page, calls } = fakePage({ notes: [cached()], folders: [] });
    view(page);
    await screen.findByText('my shared thought');

    fireEvent.click(screen.getByRole('button', { name: strings.editNote }));
    fireEvent.change(screen.getByLabelText(strings.editNote), { target: { value: 'reworded' } });
    fireEvent.click(screen.getByRole('button', { name: strings.saveNote }));
    await waitFor(() => expect(calls.some((c) => c.op === 'notes.update')).toBe(true));
    expect(calls.find((c) => c.op === 'notes.update')!.params).toEqual({
      teamId: TEAM,
      noteId: NOTE,
      version: 4,
      content: 'reworded',
    });
  });

  it('carries the note’s discussion under it', async () => {
    const { page, calls } = fakePage({ notes: [cached()], folders: [] });
    view(page);
    await screen.findByText('my shared thought');

    expect(screen.getByRole('heading', { name: strings.comments })).toBeInTheDocument();
    await waitFor(() =>
      expect(calls.find((c) => c.op === 'comments.list')?.params).toEqual({
        teamId: TEAM,
        noteId: NOTE,
      }),
    );
  });
});
