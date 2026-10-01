// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LibraryView } from '@/ui/library/LibraryView';
import { getStrings } from '@/ui/i18n';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { Note } from '@/domain/note';
import type { TeamLibraryActions } from '@/ui/teams/TeamSpace';

const strings = getStrings('en');
const teamStrings = getTeamsStrings('en');
const TEAM = '01J0000000000000000000000A';

const anchor = {
  primarySelector: null,
  signals: { tagName: 'p' },
  fallbackDocumentPosition: { x: 0, y: 0 },
};
const note = (id: string, title: string, extra: Partial<Note> = {}): Note => ({
  id,
  schemaVersion: 1,
  pageKey: `https://example.test/${id}`,
  originalUrl: `https://example.test/${id}`,
  content: `about ${title}`,
  anchor,
  workspaceId: 'default',
  pageContext: { title },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

const mine = note('mine', 'My page');
const theirs = note('theirs', 'Team page', {
  team: { id: TEAM, name: 'Research', version: 1, authorId: null, folderId: 'papers' },
});

const actions = (): TeamLibraryActions => ({
  share: vi.fn(async () => {}),
  file: vi.fn(async () => {}),
  createFolder: vi.fn(async () => {}),
  renameFolder: vi.fn(async () => {}),
  deleteFolder: vi.fn(async () => {}),
});

function view(teamActions: TeamLibraryActions | null) {
  render(
    <LibraryView
      strings={strings}
      lang="en"
      notes={[mine]}
      teamNotes={[theirs]}
      teams={[{ id: TEAM, name: 'Research' }]}
      teamFolders={new Map([[TEAM, [{ id: 'papers', name: 'Papers', parentId: null }]]])}
      teamActions={teamActions}
      folders={[]}
      owner="all"
      onOwnerChange={vi.fn()}
      onCreateFolder={vi.fn(async () => {})}
      onRenameFolder={vi.fn(async () => {})}
      onDeleteFolder={vi.fn(async () => {})}
      onMoveNote={vi.fn()}
      onOpenSettings={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('radio', { name: strings.modeFolder }));
}

// The folder view's spaces exist only in a build that has Teams.
beforeEach(() => vi.stubEnv('WXT_TEAMS_API_ORIGIN', 'https://api.example.test'));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('the folder view, with teams', () => {
  it('shows the reader’s own space and each team’s, saying where their notes live', () => {
    view(actions());
    const own = screen.getByRole('region', { name: strings.mySpace });
    expect(within(own).getByText(strings.mySpaceMeta(1))).toBeInTheDocument();
    const team = screen.getByRole('region', { name: 'Research' });
    expect(within(team).getByText(teamStrings.teamSpaceMeta(1))).toBeInTheDocument();
  });

  it('files a team’s note in the team’s folder, not in the reader’s Unfiled', () => {
    view(actions());
    const own = screen.getByRole('region', { name: strings.mySpace });
    const team = screen.getByRole('region', { name: 'Research' });
    expect(within(own).getByRole('button', { name: /^Unfiled/ })).toHaveTextContent(
      strings.notesCount(1),
    );
    expect(within(team).getByRole('button', { name: /^Papers/ })).toHaveTextContent(
      strings.notesCount(1),
    );
  });

  it('shuts and opens a space', () => {
    view(actions());
    const head = within(screen.getByRole('region', { name: 'Research' })).getAllByRole(
      'button',
    )[0]!;
    expect(head).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'false');
  });

  it('creates a team’s folder through the team, not this device', async () => {
    const teamActions = actions();
    view(teamActions);
    const team = screen.getByRole('region', { name: 'Research' });
    fireEvent.click(within(team).getByRole('button', { name: strings.newFolder }));
    fireEvent.change(within(team).getByRole('textbox'), { target: { value: 'Drafts' } });
    fireEvent.click(within(team).getByRole('button', { name: strings.create }));
    await vi.waitFor(() =>
      expect(teamActions.createFolder).toHaveBeenCalledWith(TEAM, 'Drafts', null),
    );
  });

  it('stays one card of folders without the means to act on teams', () => {
    view(null);
    expect(screen.queryByRole('region', { name: strings.mySpace })).not.toBeInTheDocument();
  });
});
