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

  describe('saveAll', () => {
    it('writes notes back into the per-page buckets they belong to', async () => {
      await repo.saveAll([
        {
          id: 'a',
          schemaVersion: 1,
          pageKey: 'https://a.example/page',
          originalUrl: 'https://a.example/page',
          content: 'first',
          anchor: makeAnchor(),
          workspaceId: 'default',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'b',
          schemaVersion: 1,
          pageKey: 'https://b.example/page',
          originalUrl: 'https://b.example/page',
          content: 'second',
          anchor: makeAnchor(),
          workspaceId: 'default',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);

      expect((await repo.getForPage('https://a.example/page')).map((n) => n.id)).toEqual(['a']);
      expect((await repo.getForPage('https://b.example/page')).map((n) => n.id)).toEqual(['b']);
      expect((await repo.getAll()).map((n) => n.id).sort()).toEqual(['a', 'b']);
    });

    it('leaves pages it was not given alone', async () => {
      // `saveAll` is only ever handed a superset by the import flow — a
      // version that cleared unmentioned pages would turn a restore into a
      // wipe.
      const untouched = await repo.create({
        content: 'keep me',
        pageKey: 'https://other.example/page',
        originalUrl: 'https://other.example/page',
        anchor: makeAnchor(),
      });

      await repo.saveAll([]);

      expect((await repo.getForPage('https://other.example/page')).map((n) => n.id)).toEqual([
        untouched.id,
      ]);
    });
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

  describe('setFolder', () => {
    it('files a note into a folder and persists it', async () => {
      const created = await repo.create({
        content: 'x',
        pageKey,
        originalUrl: 'u',
        anchor: makeAnchor(),
      });

      const updated = await repo.setFolder(created.id, pageKey, 'folder-1');
      expect(updated?.folderId).toBe('folder-1');

      const notes = await repo.getForPage(pageKey);
      expect(notes[0].folderId).toBe('folder-1');
    });

    it('unfiles a note by passing undefined', async () => {
      const created = await repo.create({
        content: 'x',
        pageKey,
        originalUrl: 'u',
        anchor: makeAnchor(),
      });
      await repo.setFolder(created.id, pageKey, 'folder-1');

      const updated = await repo.setFolder(created.id, pageKey, undefined);
      expect(updated?.folderId).toBeUndefined();
    });

    it('does not change updatedAt', async () => {
      const created = await repo.create({
        content: 'x',
        pageKey,
        originalUrl: 'u',
        anchor: makeAnchor(),
      });

      const updated = await repo.setFolder(created.id, pageKey, 'folder-1');
      expect(updated?.updatedAt).toBe(created.updatedAt);
    });

    it('returns null for an unknown note id', async () => {
      const result = await repo.setFolder('nonexistent', pageKey, 'folder-1');
      expect(result).toBeNull();
    });
  });

  describe('workspaceId backfill', () => {
    it('stamps a default workspaceId on newly created notes', async () => {
      const note = await repo.create({
        content: 'x',
        pageKey,
        originalUrl: 'u',
        anchor: makeAnchor(),
      });
      expect(note.workspaceId).toBe('default');
    });

    it('backfills a default workspaceId for notes stored before the field existed', async () => {
      const key = `local:hamesh:notes:${pageKey}`;
      const legacyNote = {
        id: 'legacy-1',
        schemaVersion: 1,
        pageKey,
        originalUrl: 'u',
        content: 'legacy note',
        anchor: makeAnchor(),
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      mockStore.set(key, [legacyNote]);

      const notes = await repo.getForPage(pageKey);
      expect(notes).toHaveLength(1);
      expect(notes[0].workspaceId).toBe('default');
    });
  });
});
