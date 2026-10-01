// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SharedNotePopup } from '@/ui/teams/SharedNotePopup';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { TeamNotesSource } from '@/teams/page-notes';
import type { PeopleDirectory } from '@/teams/people-cache';
import type { Note } from '@/domain/note';

const strings = getTeamsStrings('en');
const TEAM = '01J0000000000000000000000A';
const SARA = '01J0000000000000000000000S';
const ME = '01J0000000000000000000000M';
const SARA_PHOTO = 'data:image/png;base64,U0FSQQ==';
const MY_PHOTO = 'data:image/png;base64,TUU=';

const note = {
  id: '01J000000000000000000000N1',
  schemaVersion: 1,
  pageKey: 'https://example.test/a',
  originalUrl: 'https://example.test/a',
  content: 'The heart of the paper.',
  anchor: {
    primarySelector: 'p',
    signals: { tagName: 'p' },
    fallbackDocumentPosition: { x: 0, y: 0 },
  },
  workspaceId: 'default',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  team: { id: TEAM, name: 'Research', version: 1, authorId: SARA, folderId: null },
} satisfies Note;

const people: PeopleDirectory = {
  people: {
    [SARA]: { name: 'Sara', photo: SARA_PHOTO, source: null },
    [ME]: { name: 'Mohammed', photo: MY_PHOTO, source: null },
  },
  me: ME,
  teamIds: [TEAM],
  syncedAt: 1,
};

function source(overrides: Partial<TeamNotesSource> = {}): TeamNotesSource {
  return {
    read: vi.fn(),
    watch: () => () => {},
    people: vi.fn(async () => people),
    watchPeople: () => () => {},
    label: () => undefined,
    thread: vi.fn(async () => ({
      ok: true as const,
      data: {
        total: 4,
        latest: [
          {
            id: 'c1',
            author: 'Sara',
            authorId: SARA,
            parts: [{ text: 'worth a look, ' }, { mention: 'Mohammed' }],
            createdAt: Date.now(),
          },
          {
            id: 'c2',
            author: null,
            authorId: null,
            parts: [{ text: 'agreed' }],
            createdAt: Date.now(),
          },
        ],
      },
    })),
    reply: vi.fn(async () => ({ ok: true as const, data: null })),
    openDiscussion: vi.fn(async () => {}),
    openInHamesh: vi.fn(async () => {}),
    destinations: vi.fn(async () => ({ ok: true as const, data: [] })),
    share: vi.fn(async () => ({ ok: true as const, data: null })),
    ...overrides,
  };
}

const onClose = vi.fn();
const popup = (src: TeamNotesSource, anchorAvailable = true) =>
  render(
    <SharedNotePopup
      note={note}
      lang="en"
      source={src}
      people={people}
      anchorAvailable={anchorAvailable}
      unavailableLabel="Its place on the page has changed"
      onClose={onClose}
    />,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('a shared note’s popup on the page', () => {
  it('says whose it is and where it was shared, with their face, and what it says', async () => {
    const { container } = popup(source());
    const head = container.querySelector('.hm-shared-card__head') as HTMLElement;
    expect(within(head).getByText('Sara')).toBeInTheDocument();
    expect(within(head).getByText('Research')).toBeInTheDocument();
    expect(head.querySelector('img')).toHaveAttribute('src', SARA_PHOTO);
    expect(screen.getByText('The heart of the paper.')).toBeInTheDocument();
    await screen.findByText('worth a look,');
  });

  it('opens the discussion beside the page, from its header and from its foot', async () => {
    const src = source();
    popup(src);
    fireEvent.click(screen.getByRole('button', { name: strings.openBeside }));
    fireEvent.click(await screen.findByRole('button', { name: strings.openWholeDiscussion(4) }));
    expect(src.openDiscussion).toHaveBeenCalledTimes(2);
    expect(src.openDiscussion).toHaveBeenCalledWith(TEAM, note.id);
  });

  it('opens the note in Hamesh from its menu', async () => {
    const src = source();
    popup(src);
    fireEvent.click(screen.getByRole('button', { name: strings.noteActions }));
    fireEvent.click(await screen.findByRole('menuitem', { name: strings.openInHamesh }));
    expect(src.openInHamesh).toHaveBeenCalledWith(TEAM, note.id);
  });

  it('closes from its button, and on Escape', () => {
    const { container } = popup(source());
    fireEvent.click(screen.getByRole('button', { name: strings.close }));
    fireEvent.keyDown(container.querySelector('.hm-shared-card')!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('says so when what it is attached to is not on the page', () => {
    popup(source(), false);
    expect(screen.getByText('Its place on the page has changed')).toBeInTheDocument();
  });
});

describe('its discussion', () => {
  it('shows the latest of what was said, each face, and a person named with @ set apart', async () => {
    const { container } = popup(source());
    expect(await screen.findByText('worth a look,')).toBeInTheDocument();
    expect(screen.getByText('@Mohammed')).toHaveClass('hm-mention');
    expect(screen.getByText(strings.formerMember)).toBeInTheDocument();
    const faces = [...container.querySelectorAll('.hm-thread img')].map((img) =>
      img.getAttribute('src'),
    );
    expect(faces).toEqual([SARA_PHOTO]);
  });

  it('puts your own face beside the reply field', () => {
    const { container } = popup(source());
    expect(container.querySelector('.hm-reply img')).toHaveAttribute('src', MY_PHOTO);
  });

  it('sends a reply on Enter, then shows the discussion again', async () => {
    const src = source();
    popup(src);
    const field = await screen.findByRole('textbox', { name: strings.quickReplyPlaceholder });
    fireEvent.change(field, { target: { value: '  me too  ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(src.reply).toHaveBeenCalledWith(TEAM, note.id, 'me too'));
    await waitFor(() => expect(field).toHaveValue(''));
    expect(src.thread).toHaveBeenCalledTimes(2);
  });

  it('keeps a new line on Shift+Enter, and sends nothing empty', async () => {
    const src = source();
    popup(src);
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
    popup(src);
    const field = await screen.findByRole('textbox', { name: strings.quickReplyPlaceholder });
    fireEvent.change(field, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: strings.postComment }));
    expect(await screen.findByRole('alert')).toHaveTextContent(strings.error('team_locked'));
    expect(field).toHaveValue('hello');
  });
});
