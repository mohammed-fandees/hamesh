// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Note } from '@/domain/note';
import { getPinnedNotes } from '@/domain/notes-grouping';
import { getStrings } from '@/ui/i18n';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { id: 'test-extension-id' },
    tabs: { create: vi.fn(), onRemoved: { addListener: vi.fn(), removeListener: vi.fn() } },
  },
}));

async function importPinnedSection() {
  const mod = await import('@/ui/PinnedSection');
  return mod.PinnedSection;
}

const strings = getStrings('en');

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    schemaVersion: 1,
    pageKey: 'https://example.com/page',
    originalUrl: 'https://example.com/page',
    content: 'A pinned note',
    anchor: {
      type: 'element',
      primarySelector: null,
      signals: { tagName: 'div' },
      fallbackDocumentPosition: { x: 0, y: 0 },
    },
    workspaceId: 'default',
    pinned: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTextNote(overrides: Partial<Note> = {}): Note {
  return makeNote({
    id: 'n2',
    content: 'Review this section later',
    anchor: {
      type: 'text',
      version: 1,
      exact: 'Performance is extremely important',
      context: { prefix: 'intro: ', suffix: ' in large applications.' },
      textPosition: { start: 7, end: 41 },
    },
    ...overrides,
  });
}

/** Renders exactly what the Notes Library does: the domain projection fed
 *  into the section, alongside the full notes it was derived from. */
async function renderPinned(notes: Note[]) {
  const PinnedSection = await importPinnedSection();
  return render(
    <PinnedSection
      notes={getPinnedNotes(notes)}
      allNotes={notes}
      strings={strings}
      lang="en"
      onTogglePin={() => {}}
      onEditNote={() => {}}
      onDeleteNote={() => {}}
    />,
  );
}

describe('PinnedSection', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders nothing when no note is pinned', async () => {
    const { container } = await renderPinned([makeNote({ pinned: false })]);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a pinned element note without any attached-text quote', async () => {
    await renderPinned([makeNote()]);
    expect(screen.getByText('A pinned note')).toBeInTheDocument();
    expect(document.querySelector('.hm-attached')).toBeNull();
  });

  it('still shows a pinned contextual note as attached to its page text', async () => {
    // Regression: pinning a contextual note used to strip its identity —
    // the Pinned list is fed a slim projection that carries no anchor, so
    // it rendered as an ordinary note.
    await renderPinned([makeTextNote()]);

    expect(screen.getByText('Review this section later')).toBeInTheDocument();
    expect(screen.getByText('Performance is extremely important')).toBeInTheDocument();
    expect(document.querySelector('.hm-attached')).not.toBeNull();
  });

  it('shows the attached text above the note itself, as every other view does', async () => {
    await renderPinned([makeTextNote()]);
    const item = document.querySelector('.hm-pinned__item')!;
    const quote = item.querySelector('.hm-attached__quote')!;
    const preview = item.querySelector('.hm-pinned__preview')!;
    expect(quote.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps every pinned note distinct when contextual and ordinary notes are mixed', async () => {
    await renderPinned([makeNote(), makeTextNote()]);
    expect(document.querySelectorAll('.hm-pinned__item')).toHaveLength(2);
    expect(document.querySelectorAll('.hm-attached')).toHaveLength(1);
  });
});
