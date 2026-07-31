// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Note } from '@/domain/note';
import { getStrings } from '@/ui/i18n';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { id: 'test-extension-id' },
    tabs: { create: vi.fn(), onRemoved: { addListener: vi.fn(), removeListener: vi.fn() } },
    runtime2: {},
  },
}));

async function importNoteRow() {
  const mod = await import('@/ui/NoteRow');
  return mod.NoteRow;
}

const strings = getStrings('en');

function makeElementNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    schemaVersion: 1,
    pageKey: 'https://example.com/page',
    originalUrl: 'https://example.com/page',
    content: 'An element note',
    anchor: {
      type: 'element',
      primarySelector: null,
      signals: { tagName: 'div' },
      fallbackDocumentPosition: { x: 0, y: 0 },
    },
    workspaceId: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeVideoNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n2',
    schemaVersion: 1,
    pageKey: 'https://www.youtube.com/watch',
    originalUrl: 'https://www.youtube.com/watch?v=abc123',
    content: 'A video note',
    anchor: {
      type: 'video',
      platform: 'youtube',
      videoId: 'abc123',
      timestamp: 13 * 60 + 27,
    },
    workspaceId: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('NoteRow', () => {
  beforeEach(() => {
    cleanup();
  });

  it('shows no video timestamp badge for an element note', async () => {
    const NoteRow = await importNoteRow();
    render(<NoteRow note={makeElementNote()} strings={strings} lang="en" />);
    expect(document.querySelector('.hm-note-row__video-badge')).not.toBeInTheDocument();
  });

  it('shows a video timestamp badge for a video note', async () => {
    const NoteRow = await importNoteRow();
    render(<NoteRow note={makeVideoNote()} strings={strings} lang="en" />);
    const badge = document.querySelector('.hm-note-row__video-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('13:27');
  });

  it('still shows the pin badge alongside the video badge for a pinned video note', async () => {
    const NoteRow = await importNoteRow();
    render(<NoteRow note={makeVideoNote({ pinned: true })} strings={strings} lang="en" />);
    expect(document.querySelector('.hm-note-row__video-badge')).toHaveTextContent('13:27');
    // The pin icon renders inside the title line as an <svg>, alongside the
    // page label text.
    expect(document.querySelector('.hm-note-row__title svg')).toBeInTheDocument();
  });

  it('links to the note’s original URL regardless of anchor type', async () => {
    const NoteRow = await importNoteRow();
    render(<NoteRow note={makeVideoNote()} strings={strings} lang="en" />);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=abc123',
    );
  });
});
