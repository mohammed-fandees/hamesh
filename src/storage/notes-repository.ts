import type { Note, CreateNoteInput, UpdateNoteInput } from '@/domain/note';
import { createNote, updateNoteContent, setNotePinned, validateNoteContent } from '@/domain/note';

const STORAGE_KEY_PREFIX = 'hamesh:notes:';

function storageKey(pageKey: string): string {
  return `${STORAGE_KEY_PREFIX}${pageKey}`;
}

function parseStoredNotes(data: unknown): Note[] {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is Note => {
    if (!item || typeof item !== 'object') return false;
    return typeof (item as Note).id === 'string' && typeof (item as Note).pageKey === 'string';
  });
}

export interface NotesRepository {
  getForPage(pageKey: string): Promise<Note[]>;
  create(input: CreateNoteInput): Promise<Note>;
  update(noteId: string, pageKey: string, input: UpdateNoteInput): Promise<Note | null>;
  delete(noteId: string, pageKey: string): Promise<boolean>;
  getAll(): Promise<Note[]>;
  setPinned(noteId: string, pageKey: string, pinned: boolean): Promise<Note | null>;
}

export function createNotesRepository(): NotesRepository {
  return {
    async getForPage(pageKey: string): Promise<Note[]> {
      const key = storageKey(pageKey);
      const data = await storage.getItem<Note[]>(`local:${key}`);
      return parseStoredNotes(data);
    },

    async create(input: CreateNoteInput): Promise<Note> {
      const note = createNote(input);
      const existing = await this.getForPage(input.pageKey);
      existing.push(note);
      const key = storageKey(input.pageKey);
      await storage.setItem(`local:${key}`, existing);
      return note;
    },

    async update(noteId: string, pageKey: string, input: UpdateNoteInput): Promise<Note | null> {
      const validationError = validateNoteContent(input.content);
      if (validationError) return null;

      const existing = await this.getForPage(pageKey);
      const index = existing.findIndex((n) => n.id === noteId);
      if (index === -1) return null;

      const updated = updateNoteContent(existing[index], input);
      existing[index] = updated;
      const key = storageKey(pageKey);
      await storage.setItem(`local:${key}`, existing);
      return updated;
    },

    async delete(noteId: string, pageKey: string): Promise<boolean> {
      const existing = await this.getForPage(pageKey);
      const filtered = existing.filter((n) => n.id !== noteId);
      if (filtered.length === existing.length) return false;
      const key = storageKey(pageKey);
      await storage.setItem(`local:${key}`, filtered);
      return true;
    },

    async getAll(): Promise<Note[]> {
      const snapshot = await storage.snapshot('local');
      const allNotes: Note[] = [];
      for (const [key, value] of Object.entries(snapshot)) {
        if (key.startsWith(STORAGE_KEY_PREFIX)) {
          allNotes.push(...parseStoredNotes(value));
        }
      }
      return allNotes;
    },

    async setPinned(noteId: string, pageKey: string, pinned: boolean): Promise<Note | null> {
      const existing = await this.getForPage(pageKey);
      const index = existing.findIndex((n) => n.id === noteId);
      if (index === -1) return null;

      const updated = setNotePinned(existing[index], pinned);
      existing[index] = updated;
      const key = storageKey(pageKey);
      await storage.setItem(`local:${key}`, existing);
      return updated;
    },
  };
}
