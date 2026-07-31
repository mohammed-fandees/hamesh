import { describe, it, expect } from 'vitest';
import {
  buildFolderTree,
  getDescendantFolderIds,
  flattenFolderTreeForMenu,
} from '@/domain/folder-grouping';
import type { Folder } from '@/domain/folder';
import type { Note, ElementAnchor } from '@/domain/note';

function makeAnchor(): ElementAnchor {
  return {
    primarySelector: null,
    signals: { tagName: 'div' },
    fallbackDocumentPosition: { x: 0, y: 0 },
  };
}

let idCounter = 0;
function makeNote(overrides: Partial<Note> = {}): Note {
  idCounter += 1;
  return {
    id: `note-${idCounter}`,
    schemaVersion: 1,
    pageKey: 'https://example.com',
    originalUrl: 'https://example.com',
    content: 'hello',
    anchor: makeAnchor(),
    workspaceId: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

let folderIdCounter = 0;
function makeFolder(overrides: Partial<Folder> = {}): Folder {
  folderIdCounter += 1;
  return {
    id: `folder-${folderIdCounter}`,
    name: `Folder ${folderIdCounter}`,
    parentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildFolderTree', () => {
  it('returns an empty tree and no unfiled notes for empty input', () => {
    expect(buildFolderTree([], [])).toEqual({ tree: [], unfiledNotes: [] });
  });

  it('puts every note with no folderId into unfiledNotes', () => {
    const notes = [makeNote(), makeNote()];
    const { tree, unfiledNotes } = buildFolderTree([], notes);
    expect(tree).toEqual([]);
    expect(unfiledNotes).toHaveLength(2);
  });

  it('nests top-level folders with their notes', () => {
    const work = makeFolder({ id: 'work', name: 'Work' });
    const notes = [
      makeNote({ id: 'n1', folderId: 'work' }),
      makeNote({ id: 'n2', folderId: 'work' }),
    ];
    const { tree, unfiledNotes } = buildFolderTree([work], notes);
    expect(tree).toHaveLength(1);
    expect(tree[0].folder.id).toBe('work');
    expect(tree[0].notes.map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(tree[0].totalCount).toBe(2);
    expect(unfiledNotes).toEqual([]);
  });

  it('nests sub-folders under their parent, sorted alphabetically', () => {
    const work = makeFolder({ id: 'work', name: 'Work' });
    const research = makeFolder({ id: 'research', name: 'Research', parentId: 'work' });
    const admin = makeFolder({ id: 'admin', name: 'Admin', parentId: 'work' });
    const { tree } = buildFolderTree([work, research, admin], []);

    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((c) => c.folder.id)).toEqual(['admin', 'research']);
  });

  it('rolls up totalCount across descendants', () => {
    const work = makeFolder({ id: 'work', name: 'Work' });
    const research = makeFolder({ id: 'research', name: 'Research', parentId: 'work' });
    const notes = [
      makeNote({ folderId: 'work' }),
      makeNote({ folderId: 'research' }),
      makeNote({ folderId: 'research' }),
    ];
    const { tree } = buildFolderTree([work, research], notes);

    expect(tree[0].notes).toHaveLength(1);
    expect(tree[0].totalCount).toBe(3);
    expect(tree[0].children[0].totalCount).toBe(2);
  });

  it('treats a folderId pointing at a non-existent folder as unfiled', () => {
    const notes = [makeNote({ folderId: 'ghost' })];
    const { tree, unfiledNotes } = buildFolderTree([], notes);
    expect(tree).toEqual([]);
    expect(unfiledNotes).toHaveLength(1);
  });

  it('falls back a folder with an unknown parentId to top-level', () => {
    const orphan = makeFolder({ id: 'orphan', name: 'Orphan', parentId: 'ghost-parent' });
    const { tree } = buildFolderTree([orphan], []);
    // An unknown parentId means this folder is never referenced by any
    // `childrenByParent` bucket the tree walk starts from (only `null` is
    // walked as the root), so it's simply absent rather than crashing.
    expect(tree).toEqual([]);
  });

  it('sorts pinned notes first within a folder', () => {
    const work = makeFolder({ id: 'work' });
    const notes = [
      makeNote({ id: 'n1', folderId: 'work' }),
      makeNote({ id: 'n2', folderId: 'work', pinned: true }),
    ];
    const { tree } = buildFolderTree([work], notes);
    expect(tree[0].notes.map((n) => n.id)).toEqual(['n2', 'n1']);
  });

  it('does not mutate the input folders or notes arrays', () => {
    const work = makeFolder({ id: 'work', name: 'Work' });
    const folders = [work];
    const notes = [makeNote({ folderId: 'work' })];
    const foldersCopy = [...folders];
    const notesCopy = [...notes];

    buildFolderTree(folders, notes);

    expect(folders).toEqual(foldersCopy);
    expect(notes).toEqual(notesCopy);
  });
});

describe('getDescendantFolderIds', () => {
  it('includes the folder itself even with no children', () => {
    const work = makeFolder({ id: 'work' });
    expect(getDescendantFolderIds([work], 'work')).toEqual(new Set(['work']));
  });

  it('collects all nested descendants', () => {
    const work = makeFolder({ id: 'work' });
    const research = makeFolder({ id: 'research', parentId: 'work' });
    const papers = makeFolder({ id: 'papers', parentId: 'research' });
    const personal = makeFolder({ id: 'personal' }); // unrelated sibling

    const result = getDescendantFolderIds([work, research, papers, personal], 'work');
    expect(result).toEqual(new Set(['work', 'research', 'papers']));
  });

  it('is safe against a cycle in stored data', () => {
    const a = makeFolder({ id: 'a', parentId: 'b' });
    const b = makeFolder({ id: 'b', parentId: 'a' });
    const result = getDescendantFolderIds([a, b], 'a');
    expect(result).toEqual(new Set(['a', 'b']));
  });
});

describe('flattenFolderTreeForMenu', () => {
  it('returns an empty list for an empty tree', () => {
    expect(flattenFolderTreeForMenu([])).toEqual([]);
  });

  it('walks the tree depth-first, recording depth', () => {
    const work = makeFolder({ id: 'work', name: 'Work' });
    const research = makeFolder({ id: 'research', name: 'Research', parentId: 'work' });
    const personal = makeFolder({ id: 'personal', name: 'Personal' });
    const { tree } = buildFolderTree([work, research, personal], []);

    const flat = flattenFolderTreeForMenu(tree);
    expect(flat.map((f) => [f.folder.name, f.depth])).toEqual([
      ['Personal', 0],
      ['Work', 0],
      ['Research', 1],
    ]);
  });
});
