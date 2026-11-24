import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { HameshApp } from '@/content/HameshApp';
import type { NotesRepository } from '@/storage/notes-repository';
import type { PreferencesRepository } from '@/storage/preferences-repository';
import type { FoldersRepository } from '@/storage/folders-repository';
import type { AnchorHealthRepository } from '@/storage/anchor-health-repository';
import { updateNoteAnchor, type Anchor, type Note } from '@/domain/note';
import { DEFAULT_PREFERENCES, type Preferences } from '@/domain/preferences';
import type { UsageEvent } from '@/domain/usage';

export const PAGE = 'http://localhost:3000/';

/** Notes kept in memory and changed the way the real repository changes them. */
export function memoryRepo(initial: Note[]): NotesRepository & { notes: () => Note[] } {
  let notes = [...initial];
  return {
    notes: () => notes,
    getForPage: vi.fn(async () => [...notes]),
    getAll: vi.fn(async () => [...notes]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setPinned: vi.fn(),
    setFolder: vi.fn(),
    setAnchor: vi.fn(async (id: string, _page: string, anchor: Anchor, capture) => {
      const found = notes.find((n) => n.id === id);
      if (!found) return null;
      const next = updateNoteAnchor(found, anchor, capture);
      notes = notes.map((n) => (n.id === id ? next : n));
      return next;
    }),
    saveAll: vi.fn(),
    watchPage: vi.fn(() => () => {}),
    watchAll: vi.fn(() => () => {}),
  };
}

export function prefsRepo(prefs: Preferences = DEFAULT_PREFERENCES): PreferencesRepository {
  return {
    get: vi.fn().mockResolvedValue(prefs),
    watch: vi.fn().mockReturnValue(() => {}),
    setLanguage: vi.fn(),
    setExport: vi.fn(),
    setAppearance: vi.fn(),
    setTextNotes: vi.fn(),
    setLastSeenReleaseVersion: vi.fn(),
    setLastSeenMention: vi.fn(),
    setSkipShareConsent: vi.fn(),
    setPageDefaultFolder: vi.fn(),
    setGlobalDefaultFolder: vi.fn(),
    setLibrary: vi.fn(),
    setOnboarding: vi.fn(),
    setAnnouncements: vi.fn(),
    setUsage: vi.fn(),
  };
}

export function foldersRepo(): FoldersRepository {
  return {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    saveAll: vi.fn(),
    watch: vi.fn().mockReturnValue(() => {}),
  };
}

export function noteOn(id: string, anchor: Anchor, content = `note ${id}`): Note {
  return {
    id,
    schemaVersion: 1,
    pageKey: PAGE,
    originalUrl: PAGE,
    content,
    anchor,
    workspaceId: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export const elementAt = (selector: string): Anchor => ({
  primarySelector: selector,
  signals: { tagName: 'section', textSnippet: 'The conditions of renaissance' },
  fallbackDocumentPosition: { x: 10, y: 10 },
});

export const wordsOf = (exact: string): Anchor => ({
  type: 'text',
  version: 1,
  exact,
  context: { prefix: '', suffix: '' },
  textPosition: { start: 0, end: exact.length },
});

/** jsdom has neither `matchMedia` nor `elementFromPoint`; both are stubbed as Chrome answers. */
export function stubBrowserBits(pointAt: Element | null = null) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
  document.elementFromPoint = vi.fn().mockReturnValue(pointAt);
  Element.prototype.scrollIntoView = vi.fn() as unknown as Element['scrollIntoView'];
}

export function renderPage({
  repo,
  healthRepo,
  prefs,
  lang = 'en',
  count = vi.fn(),
  onRestore,
  onActivateText,
}: {
  repo: NotesRepository;
  healthRepo: AnchorHealthRepository;
  prefs?: Preferences;
  lang?: 'en' | 'ar';
  count?: (event: UsageEvent) => void;
  onRestore?: (fn: (noteId: string) => void) => void;
  onActivateText?: (fn: () => void) => void;
}) {
  return render(
    <HameshApp
      repo={repo}
      prefsRepo={prefsRepo(prefs)}
      foldersRepo={foldersRepo()}
      healthRepo={healthRepo}
      initialLang={lang}
      count={count}
      registerActivate={() => {}}
      registerActivateVideo={() => {}}
      registerActivateText={onActivateText ?? (() => {})}
      registerRestoreNote={onRestore ?? (() => {})}
    />,
  );
}
