import { browser } from 'wxt/browser';
import { groupNotesByPageKey } from '@/domain/backup';
import type { Note, CreateNoteInput, UpdateNoteInput } from '@/domain/note';
import {
  createNote,
  updateNoteContent,
  setNotePinned,
  setNoteFolder,
  validateNoteContent,
} from '@/domain/note';
import { DEFAULT_WORKSPACE_ID } from '@/domain/workspace';
import { createStoredList, type LocalKey } from './stored-list';

const STORAGE_KEY_PREFIX = 'hamesh:notes:';
const WATCH_SETTLE_MS = 40;

function storageKey(pageKey: string): string {
  return `${STORAGE_KEY_PREFIX}${pageKey}`;
}

function parseStoredNotes(data: unknown): Note[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((item): item is Note => {
      if (!item || typeof item !== 'object') return false;
      return typeof (item as Note).id === 'string' && typeof (item as Note).pageKey === 'string';
    })
    .map((note) => ({
      ...note,
      // Backfill for notes written before `workspaceId` existed — same
      // defensive-parse pattern as every other additive field here.
      workspaceId: note.workspaceId ?? DEFAULT_WORKSPACE_ID,
    }));
}

export interface NotesRepository {
  getForPage(pageKey: string): Promise<Note[]>;
  create(input: CreateNoteInput): Promise<Note>;
  update(noteId: string, pageKey: string, input: UpdateNoteInput): Promise<Note | null>;
  delete(noteId: string, pageKey: string): Promise<boolean>;
  getAll(): Promise<Note[]>;
  setPinned(noteId: string, pageKey: string, pinned: boolean): Promise<Note | null>;
  setFolder(noteId: string, pageKey: string, folderId: string | undefined): Promise<Note | null>;
  /** Writes a whole set of notes across every page they belong to — the
   *  restore half of local backup. Takes the already-merged result rather
   *  than merging here: what to do when a note exists on both sides is a
   *  policy decision, and it lives in `domain/backup.ts` where it can be
   *  reasoned about and tested without storage. */
  saveAll(notes: Note[]): Promise<void>;
  /** Fires when one page's notes change, from any tab or context. */
  watchPage(pageKey: string, onChange: () => void): () => void;
  /** Fires when any page's notes change, from any tab or context. Several writes
   *  close together (a restore, a note moving) are one call. */
  watchAll(onChange: () => void): () => void;
}

const notesAt = (pageKey: string): LocalKey => `local:${storageKey(pageKey)}`;

export function createNotesRepository(): NotesRepository {
  const list = createStoredList<Note>(parseStoredNotes);

  return {
    getForPage: (pageKey) => list.read(notesAt(pageKey)),

    async create(input) {
      const note = createNote(input);
      await list.append(notesAt(input.pageKey), note);
      return note;
    },

    async update(noteId, pageKey, input) {
      // Every content write is validated here, whichever editor it came from.
      if (validateNoteContent(input.content)) return null;
      return list.update(notesAt(pageKey), noteId, (note) => updateNoteContent(note, input));
    },

    async delete(noteId, pageKey) {
      return (await list.removeWhere(notesAt(pageKey), (n) => n.id === noteId)) > 0;
    },

    async getAll() {
      const snapshot = await storage.snapshot('local');
      const allNotes: Note[] = [];
      for (const [key, value] of Object.entries(snapshot)) {
        if (key.startsWith(STORAGE_KEY_PREFIX)) {
          allNotes.push(...parseStoredNotes(value));
        }
      }
      return allNotes;
    },

    setPinned: (noteId, pageKey, pinned) =>
      list.update(notesAt(pageKey), noteId, (note) => setNotePinned(note, pinned)),

    setFolder: (noteId, pageKey, folderId) =>
      list.update(notesAt(pageKey), noteId, (note) => setNoteFolder(note, folderId)),

    async saveAll(notes) {
      const byPage = groupNotesByPageKey(notes);
      // One write per page bucket, matching how notes are stored. Pages
      // absent from `notes` are deliberately left untouched — `saveAll` is
      // only ever handed a superset by the import flow, and a version that
      // cleared unmentioned pages would turn a restore into a wipe.
      await Promise.all(
        [...byPage.entries()].map(([pageKey, pageNotes]) =>
          list.write(notesAt(pageKey), pageNotes),
        ),
      );
    },

    watchPage: (pageKey, onChange) => storage.watch<unknown>(notesAt(pageKey), () => onChange()),

    watchAll(onChange) {
      let pending: ReturnType<typeof setTimeout> | undefined;
      const listener = (changes: Record<string, unknown>, area: string) => {
        if (area !== 'local') return;
        if (!Object.keys(changes).some((key) => key.startsWith(STORAGE_KEY_PREFIX))) return;
        clearTimeout(pending);
        pending = setTimeout(onChange, WATCH_SETTLE_MS);
      };
      browser.storage.onChanged.addListener(listener);
      return () => {
        clearTimeout(pending);
        browser.storage.onChanged.removeListener(listener);
      };
    },
  };
}
