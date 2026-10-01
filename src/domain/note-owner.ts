import { isSharedNote, type Note } from './note';

/**
 * Whose notes the Library is showing: everyone's, only the reader's own, or one
 * team's — and, for a team, optionally just one of its folders (`id: null` is
 * the notes the team has filed nowhere). The folder's name travels with it,
 * because the Library holds no team folders of its own and only needs the name
 * to say what it is narrowed to.
 */
export type NoteOwner =
  'all' | 'mine' | { teamId: string; folder?: { id: string | null; name: string } };

/** Whether `note` belongs in the list `owner` asked for. A team note's folder
 *  has already been resolved against the team's folders when it was read, so
 *  one in a folder that has since gone counts as unfiled. */
export function matchesOwner(note: Note, owner: NoteOwner): boolean {
  if (owner === 'all') return true;
  if (owner === 'mine') return !isSharedNote(note);
  if (note.team?.id !== owner.teamId) return false;
  if (!owner.folder) return true;
  return note.team.folderId === owner.folder.id;
}
