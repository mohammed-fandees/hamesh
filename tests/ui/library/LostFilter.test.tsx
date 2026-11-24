// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LibraryView } from '@/ui/library/LibraryView';
import { getStrings, type Lang } from '@/ui/i18n';
import type { Note } from '@/domain/note';

const note = (id: string, site: string): Note => ({
  id,
  schemaVersion: 1,
  pageKey: `https://${site}/${id}`,
  originalUrl: `https://${site}/${id}`,
  content: `note ${id}`,
  anchor: {
    primarySelector: null,
    signals: { tagName: 'p' },
    fallbackDocumentPosition: { x: 0, y: 0 },
  },
  workspaceId: 'default',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const NOTES = [note('a', 'maktaba.site'), note('b', 'maktaba.site'), note('c', 'lectures.edu')];

function view(lostIds: ReadonlySet<string>, lang: Lang = 'en') {
  return (
    <LibraryView
      strings={getStrings(lang)}
      lang={lang}
      notes={NOTES}
      teamNotes={[]}
      teams={[]}
      teamFolders={new Map()}
      folders={[]}
      owner="all"
      onOwnerChange={vi.fn()}
      onCreateFolder={vi.fn(async () => {})}
      onRenameFolder={vi.fn(async () => {})}
      onDeleteFolder={vi.fn(async () => {})}
      onMoveNote={vi.fn()}
      onOpenGuide={vi.fn()}
      listView={{ sort: 'alphabetical', mode: 'folder' }}
      lostIds={lostIds}
    />
  );
}

const rows = () =>
  [...document.querySelectorAll('[data-note-id]')].map((r) => r.getAttribute('data-note-id'));

afterEach(cleanup);

describe('the Library’s lost-notes filter and mark', () => {
  it('offers no filter while every note has its place', () => {
    render(view(new Set()));
    expect(screen.queryByRole('button', { name: /Lost their place/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Lost its place')).not.toBeInTheDocument();
  });

  it('marks lost notes, shows only them when pressed, and turns off with the last one', () => {
    const { rerender } = render(view(new Set(['b', 'c'])));
    expect(screen.getAllByText('Lost its place')).toHaveLength(2);

    const filter = screen.getByRole('button', { name: 'Lost their place · 2' });
    expect(filter).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(filter);
    expect(filter).toHaveAttribute('aria-pressed', 'true');
    expect(rows().sort()).toEqual(['b', 'c']);

    rerender(view(new Set()));
    expect(screen.queryByRole('button', { name: /Lost their place/ })).not.toBeInTheDocument();
    expect(rows().sort()).toEqual(['a', 'b', 'c']);
  });

  it('says it in Arabic', () => {
    render(view(new Set(['a']), 'ar'));
    expect(screen.getByRole('button', { name: 'فقدت مكانها · 1' })).toBeInTheDocument();
  });
});

describe('the lost-notes filter by site', () => {
  it('opens the cards of the sites it shows and puts Continue aside', () => {
    render(
      <LibraryView
        strings={getStrings('en')}
        lang="en"
        notes={NOTES}
        teamNotes={[]}
        teams={[]}
        teamFolders={new Map()}
        folders={[]}
        owner="all"
        onOwnerChange={vi.fn()}
        onCreateFolder={vi.fn(async () => {})}
        onRenameFolder={vi.fn(async () => {})}
        onDeleteFolder={vi.fn(async () => {})}
        onMoveNote={vi.fn()}
        onOpenGuide={vi.fn()}
        listView={{ sort: 'alphabetical', mode: 'domain' }}
        lostIds={new Set(['c'])}
      />,
    );
    expect(screen.getByText('Continue')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lost their place · 1' }));
    expect(screen.queryByText('Continue')).not.toBeInTheDocument();
    expect(rows()).toEqual(['c']);
  });
});
