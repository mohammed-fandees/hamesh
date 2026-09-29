import { describe, it, expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createIdbSessionStore } from '@/teams/session-store';

function store(now = () => 1_000) {
  return createIdbSessionStore({ indexedDB: new IDBFactory(), now });
}

describe('IndexedDB session store', () => {
  it('starts empty', async () => {
    expect(await store().get()).toBeNull();
  });

  it('keeps a session and hands it back', async () => {
    const s = store();
    await s.set({ token: 'tok', expiresAt: 5_000 });
    expect(await s.get()).toEqual({ token: 'tok', expiresAt: 5_000 });
  });

  it('forgets a session on clear', async () => {
    const s = store();
    await s.set({ token: 'tok', expiresAt: 5_000 });
    await s.clear();
    expect(await s.get()).toBeNull();
  });

  it('drops an expired session instead of returning it', async () => {
    let now = 1_000;
    const s = store(() => now);
    await s.set({ token: 'tok', expiresAt: 2_000 });
    now = 2_000;
    expect(await s.get()).toBeNull();
    now = 0; // even if the clock goes back, it is gone
    expect(await s.get()).toBeNull();
  });

  it('refuses to store a malformed session', async () => {
    const s = store();
    await expect(s.set({ token: '', expiresAt: 5_000 })).rejects.toThrow();
    await expect(s.set({ token: 'x'.repeat(513), expiresAt: 5_000 })).rejects.toThrow();
    await expect(s.set({ token: 'tok', expiresAt: Number.NaN })).rejects.toThrow();
  });

  it('keeps separate databases apart', async () => {
    const factory = new IDBFactory();
    const a = createIdbSessionStore({ indexedDB: factory, dbName: 'a', now: () => 0 });
    const b = createIdbSessionStore({ indexedDB: factory, dbName: 'b', now: () => 0 });
    await a.set({ token: 'tok', expiresAt: 5 });
    expect(await b.get()).toBeNull();
  });
});
