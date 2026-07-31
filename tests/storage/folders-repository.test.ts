import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { createFoldersRepository } from '@/storage/folders-repository';

describe('FoldersRepository', () => {
  const repo = createFoldersRepository();

  beforeEach(() => {
    mockStore.store.clear();
    mockStore.watchers.clear();
  });

  describe('getAll', () => {
    it('returns an empty array when nothing is stored', async () => {
      expect(await repo.getAll()).toEqual([]);
    });

    it('recovers from a malformed stored value instead of throwing', async () => {
      mockStore.store.set('local:hamesh:folders', 'not-an-array');
      await expect(repo.getAll()).resolves.toEqual([]);
    });
  });

  describe('create', () => {
    it('adds a top-level folder and returns it', async () => {
      const folder = await repo.create({ name: 'Work' });
      expect(folder.name).toBe('Work');
      expect(folder.parentId).toBeNull();

      const all = await repo.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(folder.id);
    });

    it('adds a nested folder under the given parent', async () => {
      const parent = await repo.create({ name: 'Work' });
      const child = await repo.create({ name: 'Research', parentId: parent.id });
      expect(child.parentId).toBe(parent.id);
    });

    it('persists under a single, stable storage key', async () => {
      await repo.create({ name: 'Work' });
      expect(mockStore.store.has('local:hamesh:folders')).toBe(true);
    });
  });

  describe('rename', () => {
    it('renames a folder and persists it', async () => {
      const folder = await repo.create({ name: 'Old name' });
      const renamed = await repo.rename(folder.id, 'New name');
      expect(renamed?.name).toBe('New name');

      const all = await repo.getAll();
      expect(all[0].name).toBe('New name');
    });

    it('returns null for an unknown folder id', async () => {
      const result = await repo.rename('nonexistent', 'New name');
      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('removes a folder with no descendants', async () => {
      const folder = await repo.create({ name: 'Work' });
      const { removedFolderIds } = await repo.remove(folder.id);
      expect(removedFolderIds).toEqual([folder.id]);
      expect(await repo.getAll()).toEqual([]);
    });

    it('cascades to remove every descendant folder too', async () => {
      const work = await repo.create({ name: 'Work' });
      const research = await repo.create({ name: 'Research', parentId: work.id });
      const papers = await repo.create({ name: 'Papers', parentId: research.id });
      const personal = await repo.create({ name: 'Personal' }); // unrelated sibling

      const { removedFolderIds } = await repo.remove(work.id);
      expect(new Set(removedFolderIds)).toEqual(new Set([work.id, research.id, papers.id]));

      const remaining = await repo.getAll();
      expect(remaining.map((f) => f.id)).toEqual([personal.id]);
    });

    it('returns just the folder id when removing an unknown folder (nothing to cascade)', async () => {
      const { removedFolderIds } = await repo.remove('nonexistent');
      expect(removedFolderIds).toEqual(['nonexistent']);
    });
  });

  describe('watch', () => {
    it('notifies watchers when folders change — including changes made by another caller', async () => {
      const seen: number[] = [];
      const unwatch = repo.watch((folders) => seen.push(folders.length));

      await storage.setItem('local:hamesh:folders', [
        { id: 'f1', name: 'Work', parentId: null, createdAt: 'a', updatedAt: 'b' },
      ]);

      expect(seen).toEqual([1]);
      unwatch();

      await storage.setItem('local:hamesh:folders', []);
      expect(seen).toEqual([1]); // no further notifications after unwatch
    });
  });
});
