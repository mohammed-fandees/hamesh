// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NoteDiscussion } from '@/ui/teams/NoteDiscussion';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { TeamNotesSource } from '@/teams/page-notes';
import type { Note } from '@/domain/note';

const strings = getTeamsStrings('en');
const TEAM = '01J0000000000000000000000A';

const note = {
  id: '01J000000000000000000000N1',
  schemaVersion: 1,
  pageKey: 'https://example.test/a',
  originalUrl: 'https://example.test/a',
  content: 'shared',
  anchor: {
    primarySelector: 'p',
    signals: { tagName: 'p' },
    fallbackDocumentPosition: { x: 0, y: 0 },
  },
  workspaceId: 'default',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  team: { id: TEAM, name: 'Research', version: 1, authorId: null, folderId: null },
} satisfies Note;

function source(overrides: Partial<TeamNotesSource> = {}): TeamNotesSource {
  return {
    read: vi.fn(),
    watch: () => () => {},
    label: () => undefined,
    thread: vi.fn(async () => ({
      ok: true as const,
      data: {
        total: 4,
        latest: [
          {
            id: 'c1',
            author: 'Sara',
            avatarUrl: null,
            authorId: 'S',
            body: 'worth a look',
            createdAt: Date.now(),
          },
          {
            id: 'c2',
            author: null,
            avatarUrl: null,
            authorId: null,
            body: 'agreed',
            createdAt: Date.now(),
          },
        ],
      },
    })),
    reply: vi.fn(async () => ({ ok: true as const, data: null })),
    openDiscussion: vi.fn(async () => {}),
    destinations: vi.fn(async () => ({ ok: true as const, data: [] })),
    share: vi.fn(async () => ({ ok: true as const, data: null })),
    ...overrides,
  };
}

afterEach(cleanup);

describe('a shared note’s discussion in its popup', () => {
  it('shows the latest of what was said, and the way to all of it', async () => {
    const src = source();
    render(<NoteDiscussion note={note} lang="en" source={src} />);
    expect(await screen.findByText('worth a look')).toBeInTheDocument();
    expect(screen.getByText('Sara')).toBeInTheDocument();
    expect(screen.getByText(strings.formerMember)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: strings.openWholeDiscussion(4) }));
    expect(src.openDiscussion).toHaveBeenCalledWith(TEAM, note.id);
  });

  it('sends a reply on Enter, then shows the discussion again', async () => {
    const src = source();
    render(<NoteDiscussion note={note} lang="en" source={src} />);
    const field = await screen.findByRole('textbox', { name: strings.quickReplyPlaceholder });
    fireEvent.change(field, { target: { value: '  me too  ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(src.reply).toHaveBeenCalledWith(TEAM, note.id, 'me too'));
    await waitFor(() => expect(field).toHaveValue(''));
    expect(src.thread).toHaveBeenCalledTimes(2);
  });

  it('keeps a new line on Shift+Enter, and sends nothing empty', async () => {
    const src = source();
    render(<NoteDiscussion note={note} lang="en" source={src} />);
    const field = await screen.findByRole('textbox', { name: strings.quickReplyPlaceholder });
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.change(field, { target: { value: 'line' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(src.reply).not.toHaveBeenCalled();
  });

  it('says why, and keeps what was written, when the reply is refused', async () => {
    const src = source({
      reply: vi.fn(async () => ({ ok: false as const, error: 'team_locked' as const })),
    });
    render(<NoteDiscussion note={note} lang="en" source={src} />);
    const field = await screen.findByRole('textbox', { name: strings.quickReplyPlaceholder });
    fireEvent.change(field, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: strings.postComment }));
    expect(await screen.findByRole('alert')).toHaveTextContent(strings.error('team_locked'));
    expect(field).toHaveValue('hello');
  });
});
