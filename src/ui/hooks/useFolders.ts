import { useCallback, useEffect, useState } from 'react';
import type { CreateFolderInput, Folder } from '@/domain/folder';
import type { FoldersRepository } from '@/storage/folders-repository';

export interface FoldersState {
  /** Every folder; `null` until storage has answered, so "loading" is never "none". */
  folders: Folder[] | null;
  /** Makes a folder and has it in `folders` at once — a selector can choose it
   *  the moment it exists, before the storage watch has caught up. */
  create: (input: CreateFolderInput) => Promise<Folder>;
}

/**
 * Every folder, kept live — loaded once, then followed through `watch`, so a
 * folder made or removed in the Library shows in a composer already open on a
 * web page, and the other way round.
 *
 * A folder made here is adopted locally as well as arriving through the watch;
 * both paths go through `adopt`, which keys by id, so whichever lands second
 * changes nothing.
 */
export function useFolders(repo: FoldersRepository): FoldersState {
  const [folders, setFolders] = useState<Folder[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const all = await repo.getAll().catch(() => [] as Folder[]);
      if (!cancelled) setFolders((current) => current ?? all);
    })();
    const unwatch = repo.watch(setFolders);
    return () => {
      cancelled = true;
      unwatch();
    };
  }, [repo]);

  const create = useCallback(
    async (input: CreateFolderInput) => {
      const folder = await repo.create(input);
      setFolders((prev) =>
        (prev ?? []).some((f) => f.id === folder.id) ? prev : [...(prev ?? []), folder],
      );
      return folder;
    },
    [repo],
  );

  return { folders, create };
}
