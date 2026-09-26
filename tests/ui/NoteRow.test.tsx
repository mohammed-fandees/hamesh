// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

function makeTextNote(overrides: Partial<Note> = {}): Note {
  return {
    ...makeElementNote(),
    id: 'n3',
    content: 'A note on some text',
    anchor: {
      type: 'text',
      version: 1,
      exact: 'Performance is extremely important',
      context: { prefix: 'intro: ', suffix: ' in large applications.' },
      textPosition: { start: 7, end: 41 },
    },
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

  it('shows a contextual note as attached to its page text', async () => {
    const NoteRow = await importNoteRow();
    render(<NoteRow note={makeTextNote()} strings={strings} lang="en" />);

    expect(screen.getByText('A note on some text')).toBeInTheDocument();
    expect(screen.getByText('Performance is extremely important')).toBeInTheDocument();
  });

  it('shows no attached-text quote for a note that is not contextual', async () => {
    const NoteRow = await importNoteRow();
    const { container } = render(<NoteRow note={makeElementNote()} strings={strings} lang="en" />);
    expect(container.querySelector('.hm-attached')).toBeNull();
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

  it('shows no favicon/domain kicker by default (domain-grouped view already has one per group header)', async () => {
    const NoteRow = await importNoteRow();
    render(<NoteRow note={makeElementNote()} strings={strings} lang="en" />);
    expect(document.querySelector('.hm-note-row__domain')).not.toBeInTheDocument();
  });

  it('opens the note from anywhere on the card through one link — the toggle is not inside it', async () => {
    const NoteRow = await importNoteRow();
    render(<NoteRow note={makeElementNote()} strings={strings} lang="en" />);
    const link = screen.getByRole('link');
    expect(link).toHaveClass('hm-note-row__link');
    expect(link.closest('.hm-note-row')).not.toBeNull();
    expect(link.querySelector('button')).toBeNull();
  });

  it('shows a favicon + domain kicker when showDomain is set (the folder view, which mixes sites)', async () => {
    const NoteRow = await importNoteRow();
    render(<NoteRow note={makeElementNote()} strings={strings} lang="en" showDomain />);
    const kicker = document.querySelector('.hm-note-row__domain');
    expect(kicker).toBeInTheDocument();
    expect(kicker).toHaveTextContent('example.com');
    expect(kicker?.querySelector('.hm-favicon')).toBeInTheDocument();
  });
});

describe('NoteRow — long notes', () => {
  /** jsdom does no layout, so "is the clamped preview cutting text off" is
   *  stood in for here: each preview reports a clamped box `clientHeight`
   *  tall and content `scrollHeight` tall, and `ResizeObserver` reports once
   *  on `observe` the way the real one does. */
  function stubLayout({
    scrollHeight,
    clientHeight,
  }: {
    scrollHeight: number;
    clientHeight: number;
  }) {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.dataset.expanded === 'true' ? clientHeight : scrollHeight;
    });
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly cb: ResizeObserverCallback) {}
        observe() {
          this.cb([], this as unknown as ResizeObserver);
        }
        disconnect() {}
        unobserve() {}
      },
    );
  }

  const LONG = 'A long thought.\n\nIt keeps going, paragraph after paragraph. '.repeat(20);

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('offers no toggle for a note that fits in its clamped lines', async () => {
    stubLayout({ scrollHeight: 40, clientHeight: 40 });
    const NoteRow = await importNoteRow();
    render(<NoteRow note={makeElementNote()} strings={strings} lang="en" />);
    expect(screen.queryByRole('button', { name: /Show more/ })).toBeNull();
  });

  it('offers "Show more" when the note is cut off, and expands it in place', async () => {
    stubLayout({ scrollHeight: 400, clientHeight: 40 });
    const NoteRow = await importNoteRow();
    render(<NoteRow note={makeElementNote({ content: LONG })} strings={strings} lang="en" />);

    const toggle = await screen.findByRole('button', { name: /Show more/ });
    const preview = document.querySelector('.hm-note-row__preview')!;
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', preview.id);
    expect(preview).toHaveAttribute('data-expanded', 'false');

    fireEvent.click(toggle);

    expect(preview).toHaveAttribute('data-expanded', 'true');
    // Still offered once expanded (nothing is clamped now), to collapse again.
    const less = screen.getByRole('button', { name: /Show less/ });
    expect(less).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(less);
    expect(preview).toHaveAttribute('data-expanded', 'false');
    expect(screen.getByRole('button', { name: /Show more/ })).toBeInTheDocument();
  });

  it('keeps the full text in the row — the clamp is visual, never a truncated string', async () => {
    stubLayout({ scrollHeight: 400, clientHeight: 40 });
    const NoteRow = await importNoteRow();
    render(<NoteRow note={makeElementNote({ content: LONG })} strings={strings} lang="en" />);
    expect(document.querySelector('.hm-note-row__preview')!.textContent).toBe(LONG);
  });

  it('toggling never opens the note', async () => {
    stubLayout({ scrollHeight: 400, clientHeight: 40 });
    const { browser } = await import('wxt/browser');
    const NoteRow = await importNoteRow();
    render(<NoteRow note={makeElementNote({ content: LONG })} strings={strings} lang="en" />);

    fireEvent.click(await screen.findByRole('button', { name: /Show more/ }));
    expect(browser.tabs.create).not.toHaveBeenCalled();
    expect(screen.getByRole('link').contains(screen.getByRole('button'))).toBe(false);
  });

  it('speaks the reader’s language', async () => {
    stubLayout({ scrollHeight: 400, clientHeight: 40 });
    const NoteRow = await importNoteRow();
    render(
      <NoteRow note={makeElementNote({ content: LONG })} strings={getStrings('ar')} lang="ar" />,
    );
    expect(await screen.findByRole('button', { name: /عرض المزيد/ })).toBeInTheDocument();
  });
});
