// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HameshApp } from '@/content/HameshApp';
import type { NotesRepository } from '@/storage/notes-repository';
import type { PreferencesRepository } from '@/storage/preferences-repository';
import type { FoldersRepository } from '@/storage/folders-repository';
import type { Note } from '@/domain/note';
import type { Folder } from '@/domain/folder';
import { DEFAULT_PREFERENCES, type Preferences } from '@/domain/preferences';
import { generatePageKey } from '@/domain/page-key';

/**
 * The composer's own lifecycle inside the real content-side app: what
 * closes it (and, as importantly, what no longer does), and how the folder
 * a new note is filed into gets chosen.
 */

const PAGE_HTML =
  '<article id="post"><p id="intro">Performance is extremely important in large applications.</p></article>';

function makeRepo(notes: Note[] = []): NotesRepository {
  return {
    getForPage: vi.fn().mockResolvedValue(notes),
    getAll: vi.fn().mockResolvedValue(notes),
    create: vi.fn(async (input) => ({
      id: 'created-note',
      schemaVersion: 1 as const,
      workspaceId: 'default',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...input,
    })),
    update: vi.fn(),
    delete: vi.fn(),
    setPinned: vi.fn(),
    setFolder: vi.fn(),
    saveAll: vi.fn(),
  };
}

function makePrefsRepo(prefs: Preferences = DEFAULT_PREFERENCES): PreferencesRepository {
  return {
    get: vi.fn().mockResolvedValue(prefs),
    watch: vi.fn().mockReturnValue(() => {}),
    setLanguage: vi.fn(),
    setAppearance: vi.fn(),
    setTextNotes: vi.fn(),
    setLastSeenReleaseVersion: vi.fn(),
    setPageDefaultFolder: vi.fn(async (pageKey: string, folderId: string | null) => ({
      ...prefs,
      folderDefaults: {
        ...prefs.folderDefaults,
        pages: folderId ? { [pageKey]: folderId } : {},
      },
    })),
    setGlobalDefaultFolder: vi.fn(async (folderId: string | null) => ({
      ...prefs,
      folderDefaults: { ...prefs.folderDefaults, global: folderId },
    })),
  };
}

function makeFoldersRepo(folders: Folder[] = []): FoldersRepository {
  return {
    getAll: vi.fn().mockResolvedValue(folders),
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    saveAll: vi.fn(),
    watch: vi.fn().mockReturnValue(() => {}),
  };
}

function makeFolder(id: string, name: string): Folder {
  return {
    id,
    name,
    parentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeElementNote(): Note {
  return {
    id: 'element-note',
    schemaVersion: 1,
    pageKey: generatePageKey(location.href),
    originalUrl: location.href,
    content: 'An existing element note',
    anchor: {
      primarySelector: '#intro',
      signals: { tagName: 'p' },
      fallbackDocumentPosition: { x: 0, y: 0 },
    },
    workspaceId: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderApp({
  repo = makeRepo(),
  prefsRepo = makePrefsRepo(),
  foldersRepo = makeFoldersRepo(),
}: {
  repo?: NotesRepository;
  prefsRepo?: PreferencesRepository;
  foldersRepo?: FoldersRepository;
} = {}) {
  let activateText: (() => void) | null = null;
  render(
    <HameshApp
      repo={repo}
      prefsRepo={prefsRepo}
      foldersRepo={foldersRepo}
      initialLang="en"
      registerActivate={() => {}}
      registerActivateVideo={() => {}}
      registerActivateText={(fn) => {
        activateText = fn;
      }}
      registerRestoreNote={() => {}}
    />,
  );
  return { repo, prefsRepo, foldersRepo, activateText: () => activateText?.() };
}

/** Selects text in the page and opens the composer on it via the shortcut
 *  path — the least incidental way into the one shared composer. */
async function openComposer(activateText: () => void): Promise<HTMLElement> {
  const text = document.getElementById('intro')!.firstChild as Text;
  const range = document.createRange();
  range.setStart(text, 15);
  range.setEnd(text, 34);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  await waitFor(() => {
    activateText();
    expect(screen.getByPlaceholderText('Write a note…')).toBeInTheDocument();
  });
  return screen.getByPlaceholderText('Write a note…');
}

const composerOpen = () => screen.queryByPlaceholderText('Write a note…') !== null;

describe('HameshApp — closing the composer', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = PAGE_HTML;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    document.elementFromPoint = vi.fn().mockReturnValue(null);
    const lineBox = {
      left: 40,
      top: 100,
      right: 240,
      bottom: 120,
      width: 200,
      height: 20,
      x: 40,
      y: 100,
    } as DOMRect;
    Range.prototype.getClientRects = vi.fn(
      () => [lineBox] as unknown as DOMRectList,
    ) as unknown as Range['getClientRects'];
    Range.prototype.getBoundingClientRect = vi.fn(() => lineBox);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stays open after a single click outside it, with the draft intact', async () => {
    const { activateText, repo } = renderApp();
    const textarea = await openComposer(activateText);
    fireEvent.change(textarea, { target: { value: 'Half-written thought' } });

    const outside = document.getElementById('intro')!;
    fireEvent.pointerDown(outside);
    fireEvent.mouseDown(outside);
    fireEvent.mouseUp(outside);
    fireEvent.click(outside);

    expect(composerOpen()).toBe(true);
    expect(screen.getByPlaceholderText('Write a note…')).toHaveValue('Half-written thought');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('closes on a double click outside it, saving nothing', async () => {
    const { activateText, repo } = renderApp();
    const textarea = await openComposer(activateText);
    fireEvent.change(textarea, { target: { value: 'Never mind' } });

    const outside = document.getElementById('intro')!;
    fireEvent.pointerDown(outside);
    fireEvent.pointerDown(outside);
    fireEvent.dblClick(outside);

    await waitFor(() => expect(composerOpen()).toBe(false));
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('clears the word a closing double click selected, rather than offering to annotate it', async () => {
    const { activateText } = renderApp();
    await openComposer(activateText);

    fireEvent.dblClick(document.getElementById('intro')!);

    await waitFor(() => expect(composerOpen()).toBe(false));
    expect(window.getSelection()!.rangeCount).toBe(0);
  });

  it('does not close on a double click inside the composer (selecting a word of the draft)', async () => {
    const { activateText } = renderApp();
    const textarea = await openComposer(activateText);

    fireEvent.pointerDown(textarea);
    fireEvent.dblClick(textarea);

    expect(composerOpen()).toBe(true);
  });

  it('still closes on Cancel', async () => {
    const { activateText } = renderApp();
    await openComposer(activateText);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(composerOpen()).toBe(false));
  });

  it('still closes on Escape', async () => {
    const { activateText } = renderApp();
    const textarea = await openComposer(activateText);
    fireEvent.keyDown(textarea, { key: 'Escape' });
    await waitFor(() => expect(composerOpen()).toBe(false));
  });

  it('leaves the note viewer closing on a single click outside, as before', async () => {
    renderApp({ repo: makeRepo([makeElementNote()]) });
    fireEvent.click(await screen.findByRole('button', { name: 'View note' }));
    expect(await screen.findByText('An existing element note')).toBeInTheDocument();

    fireEvent.pointerDown(document.getElementById('intro')!);

    await waitFor(() => expect(screen.queryByText('An existing element note')).toBeNull());
  });
});

describe('HameshApp — the folder a new note is filed into', () => {
  const pageKey = () => generatePageKey(location.href);
  const WORK = makeFolder('f-work', 'Work');
  const READING = makeFolder('f-reading', 'Reading');

  beforeEach(() => {
    cleanup();
    document.body.innerHTML = PAGE_HTML;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    document.elementFromPoint = vi.fn().mockReturnValue(null);
    const lineBox = { left: 40, top: 100, right: 240, bottom: 120, width: 200, height: 20 };
    Range.prototype.getClientRects = vi.fn(
      () => [lineBox] as unknown as DOMRectList,
    ) as unknown as Range['getClientRects'];
    Range.prototype.getBoundingClientRect = vi.fn(() => lineBox as DOMRect);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function withDefaults(global: string | null, pages: Record<string, string>): Preferences {
    return { ...DEFAULT_PREFERENCES, folderDefaults: { global, pages } };
  }

  async function saveNote(activateText: () => void, text: string) {
    fireEvent.change(await openComposer(activateText), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  }

  it("preselects this page's default folder, and files the note there", async () => {
    const { activateText, repo } = renderApp({
      prefsRepo: makePrefsRepo(withDefaults('f-reading', { [pageKey()]: 'f-work' })),
      foldersRepo: makeFoldersRepo([WORK, READING]),
    });
    await openComposer(activateText);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Folder' })).toHaveValue('f-work'),
    );

    await saveNote(activateText, 'Filed by page default');
    await waitFor(() => expect(repo.create).toHaveBeenCalledTimes(1));
    expect(vi.mocked(repo.create).mock.calls[0][0].folderId).toBe('f-work');
  });

  it('falls back to the global default on a page with no default of its own', async () => {
    const { activateText } = renderApp({
      prefsRepo: makePrefsRepo(withDefaults('f-reading', { 'https://elsewhere.test/': 'f-work' })),
      foldersRepo: makeFoldersRepo([WORK, READING]),
    });
    await openComposer(activateText);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Folder' })).toHaveValue('f-reading'),
    );
  });

  it('preselects nothing, and saves unfiled, when no default is set', async () => {
    const { activateText, repo } = renderApp({ foldersRepo: makeFoldersRepo([WORK, READING]) });
    await openComposer(activateText);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Folder' })).toHaveValue(''));

    await saveNote(activateText, 'Unfiled');
    await waitFor(() => expect(repo.create).toHaveBeenCalledTimes(1));
    expect(vi.mocked(repo.create).mock.calls[0][0].folderId).toBeUndefined();
  });

  it('stores a page default under this page only', async () => {
    const prefsRepo = makePrefsRepo();
    const { activateText } = renderApp({
      prefsRepo,
      foldersRepo: makeFoldersRepo([WORK, READING]),
    });
    await openComposer(activateText);
    const select = await screen.findByRole('combobox', { name: 'Folder' });
    await waitFor(() => expect(select.querySelectorAll('option').length).toBeGreaterThan(2));
    fireEvent.change(select, { target: { value: 'f-work' } });
    fireEvent.click(screen.getByRole('button', { name: 'Default folder' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Default for this page' }));

    expect(prefsRepo.setPageDefaultFolder).toHaveBeenCalledWith(pageKey(), 'f-work');
    expect(prefsRepo.setGlobalDefaultFolder).not.toHaveBeenCalled();
    // The star reflects the new default as soon as it's written.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Default folder' })).toHaveAttribute(
        'data-default',
        'true',
      ),
    );
  });

  it('puts the stored default back, and says so, when saving a default fails', async () => {
    const prefsRepo = makePrefsRepo();
    vi.mocked(prefsRepo.setPageDefaultFolder).mockRejectedValue(new Error('quota'));
    const { activateText } = renderApp({
      prefsRepo,
      foldersRepo: makeFoldersRepo([WORK, READING]),
    });
    await openComposer(activateText);
    const select = await screen.findByRole('combobox', { name: 'Folder' });
    await waitFor(() => expect(select.querySelectorAll('option').length).toBeGreaterThan(2));
    fireEvent.change(select, { target: { value: 'f-work' } });
    fireEvent.click(screen.getByRole('button', { name: 'Default folder' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Default for this page' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save");
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Default for this page' })).not.toBeChecked(),
    );
  });

  it('creates a folder from the empty state through the folders repository', async () => {
    const foldersRepo = makeFoldersRepo([]);
    vi.mocked(foldersRepo.create).mockResolvedValue(makeFolder('f-new', 'Research'));
    const { activateText, repo } = renderApp({ foldersRepo });
    fireEvent.change(await openComposer(activateText), { target: { value: 'First filed note' } });

    fireEvent.click(await screen.findByRole('button', { name: '+ Create folder' }));
    const name = screen.getByRole('textbox', { name: 'New folder' });
    fireEvent.change(name, { target: { value: 'Research' } });
    fireEvent.keyDown(name, { key: 'Enter' });

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Folder' })).toHaveValue('f-new'),
    );
    expect(foldersRepo.create).toHaveBeenCalledWith({ name: 'Research' });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(repo.create).toHaveBeenCalledTimes(1));
    expect(vi.mocked(repo.create).mock.calls[0][0].folderId).toBe('f-new');
  });
});
