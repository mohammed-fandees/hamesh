// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HameshApp } from '@/content/HameshApp';
import type { NotesRepository } from '@/storage/notes-repository';
import type { PreferencesRepository } from '@/storage/preferences-repository';
import type { Note } from '@/domain/note';
import { DEFAULT_PREFERENCES } from '@/domain/preferences';
import { generatePageKey } from '@/domain/page-key';

function makeRepo(notes: Note[]): NotesRepository {
  return {
    getForPage: vi.fn().mockResolvedValue(notes),
    getAll: vi.fn().mockResolvedValue(notes),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setPinned: vi.fn(),
  };
}

function makePrefsRepo(): PreferencesRepository {
  return {
    get: vi.fn().mockResolvedValue(DEFAULT_PREFERENCES),
    watch: vi.fn().mockReturnValue(() => {}),
    setLanguage: vi.fn(),
    setAppearance: vi.fn(),
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    schemaVersion: 1,
    pageKey: 'https://example.com/page',
    originalUrl: 'https://example.com/page',
    content: 'the restored note content',
    anchor: {
      primarySelector: '#restore-target',
      signals: { tagName: 'div' },
      fallbackDocumentPosition: { x: 0, y: 0 },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('HameshApp — Open Note restore flow', () => {
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '<div id="restore-target">Target element</div>';
    scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock as unknown as Element['scrollIntoView'];
    // jsdom doesn't implement matchMedia at all — assign a stub directly
    // rather than vi.spyOn, which requires an existing function. HameshApp's
    // own host-theme-detection effect also calls matchMedia and attaches a
    // 'change' listener to the result, so the stub needs those no-ops too.
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    // jsdom doesn't implement elementFromPoint (resolveAnchor's fallback
    // path for an unresolved anchor) — stub it to behave like real Chrome
    // for coordinates with nothing there, rather than jsdom's own
    // unimplemented-API error.
    document.elementFromPoint = vi.fn().mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens the note, scrolls to and highlights its resolved element once RESTORE_NOTE fires', async () => {
    const note = makeNote();
    const repo = makeRepo([note]);
    const prefsRepo = makePrefsRepo();
    let restoreNote: ((noteId: string) => void) | null = null;

    render(
      <HameshApp
        repo={repo}
        prefsRepo={prefsRepo}
        initialLang="en"
        registerActivate={() => {}}
        registerRestoreNote={(fn) => {
          restoreNote = fn;
        }}
      />,
    );

    await waitFor(() => expect(repo.getForPage).toHaveBeenCalled());
    await waitFor(() => expect(restoreNote).not.toBeNull());

    restoreNote!(note.id);

    expect(await screen.findByText('the restored note content')).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalledTimes(1));
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth', block: 'center' }),
    );
    expect(document.querySelector('.hm-restore-highlight')).not.toBeNull();
  });

  it('respects prefers-reduced-motion by scrolling without smooth behavior', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    const note = makeNote();
    const repo = makeRepo([note]);
    const prefsRepo = makePrefsRepo();
    let restoreNote: ((noteId: string) => void) | null = null;

    render(
      <HameshApp
        repo={repo}
        prefsRepo={prefsRepo}
        initialLang="en"
        registerActivate={() => {}}
        registerRestoreNote={(fn) => {
          restoreNote = fn;
        }}
      />,
    );

    await waitFor(() => expect(restoreNote).not.toBeNull());
    restoreNote!(note.id);

    await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalledTimes(1));
    expect(scrollIntoViewMock).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
  });

  it('waits for notes to load if RESTORE_NOTE fires before the initial fetch resolves', async () => {
    const note = makeNote();
    let resolveGetForPage: (notes: Note[]) => void = () => {};
    const repo: NotesRepository = {
      getForPage: vi.fn(() => new Promise<Note[]>((resolve) => (resolveGetForPage = resolve))),
      getAll: vi.fn().mockResolvedValue([note]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      setPinned: vi.fn(),
    };
    const prefsRepo = makePrefsRepo();
    let restoreNote: ((noteId: string) => void) | null = null;

    render(
      <HameshApp
        repo={repo}
        prefsRepo={prefsRepo}
        initialLang="en"
        registerActivate={() => {}}
        registerRestoreNote={(fn) => {
          restoreNote = fn;
        }}
      />,
    );

    await waitFor(() => expect(restoreNote).not.toBeNull());
    // Fire the restore request before notes have loaded — nothing to show yet.
    restoreNote!(note.id);
    expect(screen.queryByText('the restored note content')).not.toBeInTheDocument();

    // Notes finish loading — the pending restore should now apply.
    resolveGetForPage([note]);
    expect(await screen.findByText('the restored note content')).toBeInTheDocument();
  });

  it('opens the viewer even when the anchor cannot be resolved (no scroll/highlight)', async () => {
    const note = makeNote({
      anchor: {
        primarySelector: '#does-not-exist',
        signals: { tagName: 'div' },
        fallbackDocumentPosition: { x: -99999, y: -99999 },
      },
    });
    const repo = makeRepo([note]);
    const prefsRepo = makePrefsRepo();
    let restoreNote: ((noteId: string) => void) | null = null;

    render(
      <HameshApp
        repo={repo}
        prefsRepo={prefsRepo}
        initialLang="en"
        registerActivate={() => {}}
        registerRestoreNote={(fn) => {
          restoreNote = fn;
        }}
      />,
    );

    await waitFor(() => expect(restoreNote).not.toBeNull());
    restoreNote!(note.id);

    expect(await screen.findByText('the restored note content')).toBeInTheDocument();
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });
});

describe('HameshApp — pin toggle', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '<div id="restore-target">Target element</div>';
    Element.prototype.scrollIntoView = vi.fn() as unknown as Element['scrollIntoView'];
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    document.elementFromPoint = vi.fn().mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderWithOpenViewer(note: Note, repo: NotesRepository) {
    const prefsRepo = makePrefsRepo();
    let restoreNote: ((noteId: string) => void) | null = null;

    render(
      <HameshApp
        repo={repo}
        prefsRepo={prefsRepo}
        initialLang="en"
        registerActivate={() => {}}
        registerRestoreNote={(fn) => {
          restoreNote = fn;
        }}
      />,
    );

    await waitFor(() => expect(restoreNote).not.toBeNull());
    // Reuse RESTORE_NOTE purely as a way to get the viewer open in this
    // test — the pin toggle itself doesn't care how the viewer got there.
    restoreNote!(note.id);
    await screen.findByText(note.content);
  }

  it('pinning a note calls repo.setPinned and flips the toggle to pressed', async () => {
    const note = makeNote({ pinned: false });
    const repo = makeRepo([note]);
    (repo.setPinned as ReturnType<typeof vi.fn>).mockResolvedValue({ ...note, pinned: true });

    await renderWithOpenViewer(note, repo);

    const pinButton = screen.getByRole('button', { name: 'Pin this note' });
    expect(pinButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(pinButton);

    // handleTogglePin uses the component's *current-page* pageKey (matching
    // handleUpdate/handleDelete), not the note's own stored pageKey — they
    // happen to be the same in production (HameshApp only ever manages
    // notes for the page it's mounted on) but jsdom's default test URL
    // differs from the note fixture's pageKey, so compute it the same way.
    const currentPageKey = generatePageKey(location.href);
    await waitFor(() => expect(repo.setPinned).toHaveBeenCalledWith(note.id, currentPageKey, true));
    expect(await screen.findByRole('button', { name: 'Unpin this note' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('unpinning an already-pinned note calls repo.setPinned with false', async () => {
    const note = makeNote({ pinned: true });
    const repo = makeRepo([note]);
    (repo.setPinned as ReturnType<typeof vi.fn>).mockResolvedValue({ ...note, pinned: false });

    await renderWithOpenViewer(note, repo);

    const pinButton = screen.getByRole('button', { name: 'Unpin this note' });
    expect(pinButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(pinButton);

    const currentPageKey = generatePageKey(location.href);
    await waitFor(() =>
      expect(repo.setPinned).toHaveBeenCalledWith(note.id, currentPageKey, false),
    );
  });
});
