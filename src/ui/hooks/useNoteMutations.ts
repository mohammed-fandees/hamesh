import { useCallback, useEffect, useMemo, useRef } from 'react';
import { mayMutateNote, type CreateNoteInput, type Note } from '@/domain/note';
import type { NotesRepository } from '@/storage/notes-repository';
import { useWork } from './useWork';

/**
 * The notes a surface is showing, as the mutations see them. `current` is read
 * at the moment of a change — never a copy captured when the surface rendered —
 * and `commit` is how the surface takes the result.
 */
export interface NoteList {
  current(): readonly Note[];
  commit(next: Note[]): void;
}

/**
 * Every change a reader can make to one of their notes, in one place — for the
 * note viewer on a web page and for the Notes Library alike.
 *
 * Each one finds the note, refuses a team's note (`mayMutateNote` — hiding the
 * control is never what stops the write), asks the repository, and hands the
 * surface the result. Busy and failed are reported per note through `useWork`,
 * so a failure is said beside the note it happened to rather than swallowed.
 *
 * Pinning is tracked apart from the rest: it is a metadata toggle, not a save,
 * so it never shows a note as busy — but a pin that fails is still reported.
 */
export interface NoteMutations {
  create(input: CreateNoteInput): Promise<Note | null>;
  update(noteId: string, content: string): Promise<Note | null>;
  togglePin(noteId: string): Promise<Note | null>;
  move(noteId: string, folderId: string | undefined): Promise<Note | null>;
  remove(noteId: string): Promise<boolean>;
  /** Unfiles every note filed in any of `folderIds` — what deleting a folder
   *  does to its notes. Notes are never deleted with a folder. */
  unfile(folderIds: ReadonlySet<string>): Promise<void>;
  /** A new note is being written. */
  creating: boolean;
  createFailed: boolean;
  /** This note is being saved, moved or deleted. */
  busy(noteId: string): boolean;
  /** This note's last change failed. */
  failed(noteId: string): boolean;
}

const CREATE = 'create';
const noteKey = (id: string) => `note:${id}`;
const pinKey = (id: string) => `pin:${id}`;

export function useNoteMutations(
  repo: NotesRepository,
  list: NoteList,
  options?: {
    /** For a surface that says a failure in one place rather than beside each
     *  note — the page's one open card — called whenever a write fails. */
    onFailure?: () => void;
  },
): NoteMutations {
  const onFailure = useRef(options?.onFailure);
  useEffect(() => {
    onFailure.current = options?.onFailure;
  });
  const work = useWork(() => {
    onFailure.current?.();
    return true;
  });
  const { run } = work;
  // The surface may hand a new `list` each render; what a mutation needs is
  // whichever is current when it runs.
  const listRef = useRef(list);
  useEffect(() => {
    listRef.current = list;
  });

  const find = (id: string) => listRef.current.current().find((n) => n.id === id);
  const replace = (next: Note) =>
    listRef.current.commit(listRef.current.current().map((n) => (n.id === next.id ? next : n)));

  /** A change to one of this device's own notes, under `key`. */
  const change = useCallback(
    (key: string, noteId: string, write: (note: Note) => Promise<Note | null>) =>
      run(key, async () => {
        const note = find(noteId);
        if (!note || !mayMutateNote(note)) return null;
        const updated = await write(note);
        if (updated) replace(updated);
        return updated;
      }),
    // `find`/`replace` read the ref, never a captured list.
    [run],
  );

  const create = useCallback(
    (input: CreateNoteInput) =>
      run(CREATE, async () => {
        const note = await repo.create(input);
        listRef.current.commit([...listRef.current.current(), note]);
        return note;
      }),
    [run, repo],
  );

  const update = useCallback(
    (noteId: string, content: string) =>
      change(noteKey(noteId), noteId, (note) => repo.update(note.id, note.pageKey, { content })),
    [change, repo],
  );

  const togglePin = useCallback(
    (noteId: string) =>
      change(pinKey(noteId), noteId, (note) => repo.setPinned(note.id, note.pageKey, !note.pinned)),
    [change, repo],
  );

  const move = useCallback(
    (noteId: string, folderId: string | undefined) =>
      change(noteKey(noteId), noteId, (note) => repo.setFolder(note.id, note.pageKey, folderId)),
    [change, repo],
  );

  const remove = useCallback(
    async (noteId: string) => {
      const done = await run(noteKey(noteId), async () => {
        const note = find(noteId);
        if (!note || !mayMutateNote(note)) return false;
        const deleted = await repo.delete(note.id, note.pageKey);
        if (deleted) {
          listRef.current.commit(listRef.current.current().filter((n) => n.id !== noteId));
        }
        return deleted;
      });
      return done === true;
    },
    [run, repo],
  );

  const unfile = useCallback(
    async (folderIds: ReadonlySet<string>) => {
      const filed = listRef.current
        .current()
        .filter((n) => mayMutateNote(n) && n.folderId && folderIds.has(n.folderId));
      await Promise.all(filed.map((n) => move(n.id, undefined)));
    },
    [move],
  );

  const { working, failed } = work;
  return useMemo(
    () => ({
      create,
      update,
      togglePin,
      move,
      remove,
      unfile,
      creating: working(CREATE),
      createFailed: failed(CREATE) !== null,
      busy: (noteId: string) => working(noteKey(noteId)),
      failed: (noteId: string) =>
        failed(noteKey(noteId)) !== null || failed(pinKey(noteId)) !== null,
    }),
    [create, update, togglePin, move, remove, unfile, working, failed],
  );
}
