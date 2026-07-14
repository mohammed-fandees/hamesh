// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Note } from '@/domain/note';

const STORAGE_KEY_PREFIX = 'local:hamesh:notes:';

// Same fake `storage` global shape as tests/storage/notes-repository.test.ts
// and tests/entrypoints/popup/App.test.tsx, extended with `snapshot` (used by
// NotesRepository.getAll, which this page relies on) since both are needed here.
const fakeStorage = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const watchers = new Map<string, Set<(v: unknown) => void>>();
  const api = {
    getItem: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      for (const cb of watchers.get(key) ?? []) cb(value);
      return Promise.resolve();
    }),
    watch: vi.fn((key: string, cb: (v: unknown) => void) => {
      if (!watchers.has(key)) watchers.set(key, new Set());
      watchers.get(key)!.add(cb);
      return () => watchers.get(key)?.delete(cb);
    }),
    snapshot: vi.fn((area?: string) => {
      const entries = [...store.entries()];
      if (area) {
        const filtered = entries.filter(([k]) => k.startsWith(`${area}:`));
        return Promise.resolve(
          Object.fromEntries(filtered.map(([k, v]) => [k.slice(area.length + 1), v])),
        );
      }
      return Promise.resolve(Object.fromEntries(store));
    }),
  };
  (globalThis as unknown as { storage: unknown }).storage = api;
  return { store, api };
});

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      id: 'test-extension-id',
      getURL: (path: string) => `chrome-extension://test-extension-id${path}`,
    },
    i18n: {
      getUILanguage: () => 'en',
    },
  },
}));

function makeAnchor() {
  return {
    primarySelector: null,
    signals: { tagName: 'div' },
    fallbackDocumentPosition: { x: 0, y: 0 },
  };
}

let idCounter = 0;
function seedNote(overrides: Partial<Note> = {}) {
  idCounter += 1;
  const note: Note = {
    id: `note-${idCounter}`,
    schemaVersion: 1,
    pageKey: 'https://example.com',
    originalUrl: 'https://example.com',
    content: 'hello world',
    anchor: makeAnchor(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  const key = `${STORAGE_KEY_PREFIX}${note.pageKey}`;
  const existing = (fakeStorage.store.get(key) as Note[] | undefined) ?? [];
  fakeStorage.store.set(key, [...existing, note]);
  return note;
}

async function importApp() {
  const mod = await import('@/entrypoints/notes/App');
  return mod.App;
}

describe('Notes Library page', () => {
  beforeEach(() => {
    vi.resetModules();
    idCounter = 0;
    fakeStorage.store.clear();
    fakeStorage.api.getItem.mockClear();
    fakeStorage.api.setItem.mockClear();
    fakeStorage.api.snapshot.mockClear();
    cleanup();
  });

  it('shows the empty state when there are no notes', async () => {
    const App = await importApp();
    render(<App />);

    expect(await screen.findByText('No notes yet')).toBeInTheDocument();
    expect(
      screen.getByText('Select an element on any page to leave your first note.'),
    ).toBeInTheDocument();
  });

  it('groups notes by website with a note count', async () => {
    seedNote({ pageKey: 'https://github.com/a', originalUrl: 'https://github.com/a' });
    seedNote({ pageKey: 'https://github.com/b', originalUrl: 'https://github.com/b' });
    seedNote({
      pageKey: 'https://developer.mozilla.org/x',
      originalUrl: 'https://developer.mozilla.org/x',
    });

    const App = await importApp();
    render(<App />);

    // Scoped to the group headers (role=button) since the Continue section
    // below also shows these same domain names as plain text.
    const githubGroup = await screen.findByRole('button', { name: /github\.com/ });
    expect(githubGroup).toHaveTextContent('2 notes');
    const mdnGroup = screen.getByRole('button', { name: /developer\.mozilla\.org/ });
    expect(mdnGroup).toHaveTextContent('1 note');
  });

  it('does not show the empty state once notes exist', async () => {
    seedNote();
    const App = await importApp();
    render(<App />);

    await screen.findByRole('button', { name: /example\.com/ });
    expect(screen.queryByText('No notes yet')).not.toBeInTheDocument();
  });

  it('expands a group on click to reveal its notes, and collapses again', async () => {
    seedNote({ content: 'first note', pageContext: { title: 'Example Title' } });

    const App = await importApp();
    const { container } = render(<App />);

    const header = await screen.findByRole('button', { name: /example\.com/ });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    const panel = container.querySelector('.hm-group__body') as HTMLElement;
    // jsdom has no layout engine, so the grid-rows collapse can't be observed
    // directly — the aria-hidden/inert pair is the actual, testable
    // accessibility contract (same pattern as the popup's Settings pane).
    expect(panel).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveAttribute('aria-hidden', 'false');
    expect(within(panel).getByText('first note')).toBeInTheDocument();
    expect(within(panel).getByText('Example Title')).toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
  });

  it("opens the note's original page in a new tab via a plain link (no browser.tabs call)", async () => {
    seedNote({ content: 'first note', originalUrl: 'https://example.com/some/page' });

    const App = await importApp();
    const { container } = render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /example\.com/ }));
    const panel = container.querySelector('.hm-group__body') as HTMLElement;
    const link = within(panel).getByRole('link', { name: /first note/ });
    expect(link).toHaveAttribute('href', 'https://example.com/some/page');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('falls back to the URL pathname (never "Untitled page") when a note has no pageContext title', async () => {
    seedNote({
      content: 'no title note',
      originalUrl: 'https://example.com/articles/my-post',
    });

    const App = await importApp();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /example\.com/ }));
    expect(await screen.findByText('/articles/my-post')).toBeInTheDocument();
    expect(screen.queryByText('Untitled page')).not.toBeInTheDocument();
  });

  it('shows a preview of the latest note on a collapsed group row', async () => {
    seedNote({ content: 'This is the note that should show as a preview.' });

    const App = await importApp();
    render(<App />);

    const header = await screen.findByRole('button', { name: /example\.com/ });
    expect(header).toHaveTextContent('This is the note that should show as a preview.');
  });

  it('shows a quiet "All Websites" heading above the grouped list', async () => {
    seedNote();
    const App = await importApp();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'All Websites' })).toBeInTheDocument();
  });

  it('renders a Continue section with the most recently active websites and a note preview', async () => {
    seedNote({
      pageKey: 'https://old.com',
      originalUrl: 'https://old.com',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    seedNote({
      pageKey: 'https://newest.com',
      originalUrl: 'https://newest.com',
      content: 'Resume this thought.',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });

    const App = await importApp();
    render(<App />);

    const continueSection = await screen.findByRole('region', { name: 'Continue' });
    const items = within(continueSection).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('newest.com');
    expect(items[0]).toHaveTextContent('Resume this thought.');

    const link = within(items[0]).getByRole('link');
    expect(link).toHaveAttribute('href', 'https://newest.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('strips a leading www. so grouping matches the bare domain', async () => {
    seedNote({
      pageKey: 'https://www.stackoverflow.com/q',
      originalUrl: 'https://www.stackoverflow.com/q',
    });
    seedNote({
      pageKey: 'https://stackoverflow.com/q2',
      originalUrl: 'https://stackoverflow.com/q2',
    });

    const App = await importApp();
    render(<App />);

    const group = await screen.findByRole('button', { name: /stackoverflow\.com/ });
    expect(group).toHaveTextContent('2 notes');
  });

  it('loads notes via the real NotesRepository.getAll (storage.snapshot)', async () => {
    seedNote();
    const App = await importApp();
    render(<App />);

    await waitFor(() => expect(fakeStorage.api.snapshot).toHaveBeenCalledWith('local'));
  });
});
