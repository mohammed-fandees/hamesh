import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  (globalThis as unknown as { storage: unknown }).storage = {
    getItem: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
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
  return store;
});

import { createNotesRepository } from '@/storage/notes-repository';
import type { ElementAnchor } from '@/domain/note';

function makeAnchor(overrides?: Partial<ElementAnchor>): ElementAnchor {
  return {
    primarySelector: null,
    signals: { tagName: 'div' },
    fallbackDocumentPosition: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('NotesRepository', () => {
  const repo = createNotesRepository();
  const pageKey = 'https://example.com/page';

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  describe('create', () => {
    it('adds a note and returns it', async () => {
      const note = await repo.create({
        content: 'test note',
        pageKey,
        originalUrl: 'https://example.com/page',
        anchor: makeAnchor(),
      });

      expect(note.id).toBeTypeOf('string');
      expect(note.content).toBe('test note');
      expect(note.pageKey).toBe(pageKey);
    });
  });

  describe('getForPage', () => {
    it('retrieves notes for a page', async () => {
      await repo.create({ content: 'a', pageKey, originalUrl: 'u', anchor: makeAnchor() });
      await repo.create({ content: 'b', pageKey, originalUrl: 'u', anchor: makeAnchor() });

      const notes = await repo.getForPage(pageKey);
      expect(notes).toHaveLength(2);
      expect(notes.map((n) => n.content).sort()).toEqual(['a', 'b']);
    });

    it('returns empty array for unknown page', async () => {
      const notes = await repo.getForPage('https://unknown.com');
      expect(notes).toEqual([]);
    });
  });

  describe('update', () => {
    it('changes note content and updates updatedAt', async () => {
      const created = await repo.create({
        content: 'original',
        pageKey,
        originalUrl: 'u',
        anchor: makeAnchor(),
      });

      const updated = await repo.update(created.id, pageKey, { content: 'updated' });
      expect(updated).not.toBeNull();
      expect(updated!.content).toBe('updated');
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime(),
      );
    });

    it('returns null for unknown note id', async () => {
      const result = await repo.update('nonexistent', pageKey, { content: 'x' });
      expect(result).toBeNull();
    });

    it('returns null for empty content', async () => {
      const created = await repo.create({
        content: 'x',
        pageKey,
        originalUrl: 'u',
        anchor: makeAnchor(),
      });
      const result = await repo.update(created.id, pageKey, { content: '' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes a note', async () => {
      const created = await repo.create({
        content: 'x',
        pageKey,
        originalUrl: 'u',
        anchor: makeAnchor(),
      });

      const deleted = await repo.delete(created.id, pageKey);
      expect(deleted).toBe(true);

      const notes = await repo.getForPage(pageKey);
      expect(notes).toHaveLength(0);
    });

    it('returns false for unknown note', async () => {
      const result = await repo.delete('nonexistent', pageKey);
      expect(result).toBe(false);
    });
  });

  describe('getAll', () => {
    it('returns all notes across pages', async () => {
      await repo.create({
        content: 'a',
        pageKey: 'page1',
        originalUrl: 'u1',
        anchor: makeAnchor(),
      });
      await repo.create({
        content: 'b',
        pageKey: 'page2',
        originalUrl: 'u2',
        anchor: makeAnchor(),
      });

      const all = await repo.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('setPinned', () => {
    it('pins a note and persists it', async () => {
      const created = await repo.create({
        content: 'x',
        pageKey,
        originalUrl: 'u',
        anchor: makeAnchor(),
      });

      const updated = await repo.setPinned(created.id, pageKey, true);
      expect(updated?.pinned).toBe(true);

      const notes = await repo.getForPage(pageKey);
      expect(notes[0].pinned).toBe(true);
    });

    it('unpins a note', async () => {
      const created = await repo.create({
        content: 'x',
        pageKey,
        originalUrl: 'u',
        anchor: makeAnchor(),
      });
      await repo.setPinned(created.id, pageKey, true);

      const updated = await repo.setPinned(created.id, pageKey, false);
      expect(updated?.pinned).toBe(false);
    });

    it('does not change updatedAt', async () => {
      const created = await repo.create({
        content: 'x',
        pageKey,
        originalUrl: 'u',
        anchor: makeAnchor(),
      });

      const updated = await repo.setPinned(created.id, pageKey, true);
      expect(updated?.updatedAt).toBe(created.updatedAt);
    });

    it('returns null for an unknown note id', async () => {
      const result = await repo.setPinned('nonexistent', pageKey, true);
      expect(result).toBeNull();
    });
  });
});
