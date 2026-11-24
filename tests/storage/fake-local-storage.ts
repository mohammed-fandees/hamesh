import { vi } from 'vitest';

/**
 * WXT's `storage` global, kept in a Map, with `watch` firing on every `setItem` the way
 * `chrome.storage.onChanged` does (even for an identical value). Install it before importing a
 * repository.
 */
export function installFakeStorage() {
  const store = new Map<string, unknown>();
  const watchers = new Map<string, Set<(value: unknown) => void>>();
  const api = {
    getItem: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: vi.fn((key: string, value: unknown) => {
      store.set(key, structuredClone(value));
      for (const cb of watchers.get(key) ?? []) cb(structuredClone(value));
      return Promise.resolve();
    }),
    watch: vi.fn((key: string, cb: (value: unknown) => void) => {
      const set = watchers.get(key) ?? new Set();
      set.add(cb);
      watchers.set(key, set);
      return () => set.delete(cb);
    }),
    snapshot: vi.fn((area: string) =>
      Promise.resolve(
        Object.fromEntries(
          [...store.entries()]
            .filter(([k]) => k.startsWith(`${area}:`))
            .map(([k, v]) => [k.slice(area.length + 1), v]),
        ),
      ),
    ),
  };
  (globalThis as unknown as { storage: unknown }).storage = api;
  return { store, api };
}
