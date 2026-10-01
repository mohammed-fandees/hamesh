import type { Folder, FolderLike } from './folder';
import type { Note } from './note';
import { sortNotesWithPinnedFirst } from './notes-grouping';

/** Folders by the folder they sit in (`null` = top level), each list in name order. */
export function indexFoldersByParent<T extends FolderLike>(
  folders: readonly T[],
): Map<string | null, T[]> {
  const byParent = new Map<string | null, T[]>();
  for (const folder of folders) {
    const bucket = byParent.get(folder.parentId);
    if (bucket) bucket.push(folder);
    else byParent.set(folder.parentId, [folder]);
  }
  for (const bucket of byParent.values()) bucket.sort((a, b) => a.name.localeCompare(b.name));
  return byParent;
}

/**
 * The folder a note is really in: its `folderId` if that folder still exists,
 * otherwise none. The one definition of "unfiled" — a note pointing at a folder
 * that has since gone (deleted elsewhere, not restored from a backup, removed on
 * the server) is unfiled, never hidden.
 */
export function resolveFolderId(
  folderId: string | null | undefined,
  knownIds: ReadonlySet<string>,
): string | null {
  return folderId && knownIds.has(folderId) ? folderId : null;
}

/** One folder in a flat walk of the tree. */
export interface FlatFolder<T extends FolderLike = Folder> {
  folder: T;
  depth: number;
  /** The folder it sits in, if any — what a nested folder is named by. */
  parent: T | null;
}

/**
 * Every folder, parents before their children, each with its depth — the list a
 * menu or a `<select>` shows, where indentation carries the nesting.
 *
 * Never trusts a parent chain: a cycle is walked once, and a folder whose parent
 * is missing (or is part of a cycle) is shown at the top rather than lost.
 */
export function flattenFolderTree<T extends FolderLike>(folders: readonly T[]): FlatFolder<T>[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const byParent = indexFoldersByParent(folders);
  const out: FlatFolder<T>[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of byParent.get(parentId) ?? []) {
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      out.push({ folder, depth, parent: parentId ? (byId.get(parentId) ?? null) : null });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  for (const folder of [...folders].sort((a, b) => a.name.localeCompare(b.name))) {
    if (seen.has(folder.id)) continue;
    seen.add(folder.id);
    out.push({ folder, depth: 0, parent: null });
    walk(folder.id, 1);
  }
  return out;
}

export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
  /** Notes filed directly into this folder (not descendants). */
  notes: Note[];
  /** This folder's own notes plus every descendant folder's notes. */
  totalCount: number;
}

/** Builds the nested folder tree (top-level folders, each recursively
 *  containing its children and notes) plus the list of notes that don't
 *  belong to any existing folder — see `resolveFolderId`. The tree is the
 *  same walk `flattenFolderTree` takes, so a folder with a dangling parent
 *  shows at the top level here too. Never throws on bad data. */
export function buildFolderTree(
  folders: Folder[],
  notes: Note[],
): { tree: FolderNode[]; unfiledNotes: Note[] } {
  const knownIds = new Set(folders.map((f) => f.id));
  const notesByFolderId = new Map<string, Note[]>();
  const unfiledNotes: Note[] = [];
  for (const note of notes) {
    const folderId = resolveFolderId(note.folderId, knownIds);
    if (folderId === null) {
      unfiledNotes.push(note);
      continue;
    }
    const bucket = notesByFolderId.get(folderId);
    if (bucket) bucket.push(note);
    else notesByFolderId.set(folderId, [note]);
  }

  // Nest the flat walk back into a tree: each entry's parent is the nearest
  // shallower entry above it, which is exactly how the walk emitted it.
  const tree: FolderNode[] = [];
  const path: FolderNode[] = [];
  for (const { folder, depth } of flattenFolderTree(folders)) {
    const node: FolderNode = {
      folder,
      children: [],
      notes: sortNotesWithPinnedFirst(notesByFolderId.get(folder.id) ?? []),
      totalCount: 0,
    };
    path.length = depth;
    if (depth === 0) tree.push(node);
    else path[depth - 1].children.push(node);
    path.push(node);
  }

  const count = (node: FolderNode): number =>
    (node.totalCount = node.notes.length + node.children.reduce((sum, c) => sum + count(c), 0));
  tree.forEach(count);

  return { tree, unfiledNotes: sortNotesWithPinnedFirst(unfiledNotes) };
}

/** Every folder id whose ancestry passes through `folderId` — `folderId`
 *  itself plus all of its descendants. Used to cascade a folder delete
 *  across its whole subtree, and to find every note that needs unfiling as
 *  a result. */
export function getDescendantFolderIds(
  folders: readonly FolderLike[],
  folderId: string,
): Set<string> {
  const byParent = indexFoldersByParent(folders);
  const result = new Set<string>();
  const stack = [folderId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (result.has(id)) continue; // cycle guard
    result.add(id);
    for (const child of byParent.get(id) ?? []) stack.push(child.id);
  }
  return result;
}

/** How many notes sit in a folder — or, for `null`, in none that still exists. */
export function countInFolder(
  folderIds: readonly (string | null | undefined)[],
  knownIds: ReadonlySet<string>,
  id: string | null,
): number {
  return folderIds.filter((folderId) => resolveFolderId(folderId, knownIds) === id).length;
}
