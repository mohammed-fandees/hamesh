import type { Folder } from './folder';
import type { Note } from './note';
import { sortNotesWithPinnedFirst } from './notes-grouping';

export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
  /** Notes filed directly into this folder (not descendants). */
  notes: Note[];
  /** This folder's own notes plus every descendant folder's notes. */
  totalCount: number;
}

function buildNode(
  folder: Folder,
  childrenByParent: Map<string | null, Folder[]>,
  notesByFolderId: Map<string, Note[]>,
  visiting: Set<string>,
): FolderNode {
  const notes = sortNotesWithPinnedFirst(notesByFolderId.get(folder.id) ?? []);
  // Defensive: a cycle in stored data (shouldn't be creatable by the app
  // itself — there's no reparenting UI in v1 — but never trust storage).
  // Stop descending into an ancestor already on the current path instead of
  // recursing forever.
  if (visiting.has(folder.id)) {
    return { folder, children: [], notes, totalCount: notes.length };
  }
  visiting.add(folder.id);
  const children = (childrenByParent.get(folder.id) ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((child) => buildNode(child, childrenByParent, notesByFolderId, visiting));
  visiting.delete(folder.id);
  const totalCount = notes.length + children.reduce((sum, c) => sum + c.totalCount, 0);
  return { folder, children, notes, totalCount };
}

/** Builds the nested folder tree (top-level folders, each recursively
 *  containing its children and notes) plus the list of notes that don't
 *  belong to any existing folder — either because they have no `folderId`,
 *  or because it points at a folder that no longer exists. Never throws on
 *  bad data, same philosophy as `notes-grouping.ts`'s `extractDomain`. */
export function buildFolderTree(
  folders: Folder[],
  notes: Note[],
): { tree: FolderNode[]; unfiledNotes: Note[] } {
  const folderIds = new Set(folders.map((f) => f.id));
  const childrenByParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const bucket = childrenByParent.get(folder.parentId);
    if (bucket) bucket.push(folder);
    else childrenByParent.set(folder.parentId, [folder]);
  }

  const notesByFolderId = new Map<string, Note[]>();
  const unfiledNotes: Note[] = [];
  for (const note of notes) {
    if (note.folderId && folderIds.has(note.folderId)) {
      const bucket = notesByFolderId.get(note.folderId);
      if (bucket) bucket.push(note);
      else notesByFolderId.set(note.folderId, [note]);
    } else {
      unfiledNotes.push(note);
    }
  }

  const topLevel = (childrenByParent.get(null) ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const visiting = new Set<string>();
  const tree = topLevel.map((folder) =>
    buildNode(folder, childrenByParent, notesByFolderId, visiting),
  );

  return { tree, unfiledNotes: sortNotesWithPinnedFirst(unfiledNotes) };
}

/** Every folder id whose ancestry passes through `folderId` — `folderId`
 *  itself plus all of its descendants. Used to cascade a folder delete
 *  across its whole subtree, and to find every note that needs unfiling as
 *  a result. */
export function getDescendantFolderIds(folders: Folder[], folderId: string): Set<string> {
  const childrenByParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const bucket = childrenByParent.get(folder.parentId);
    if (bucket) bucket.push(folder);
    else childrenByParent.set(folder.parentId, [folder]);
  }

  const result = new Set<string>();
  const stack = [folderId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (result.has(id)) continue; // cycle guard
    result.add(id);
    for (const child of childrenByParent.get(id) ?? []) {
      stack.push(child.id);
    }
  }
  return result;
}

/** Flat, depth-indented walk of the tree for `MoveToFolderMenu` — every
 *  folder reachable in a simple list (indentation communicates nesting),
 *  no nested-submenu UI needed. */
export function flattenFolderTreeForMenu(tree: FolderNode[]): { folder: Folder; depth: number }[] {
  const result: { folder: Folder; depth: number }[] = [];
  function walk(nodes: FolderNode[], depth: number) {
    for (const node of nodes) {
      result.push({ folder: node.folder, depth });
      walk(node.children, depth + 1);
    }
  }
  walk(tree, 0);
  return result;
}
