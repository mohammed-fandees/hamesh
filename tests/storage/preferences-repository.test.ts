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

  it('defaults to no explicit language when nothing is stored', async () => {
    expect(await repo.get()).toEqual({ schemaVersion: 1, language: null });
  });

  it('persists a chosen language and returns it from get()', async () => {
    await repo.setLanguage('ar');
    expect(await repo.get()).toEqual({ schemaVersion: 1, language: 'ar' });
  });

  it('persists under a single, stable storage key', async () => {
    await repo.setLanguage('en');
    expect(mockStore.store.has('local:hamesh:preferences')).toBe(true);
  });

  it('overwrites a previous choice rather than accumulating state', async () => {
    await repo.setLanguage('ar');
    await repo.setLanguage('en');
    expect(await repo.get()).toEqual({ schemaVersion: 1, language: 'en' });
  });

  it('recovers from a malformed stored value instead of throwing', async () => {
    mockStore.store.set('local:hamesh:preferences', 'not-an-object');
    await expect(repo.get()).resolves.toEqual({ schemaVersion: 1, language: null });
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
});
