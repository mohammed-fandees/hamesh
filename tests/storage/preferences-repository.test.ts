import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const watchers = new Map<string, Set<(v: unknown) => void>>();
  (globalThis as unknown as { storage: unknown }).storage = {
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
  };
  return { store, watchers };
});

import { createPreferencesRepository } from '@/storage/preferences-repository';

describe('PreferencesRepository', () => {
  const repo = createPreferencesRepository();

  beforeEach(() => {
    mockStore.store.clear();
    mockStore.watchers.clear();
  });

  it('defaults to no explicit language and Match Website appearance when nothing is stored', async () => {
    expect(await repo.get()).toEqual({
      schemaVersion: 1,
      language: null,
      appearance: 'match-website',
      textNotes: { enabled: true, selectionAction: true },
      releaseNotes: { lastSeenVersion: null },
      folderDefaults: { global: null, pages: {} },
    });
  });

  it('persists a chosen language and returns it from get()', async () => {
    await repo.setLanguage('ar');
    expect((await repo.get()).language).toBe('ar');
  });

  it('persists a chosen appearance and returns it from get()', async () => {
    await repo.setAppearance('dark');
    expect((await repo.get()).appearance).toBe('dark');
  });

  it('persists under a single, stable storage key', async () => {
    await repo.setLanguage('en');
    expect(mockStore.store.has('local:hamesh:preferences')).toBe(true);
  });

  it('overwrites a previous choice rather than accumulating state', async () => {
    await repo.setLanguage('ar');
    await repo.setLanguage('en');
    expect((await repo.get()).language).toBe('en');
  });

  it('setting appearance does not clobber a previously set language, and vice versa', async () => {
    await repo.setLanguage('ar');
    await repo.setAppearance('dark');
    expect(await repo.get()).toEqual({
      schemaVersion: 1,
      language: 'ar',
      appearance: 'dark',
      textNotes: { enabled: true, selectionAction: true },
      releaseNotes: { lastSeenVersion: null },
      folderDefaults: { global: null, pages: {} },
    });

    await repo.setLanguage('en');
    expect(await repo.get()).toEqual({
      schemaVersion: 1,
      language: 'en',
      appearance: 'dark',
      textNotes: { enabled: true, selectionAction: true },
      releaseNotes: { lastSeenVersion: null },
      folderDefaults: { global: null, pages: {} },
    });
  });

  it('recovers from a malformed stored value instead of throwing', async () => {
    mockStore.store.set('local:hamesh:preferences', 'not-an-object');
    await expect(repo.get()).resolves.toEqual({
      schemaVersion: 1,
      language: null,
      appearance: 'match-website',
      textNotes: { enabled: true, selectionAction: true },
      releaseNotes: { lastSeenVersion: null },
      folderDefaults: { global: null, pages: {} },
    });
  });

  it('notifies watchers when the preference changes — including changes made by another caller (cross-context)', async () => {
    const seen: Array<string | null> = [];
    const unwatch = repo.watch((prefs) => seen.push(prefs.language));

    // Simulate a write from a different context (e.g. the popup) touching the
    // same underlying storage key directly.
    await storage.setItem('local:hamesh:preferences', { schemaVersion: 1, language: 'ar' });

    expect(seen).toEqual(['ar']);
    unwatch();

    await storage.setItem('local:hamesh:preferences', { schemaVersion: 1, language: 'en' });
    expect(seen).toEqual(['ar']); // no further notifications after unwatch
  });

  describe('default folders', () => {
    const PAGE_A = 'https://a.example/article';
    const PAGE_B = 'https://b.example/post';

    it('persists a page default and reads it back', async () => {
      await repo.setPageDefaultFolder(PAGE_A, 'folder-1');
      expect((await repo.get()).folderDefaults).toEqual({
        global: null,
        pages: { [PAGE_A]: 'folder-1' },
      });
    });

    it("keeps each page's default independent of every other page's and of the global one", async () => {
      await repo.setGlobalDefaultFolder('folder-g');
      await repo.setPageDefaultFolder(PAGE_A, 'folder-a');
      await repo.setPageDefaultFolder(PAGE_B, 'folder-b');
      await repo.setPageDefaultFolder(PAGE_A, 'folder-a2');

      expect((await repo.get()).folderDefaults).toEqual({
        global: 'folder-g',
        pages: { [PAGE_A]: 'folder-a2', [PAGE_B]: 'folder-b' },
      });
    });

    it("clears one page's default without touching the rest", async () => {
      await repo.setGlobalDefaultFolder('folder-g');
      await repo.setPageDefaultFolder(PAGE_A, 'folder-a');
      await repo.setPageDefaultFolder(PAGE_B, 'folder-b');

      await repo.setPageDefaultFolder(PAGE_A, null);

      expect((await repo.get()).folderDefaults).toEqual({
        global: 'folder-g',
        pages: { [PAGE_B]: 'folder-b' },
      });
    });

    it('sets and clears the global default without touching page defaults', async () => {
      await repo.setPageDefaultFolder(PAGE_A, 'folder-a');
      await repo.setGlobalDefaultFolder('folder-g');
      expect((await repo.get()).folderDefaults.global).toBe('folder-g');

      await repo.setGlobalDefaultFolder(null);
      expect((await repo.get()).folderDefaults).toEqual({
        global: null,
        pages: { [PAGE_A]: 'folder-a' },
      });
    });

    it('does not disturb any other preference', async () => {
      await repo.setLanguage('ar');
      await repo.setAppearance('dark');
      await repo.setPageDefaultFolder(PAGE_A, 'folder-a');
      const prefs = await repo.get();
      expect(prefs.language).toBe('ar');
      expect(prefs.appearance).toBe('dark');
    });

    it('returns the preferences it wrote', async () => {
      const next = await repo.setPageDefaultFolder(PAGE_A, 'folder-a');
      expect(next).toEqual(await repo.get());
    });
  });
});
