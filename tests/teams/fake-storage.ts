import { vi } from 'vitest';

/**
 * A stand-in for WXT's `storage`, good enough for the team-note cache: the
 * handful of calls it makes, plus watchers that actually fire — which is how the
 * content script learns the worker wrote something.
 *
 * Imported before the module under test so its global is in place first.
 */
export const store = new Map<string, unknown>();
const watchers = new Map<string, Set<(value: unknown) => void>>();

function notify(key: string): void {
  for (const cb of watchers.get(key) ?? []) cb(store.get(key) ?? null);
}

export const fakeStorage = {
  getItem: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
  setItem: vi.fn((key: string, value: unknown) => {
    store.set(key, value);
    notify(key);
    return Promise.resolve();
  }),
  removeItem: vi.fn((key: string) => {
    store.delete(key);
    notify(key);
    return Promise.resolve();
  }),
  removeItems: vi.fn((keys: string[]) => {
    for (const key of keys) {
      store.delete(key);
      notify(key);
    }
    return Promise.resolve();
  }),
  snapshot: vi.fn((area: string) => {
    const prefix = `${area}:`;
    return Promise.resolve(
      Object.fromEntries(
        [...store.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => [key.slice(prefix.length), value]),
      ),
    );
  }),
  watch: vi.fn((key: string, cb: (value: unknown) => void) => {
    const set = watchers.get(key) ?? new Set();
    set.add(cb);
    watchers.set(key, set);
    return () => set.delete(cb);
  }),
};

(globalThis as unknown as { storage: unknown }).storage = fakeStorage;

export function resetStorage(): void {
  store.clear();
  watchers.clear();
}
