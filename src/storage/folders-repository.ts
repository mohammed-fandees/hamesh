import type { Folder, CreateFolderInput } from '@/domain/folder';
import { createFolder, renameFolder, parseFolderState } from '@/domain/folder';
import { getDescendantFolderIds } from '@/domain/folder-grouping';
import { createStoredList } from './stored-list';

const STORAGE_KEY = 'local:hamesh:folders';

export interface FoldersRepository {
  getAll(): Promise<Folder[]>;
  create(input: CreateFolderInput): Promise<Folder>;
  rename(folderId: string, name: string): Promise<Folder | null>;
  /** Removes the folder and every descendant folder (cascade on the folder
   *  tree only — never touches notes). Returns the full set of removed ids
   *  so the caller can unfile whichever notes belonged to any of them;
   *  `folders-repository` and `notes-repository` stay decoupled from each
   *  other, so that orchestration lives one level up (see `App.tsx`'s
   *  `handleDeleteFolder`). */
  remove(folderId: string): Promise<{ removedFolderIds: string[] }>;
  /** Replaces the whole folder list — the restore half of local backup.
   *  Same division of labour as `NotesRepository.saveAll`: the merge policy
   *  lives in `domain/backup.ts`, this only persists the result. */
  saveAll(folders: Folder[]): Promise<void>;
  /** Fires on changes from any extension context, backed by
   *  `chrome.storage.onChanged` — same pattern as `PreferencesRepository`. */
  watch(cb: (folders: Folder[]) => void): () => void;
}

export function createFoldersRepository(): FoldersRepository {
  const list = createStoredList<Folder>(parseFolderState);

  return {
    getAll: () => list.read(STORAGE_KEY),

    async create(input) {
      const folder = createFolder(input);
      await list.append(STORAGE_KEY, folder);
      return folder;
    },

    rename: (folderId, name) => list.update(STORAGE_KEY, folderId, (f) => renameFolder(f, name)),

    async remove(folderId) {
      const existing = await list.read(STORAGE_KEY);
      const toRemove = getDescendantFolderIds(existing, folderId);
      await list.write(
        STORAGE_KEY,
        existing.filter((f) => !toRemove.has(f.id)),
      );
      return { removedFolderIds: [...toRemove] };
    },

    saveAll: (folders) => list.write(STORAGE_KEY, folders),

    watch(cb) {
      return storage.watch<unknown>(STORAGE_KEY, (newValue) => {
        cb(parseFolderState(newValue));
      });
    },
  };
}
