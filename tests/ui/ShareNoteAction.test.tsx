// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ShareNoteAction } from '@/ui/teams/ShareNoteAction';
import { shareNote } from '@/ui/teams/share-note';
import { Failure } from '@/ui/hooks/useWork';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { Note } from '@/domain/note';
import type { TeamsClient } from '@/teams/client';

const strings = getTeamsStrings('en');
const ALPHA = '01J0000000000000000000000A';
const BETA = '01J0000000000000000000000B';
const FOLDER = '01J0000000000000000000000F';

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

describe('"Share with team" in a note’s menu', () => {
  it('offers each team, shares through the page, and closes once shared', async () => {
    const share = vi.fn(async () => true);
    const onDone = vi.fn();
    render(<ShareNoteAction lang="en" teams={teams} share={share} onDone={onDone} />);

    expect(screen.getByText(strings.shareWithTeam)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Beta' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(share).toHaveBeenCalledWith(BETA);
  });

  it('stays open when the reader declines the consent', async () => {
    const share = vi.fn(async () => false);
    const onDone = vi.fn();
    render(<ShareNoteAction lang="en" teams={teams} share={share} onDone={onDone} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Alpha' }));

    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(onDone).not.toHaveBeenCalled();
  });

  it('stays open and says why when the server refuses', async () => {
    const share = vi.fn(async () => {
      throw new Failure('team_locked');
    });
    const onDone = vi.fn();
    render(<ShareNoteAction lang="en" teams={teams} share={share} onDone={onDone} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Alpha' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(strings.error('team_locked'));
    expect(onDone).not.toHaveBeenCalled();
  });

  it('offers nothing when this account is in no team', () => {
    render(<ShareNoteAction lang="en" teams={[]} share={vi.fn()} onDone={vi.fn()} />);
    expect(screen.queryByText(strings.shareWithTeam)).not.toBeInTheDocument();
  });
});

describe('shareNote — the one way a note is shared', () => {
  it('sends the note as it stands, with its own id as the key', async () => {
    const client = fakeClient({ ok: true, data: { note: {} } });
    await shareNote(client, note, BETA);
    expect(client.request).toHaveBeenCalledWith('notes.share', {
      teamId: BETA,
      requestId: note.id,
      originalUrl: note.originalUrl,
      pageTitle: 'A page',
      content: note.content,
      anchor: note.anchor,
    });
  });

  it('files it into the folder it was dropped on', async () => {
    const client = fakeClient({ ok: true, data: { note: {} } });
    await shareNote(client, note, ALPHA, FOLDER);
    expect(client.request.mock.calls[0]![1]).toMatchObject({ folderId: FOLDER });
  });

  it('sends no page title when the note never captured one', async () => {
    const client = fakeClient({ ok: true, data: { note: {} } });
    await shareNote(client, { ...note, pageContext: undefined }, ALPHA);
    expect(client.request.mock.calls[0]![1]).not.toHaveProperty('pageTitle');
  });

  it('fails with the server’s refusal', async () => {
    const client = fakeClient({ ok: false, error: 'limit_reached' });
    await expect(shareNote(client, note, ALPHA)).rejects.toMatchObject({ reason: 'limit_reached' });
  });
});
