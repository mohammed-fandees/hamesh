import { describe, it, expect } from 'vitest';
import {
  buildFolderTree,
  getDescendantFolderIds,
  flattenFolderTree,
  resolveFolderId,
  countInFolder,
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

  it('files notes by whatever folder it is told they are in — a team note by its team folder', () => {
    const papers = { id: 'team-folder', name: 'Papers', parentId: null };
    const filed = makeNote({
      team: { id: 'T', name: 'Team', version: 1, authorId: null, folderId: 'team-folder' },
    });
    const loose = makeNote({
      team: { id: 'T', name: 'Team', version: 1, authorId: null, folderId: null },
    });
    const { tree, unfiledNotes } = buildFolderTree(
      [papers],
      [filed, loose],
      (note) => note.team?.folderId,
    );
    expect(tree[0]!.folder).toBe(papers);
    expect(tree[0]!.notes).toEqual([filed]);
    expect(unfiledNotes).toEqual([loose]);
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
    const notes = [makeNote({ id: 'filed', folderId: 'orphan' })];
    const { tree, unfiledNotes } = buildFolderTree([orphan], notes);
    // Shown at the top rather than lost — and with it the notes filed into it,
    // which used to vanish from the folder view altogether.
    expect(tree.map((n) => n.folder.id)).toEqual(['orphan']);
    expect(tree[0].notes.map((n) => n.id)).toEqual(['filed']);
    expect(unfiledNotes).toEqual([]);
  });

  it('shows folders caught in a parent cycle instead of dropping them', () => {
    const a = makeFolder({ id: 'a', name: 'A', parentId: 'b' });
    const b = makeFolder({ id: 'b', name: 'B', parentId: 'a' });
    const { tree } = buildFolderTree([a, b], []);
    expect(tree.map((n) => n.folder.id)).toEqual(['a']);
    expect(tree[0].children.map((n) => n.folder.id)).toEqual(['b']);
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

describe('flattenFolderTree', () => {
  it('returns an empty list for no folders', () => {
    expect(flattenFolderTree([])).toEqual([]);
  });

  it('walks parents before children, in name order, recording depth and parent', () => {
    const work = makeFolder({ id: 'work', name: 'Work' });
    const research = makeFolder({ id: 'research', name: 'Research', parentId: 'work' });
    const personal = makeFolder({ id: 'personal', name: 'Personal' });

    const flat = flattenFolderTree([work, research, personal]);
    expect(flat.map((f) => [f.folder.name, f.depth, f.parent?.id ?? null])).toEqual([
      ['Personal', 0, null],
      ['Work', 0, null],
      ['Research', 1, 'work'],
    ]);
  });

  it('works on any folder shape — a team folder with epoch timestamps too', () => {
    const flat = flattenFolderTree([
      { id: 'b', name: 'B', parentId: 'a', createdAt: 1, updatedAt: 1 },
      { id: 'a', name: 'A', parentId: null, createdAt: 1, updatedAt: 1 },
    ]);
    expect(flat.map((f) => [f.folder.id, f.depth])).toEqual([
      ['a', 0],
      ['b', 1],
    ]);
  });

  it('lists every folder once, even through a cycle or a missing parent', () => {
    const flat = flattenFolderTree([
      makeFolder({ id: 'x', name: 'X', parentId: 'y' }),
      makeFolder({ id: 'y', name: 'Y', parentId: 'x' }),
      makeFolder({ id: 'z', name: 'Z', parentId: 'gone' }),
    ]);
    expect(flat.map((f) => f.folder.id).sort()).toEqual(['x', 'y', 'z']);
  });
});

describe('resolveFolderId', () => {
  const known = new Set(['work']);

  it('keeps a folder that exists', () => {
    expect(resolveFolderId('work', known)).toBe('work');
  });

  it('treats no folder, and a folder that has gone, as unfiled', () => {
    expect(resolveFolderId(undefined, known)).toBeNull();
    expect(resolveFolderId(null, known)).toBeNull();
    expect(resolveFolderId('', known)).toBeNull();
    expect(resolveFolderId('deleted', known)).toBeNull();
  });
});

describe('countInFolder', () => {
  it('counts a folder, and counts notes in a vanished folder as unfiled', () => {
    const known = new Set(['work']);
    const ids = ['work', 'work', null, 'deleted', undefined];
    expect(countInFolder(ids, known, 'work')).toBe(2);
    expect(countInFolder(ids, known, null)).toBe(3);
  });
});
