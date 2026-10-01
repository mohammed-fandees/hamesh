import type { Note } from '@/domain/note';
import type { TeamsClient } from '@/teams/client';
import { shareParams } from '@/teams/share-request';
import { Failure } from '../hooks/useWork';

/**
 * Hands a copy of one of this device's notes to a team — into one of its
 * folders, or unfiled.
 *
 * The one way the Library shares a note, whether from its menu or by dropping
 * it on a team's folder. Fails with the server's refusal.
 */
export async function shareNote(
  client: TeamsClient,
  note: Note,
  teamId: string,
  folderId: string | null = null,
): Promise<void> {
  const result = await client.request('notes.share', shareParams(note, teamId, folderId));
  if (!result.ok) throw new Failure(result.error);
}
