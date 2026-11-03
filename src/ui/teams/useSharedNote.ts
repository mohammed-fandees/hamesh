import { useState } from 'react';
import type { CachedTeamNote } from '@/teams/page-cache';
import type { PersonalNotes } from './personal-notes';
import type { TeamsPage } from './useTeams';

/** What is waiting to be confirmed for this note. */
export type Asking = 'delete' | 'unshare';

interface SharedNoteOptions {
  page: TeamsPage;
  teamId: string;
  note: CachedTeamNote | undefined;
  noteId: string;
  personal: PersonalNotes;
  /** After a change: what is shown next is what the server has. */
  reload: () => Promise<void>;
  /** The note is no longer in this team. */
  onGone: () => void;
}

/**
 * What can be done to one shared note, wherever it is being looked at: a row on
 * the team's page or the note's own page. Work and refusals are reported under
 * the note's own key, so they show beside it and nowhere else.
 */
export function useSharedNote({
  page,
  teamId,
  note,
  noteId,
  personal,
  reload,
  onGone,
}: SharedNoteOptions) {
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState<Asking | null>(null);
  const key = `note:${noteId}`;

  async function move(to: string | null) {
    if (!note) return;
    await page.run('notes.update', { teamId, noteId, version: note.version, folderId: to }, key);
    // A refused edit (someone else got there first) is reported beside the
    // note; either way what is shown afterwards is the server's version.
    await reload();
  }

  async function saveEdit(content: string) {
    if (!note) return;
    setEditing(false);
    if (content === note.content) return;
    await page.run('notes.update', { teamId, noteId, version: note.version, content }, key);
    await reload();
  }

  async function unshare() {
    const result = await page.run('notes.unshare', { teamId, noteId }, key);
    setAsking(null);
    if (!result) return;
    // Handed back, so it is kept: the note becomes a personal one again rather
    // than disappearing along with the team's copy.
    await personal.keep(result.note);
    onGone();
  }

  async function remove() {
    const gone = await page.run('notes.delete', { teamId, noteId }, key);
    setAsking(null);
    if (gone !== null) onGone();
  }

  return {
    working: page.working(key),
    failed: page.failed(key),
    editing,
    setEditing,
    asking,
    setAsking,
    move,
    saveEdit,
    unshare,
    remove,
  };
}
