import type { CachedTeamNote } from '@/teams/page-cache';
import type { CachedFolder } from '@/teams/sync-store';

/** A folder and how deep it sits, for a flat list that reads as a tree. */
export interface FlatFolder {
  folder: CachedFolder;
  depth: number;
  /** The folder it sits in, if any — what a nested folder is named by. */
  parent: CachedFolder | null;
}

export function flattenFolders(folders: readonly CachedFolder[]): FlatFolder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const byParent = new Map<string | null, CachedFolder[]>();
  for (const folder of folders) {
    const bucket = byParent.get(folder.parentId);
    if (bucket) bucket.push(folder);
    else byParent.set(folder.parentId, [folder]);
  }
  const out: FlatFolder[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    const children = [...(byParent.get(parentId) ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const folder of children) {
      // Never trust a parent chain: a cycle would otherwise recurse forever.
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      out.push({ folder, depth, parent: parentId ? (byId.get(parentId) ?? null) : null });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  // A folder whose parent is missing (or part of a cycle) would be lost above,
  // so anything left over is shown at the top rather than hidden.
  for (const folder of folders) {
    if (!seen.has(folder.id)) out.push({ folder, depth: 0, parent: null });
  }
  return out;
}

/** How many notes are in a folder, or — for `null` — in none that still exists.
 *  A folder that has since gone leaves its notes unfiled, never hidden. */
export function countInFolder(
  notes: readonly CachedTeamNote[],
  folders: readonly FlatFolder[],
  id: string | null,
): number {
  const known = new Set(folders.map((f) => f.folder.id));
  return notes.filter((n) =>
    id === null ? !n.folderId || !known.has(n.folderId) : n.folderId === id,
  ).length;
}
