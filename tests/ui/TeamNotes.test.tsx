// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TeamNotes } from '@/ui/teams/TeamNotes';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { TeamsPage } from '@/ui/teams/useTeams';
import type { CachedTeamNote } from '@/teams/page-cache';
import type { TeamAction, TeamResponse } from '@hamesh/teams-contract';

const strings = getTeamsStrings('en');
const TEAM = '01J0000000000000000000000A';
const ME = '01J0000000000000000000000U';
const MATE = '01J0000000000000000000000V';
const FOLDER = '01J0000000000000000000000F';

const ANCHOR = {
  primarySelector: 'p',
  signals: { tagName: 'p' },
  fallbackDocumentPosition: { x: 0, y: 0 },
};

function cached(overrides: Partial<CachedTeamNote> = {}): CachedTeamNote {
  return {
    id: '01J0000000000000000000000N',
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

/** A page whose answers a test steers, recording what was asked of the worker. */
function fakePage(
  snapshot: { notes: CachedTeamNote[]; folders: unknown[] },
  answers: Record<string, unknown> = {},
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
    error: null,
    busy: false,
    clearError: vi.fn(),
    refresh: vi.fn(async () => {}),
    run,
    cache,
  } as unknown as TeamsPage;
  return { page, calls, cache, run };
}

const personal = {
  forget: vi.fn(async (_noteId: string) => {}),
  keep: vi.fn(async (_note: { content: string }) => {}),
};

const members = [
  { userId: ME, displayName: 'Me', role: 'owner' as const, joinedAt: 1 },
  { userId: MATE, displayName: 'Sara', role: 'member' as const, joinedAt: 2 },
];

const view = (page: TeamsPage, capabilities?: TeamAction[]) =>
  render(
    <TeamNotes
      strings={strings}
      lang="en"
      page={page}
      team={team(capabilities)}
      myUserId={ME}
      members={members}
      personal={personal}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('a team’s shared notes', () => {
  it('reads what this device holds, pulling first, and shows it', async () => {
    const { page, cache } = fakePage({ notes: [cached()], folders: [] });
    view(page);

    expect(await screen.findByText('my shared thought')).toBeInTheDocument();
    expect(cache).toHaveBeenCalledWith(TEAM, 'sync');
    expect(screen.getByRole('link', { name: 'An article' })).toHaveAttribute(
      'href',
      'https://example.test/article',
    );
  });

  it('says so, plainly, when nothing has been shared yet', async () => {
    const { page } = fakePage({ notes: [], folders: [] });
    view(page);
    expect(await screen.findByText(strings.noSharedNotes)).toBeInTheDocument();
    expect(screen.getByText(strings.noTeamFolders)).toBeInTheDocument();
  });

  it('quotes the version it saw when filing a note, so a stale move is refused', async () => {
    const folders = [{ id: FOLDER, parentId: null, name: 'Reading', createdAt: 1, updatedAt: 1 }];
    const { page, calls } = fakePage({ notes: [cached()], folders });
    view(page);
    await screen.findByText('my shared thought');

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: FOLDER } });
    await waitFor(() => expect(calls.some((c) => c.op === 'notes.update')).toBe(true));
    expect(calls.find((c) => c.op === 'notes.update')!.params).toEqual({
      teamId: TEAM,
      noteId: cached().id,
      version: 4,
      folderId: FOLDER,
    });
  });

  it('keeps a note that has been taken back out of the team', async () => {
    const note = cached();
    const { page, calls } = fakePage(
      { notes: [note], folders: [] },
      { 'notes.unshare': { note: { ...note, content: 'as it was shared' } } },
    );
    view(page);
    await screen.findByText('my shared thought');

    fireEvent.click(screen.getByRole('button', { name: strings.unshareNote }));
    await waitFor(() => expect(personal.keep).toHaveBeenCalled());
    expect(calls[0]).toEqual({ op: 'notes.unshare', params: { teamId: TEAM, noteId: note.id } });
    expect(personal.keep.mock.calls[0]![0]).toMatchObject({ content: 'as it was shared' });
  });

  it('offers nothing about someone else’s note beyond what the server allowed', async () => {
    const theirs = cached({ id: '01J0000000000000000000000M', authorId: MATE });
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

  it('lets an admin delete anyone’s note for everyone, once they have said yes', async () => {
    const theirs = cached({ authorId: MATE });
    const { page, calls } = fakePage({ notes: [theirs], folders: [] });
    view(page);
    await screen.findByText('my shared thought');

    fireEvent.click(screen.getByRole('button', { name: strings.deleteSharedNote }));
    await waitFor(() => expect(calls.some((c) => c.op === 'notes.delete')).toBe(true));
    expect(window.confirm).toHaveBeenCalledWith(strings.deleteSharedConfirm);
  });

  it('creates, renames and deletes a team’s folders', async () => {
    const folders = [{ id: FOLDER, parentId: null, name: 'Reading', createdAt: 1, updatedAt: 1 }];
    const { page, calls } = fakePage(
      { notes: [], folders },
      { 'folders.create': { folder: {} }, 'folders.rename': { folder: {} } },
    );
    view(page);
    await screen.findByText('Reading');

    fireEvent.click(screen.getByRole('button', { name: strings.newTeamFolder }));
    fireEvent.change(screen.getByLabelText(strings.newTeamFolder), {
      target: { value: 'Onboarding' },
    });
    fireEvent.click(screen.getByRole('button', { name: strings.create }));
    await waitFor(() => expect(calls.some((c) => c.op === 'folders.create')).toBe(true));
    expect(calls.find((c) => c.op === 'folders.create')!.params).toEqual({
      teamId: TEAM,
      name: 'Onboarding',
    });

    fireEvent.click(screen.getByRole('button', { name: strings.renameFolder }));
    fireEvent.change(screen.getByLabelText(strings.renameFolder), { target: { value: 'Papers' } });
    fireEvent.click(screen.getByRole('button', { name: strings.rename }));
    await waitFor(() => expect(calls.some((c) => c.op === 'folders.rename')).toBe(true));
    expect(calls.find((c) => c.op === 'folders.rename')!.params).toEqual({
      teamId: TEAM,
      folderId: FOLDER,
      name: 'Papers',
    });

    fireEvent.click(screen.getByRole('button', { name: strings.deleteFolder }));
    await waitFor(() => expect(calls.some((c) => c.op === 'folders.delete')).toBe(true));
  });

  it('shows no folder controls at all to someone the server did not let manage them', async () => {
    const folders = [{ id: FOLDER, parentId: null, name: 'Reading', createdAt: 1, updatedAt: 1 }];
    const { page } = fakePage({ notes: [], folders });
    view(page, ['team.view']);
    await screen.findByText('Reading');

    expect(screen.queryByRole('button', { name: strings.newTeamFolder })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.renameFolder })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.deleteFolder })).not.toBeInTheDocument();
  });

  it('groups notes under the folder they are filed in, and the rest under Unfiled', async () => {
    const folders = [{ id: FOLDER, parentId: null, name: 'Reading', createdAt: 1, updatedAt: 1 }];
    const { page } = fakePage({
      notes: [
        cached({ id: '01J0000000000000000000000N', folderId: FOLDER, content: 'filed one' }),
        cached({ id: '01J0000000000000000000000M', folderId: null, content: 'loose one' }),
        // A folder that no longer exists leaves its note unfiled, never hidden.
        cached({ id: '01J0000000000000000000000P', folderId: 'gone', content: 'orphan' }),
      ],
      folders,
    });
    view(page);

    await screen.findByText('filed one');
    const lists = screen.getAllByRole('list');
    // The first list is the folder list; the next two are the note groups.
    expect(within(lists[1]).getByText('filed one')).toBeInTheDocument();
    expect(within(lists[2]).getByText('loose one')).toBeInTheDocument();
    expect(within(lists[2]).getByText('orphan')).toBeInTheDocument();
  });
});
