import type { Note } from '@/domain/note';
import { generatePageKey } from '@/domain/page-key';
import { resolveFolderId } from '@/domain/folder-grouping';
import type { TeamsClient } from '@/teams/client';
import { readTeamIndex, toNote, type CachedTeam } from '@/teams/page-cache';

/**
 * Every team note this device holds, shaped as notes, for the Notes Library.
 *
 * The Library shows a reader everything they can see — their own notes and the
 * ones their teams have shared — in one list, because that is how a person
 * thinks of them. Sharing a note should not make it vanish from the place they
 * keep their notes; it should leave it where it is, wearing a team's name.
 *
 * Nothing is fetched from the server here. The background worker has already
 * pulled each team's changes and filed them by page; this only asks the worker
 * to hand back what it holds, which is the same local read the Teams page does.
 */
export interface LibraryTeamNotes {
  notes: Note[];
  teams: CachedTeam[];
}

export const NO_TEAM_NOTES: LibraryTeamNotes = { notes: [], teams: [] };

/**
 * The newest mention this account has, or null — what the sidebar's dot is
 * compared against. One small request, and the only thing the library asks the
 * server for on behalf of Teams.
 */
export async function newestMentionId(client: TeamsClient): Promise<string | null> {
  const result = await client.request('mentions.list', {});
  return result.ok ? (result.data.mentions[0]?.commentId ?? null) : null;
}

export async function readTeamNotesForLibrary(client: TeamsClient): Promise<LibraryTeamNotes> {
  const index = await readTeamIndex();
  if (index.teams.length === 0) return NO_TEAM_NOTES;

  const snapshots = await Promise.all(
    index.teams.map(async (team) => {
      const result = await client.cache('notes', team.id);
      return result.ok ? { team, notes: result.data.notes, folders: result.data.folders } : null;
    }),
  );

  const notes: Note[] = [];
  for (const snapshot of snapshots) {
    if (!snapshot) continue;
    const knownFolders = new Set(snapshot.folders.map((f) => f.id));
    for (const cached of snapshot.notes) {
      // The same page key the content script asks for its own page with, so a
      // team note lands in the same site group as the reader's own notes on it.
      // A folder deleted on the server leaves its notes unfiled — the same rule
      // every folder view follows — so the Library's "Unfiled" filter finds
      // them instead of neither filter matching.
      const filed = { ...cached, folderId: resolveFolderId(cached.folderId, knownFolders) };
      notes.push(toNote(filed, generatePageKey(cached.originalUrl), snapshot.team.name));
    }
  }
  return { notes, teams: index.teams };
}
