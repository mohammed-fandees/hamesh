// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ShareNoteAction } from '@/ui/teams/ShareNoteAction';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { Note } from '@/domain/note';
import type { TeamsClient } from '@/teams/client';

const strings = getTeamsStrings('en');
const ALPHA = '01J0000000000000000000000A';
const BETA = '01J0000000000000000000000B';

const note: Note = {
  id: 'a-local-note-id',
  schemaVersion: 1,
  pageKey: 'https://example.test/page',
  originalUrl: 'https://example.test/page',
  content: 'worth telling the team',
  anchor: {
    primarySelector: 'p',
    signals: { tagName: 'p' },
    fallbackDocumentPosition: { x: 1, y: 2 },
  },
  workspaceId: 'default',
  pageContext: { title: 'A page' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function fakeClient(answer: { ok: true; data: unknown } | { ok: false; error: string }) {
  const request = vi.fn(async (_op: string, _params: unknown) => answer);
  return { request } as unknown as TeamsClient & { request: typeof request };
}

const teams = [
  { id: ALPHA, name: 'Alpha' },
  { id: BETA, name: 'Beta' },
];

afterEach(cleanup);

describe('sharing a note with a team', () => {
  it('offers each team, and sends the note as it stands with its own id as the key', async () => {
    const client = fakeClient({ ok: true, data: { note: {} } });
    const onDone = vi.fn();
    render(<ShareNoteAction note={note} lang="en" client={client} teams={teams} onDone={onDone} />);

    expect(screen.getByText(strings.shareWithTeam)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Beta' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(client.request).toHaveBeenCalledWith('notes.share', {
      teamId: BETA,
      requestId: note.id,
      originalUrl: note.originalUrl,
      pageTitle: 'A page',
      content: note.content,
      anchor: note.anchor,
    });
  });

  it('stays open and says why when the server refuses', async () => {
    const client = fakeClient({ ok: false, error: 'team_locked' });
    const onDone = vi.fn();
    render(<ShareNoteAction note={note} lang="en" client={client} teams={teams} onDone={onDone} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Alpha' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(strings.error('team_locked'));
    expect(onDone).not.toHaveBeenCalled();
  });

  it('offers nothing when this account is in no team', () => {
    const client = fakeClient({ ok: true, data: {} });
    render(<ShareNoteAction note={note} lang="en" client={client} teams={[]} onDone={vi.fn()} />);
    expect(screen.queryByText(strings.shareWithTeam)).not.toBeInTheDocument();
  });

  it('sends no page title when the note never captured one', async () => {
    const client = fakeClient({ ok: true, data: { note: {} } });
    const bare: Note = { ...note, pageContext: undefined };
    render(
      <ShareNoteAction note={bare} lang="en" client={client} teams={teams} onDone={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Alpha' }));

    await waitFor(() => expect(client.request).toHaveBeenCalled());
    expect(client.request.mock.calls[0]![1]).not.toHaveProperty('pageTitle');
  });
});
