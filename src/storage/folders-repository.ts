import type { Folder, CreateFolderInput } from '@/domain/folder';
import { createFolder, renameFolder, parseFolderState } from '@/domain/folder';
import { getDescendantFolderIds } from '@/domain/folder-grouping';

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
  /** Fires on changes from any extension context, backed by
   *  `chrome.storage.onChanged` — same pattern as `PreferencesRepository`. */
  watch(cb: (folders: Folder[]) => void): () => void;
}

export function createFoldersRepository(): FoldersRepository {
  return {
    async getAll(): Promise<Folder[]> {
      const data = await storage.getItem<unknown>(STORAGE_KEY);
      return parseFolderState(data);
    },

    async create(input: CreateFolderInput): Promise<Folder> {
      const folder = createFolder(input);
      const existing = await this.getAll();
      existing.push(folder);
      await storage.setItem(STORAGE_KEY, existing);
      return folder;
    },

    async rename(folderId: string, name: string): Promise<Folder | null> {
      const existing = await this.getAll();
      const index = existing.findIndex((f) => f.id === folderId);
      if (index === -1) return null;

      const updated = renameFolder(existing[index], name);
      existing[index] = updated;
      await storage.setItem(STORAGE_KEY, existing);
      return updated;
    },

    async remove(folderId: string): Promise<{ removedFolderIds: string[] }> {
      const existing = await this.getAll();
      const toRemove = getDescendantFolderIds(existing, folderId);
      const remaining = existing.filter((f) => !toRemove.has(f.id));
      await storage.setItem(STORAGE_KEY, remaining);
      return { removedFolderIds: [...toRemove] };
    },

    watch(cb: (folders: Folder[]) => void): () => void {
      return storage.watch<unknown>(STORAGE_KEY, (newValue) => {
        cb(parseFolderState(newValue));
      });
    },
  };
}
