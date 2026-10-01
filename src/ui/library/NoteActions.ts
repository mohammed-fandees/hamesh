import { createContext, useContext } from 'react';
import type { FlatFolder } from '@/domain/folder-grouping';

/**
 * What the Library can do to one of the reader's notes, for every list that
 * shows one — the site groups, the folder tree, Pinned.
 *
 * Provided once by the page that owns the notes (and their mutations), and read
 * by the note itself, instead of five handlers threaded through every list
 * that happens to hold a note. Busy and failed come from the same mutations
 * (`useNoteMutations`), so a note that could not be saved says so on its own
 * row rather than silently staying as it was.
 */
export interface NoteActions {
  togglePin: (noteId: string) => void;
  edit: (noteId: string, content: string) => Promise<boolean>;
  remove: (noteId: string) => Promise<boolean>;
  move: (noteId: string, folderId: string | undefined) => void;
  /** Makes a top-level folder and resolves to its id. */
  createFolder: (name: string) => Promise<string>;
  /** Every folder, parents before children — what "Move to folder" offers. */
  folders: readonly FlatFolder[];
  busy: (noteId: string) => boolean;
  failed: (noteId: string) => boolean;
}

export const NoteActionsContext = createContext<NoteActions | null>(null);

/** The Library's actions, or `null` where a note is only shown — a row with
 *  nothing to offer draws no menu. */
export function useNoteActions(): NoteActions | null {
  return useContext(NoteActionsContext);
}
