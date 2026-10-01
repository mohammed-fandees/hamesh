import type { Note } from '@/domain/note';
import type { TeamsClient } from '@/teams/client';
import { Failure } from '../hooks/useWork';

/**
 * Hands a copy of one of this device's notes to a team — into one of its
 * folders, or unfiled.
 *
 * The one way a note is shared, whether from its menu or by dropping it on a
 * team's folder. The note's own id travels as the idempotency key, so sharing
 * the same note twice is the same share, not a second copy. Fails with the
 * server's refusal.
 */
export async function shareNote(
  client: TeamsClient,
  note: Note,
  teamId: string,
  folderId: string | null = null,
): Promise<void> {
  const result = await client.request('notes.share', {
    teamId,
    requestId: note.id,
    originalUrl: note.originalUrl,
    ...(note.pageContext?.title ? { pageTitle: note.pageContext.title } : {}),
    content: note.content,
    anchor: note.anchor,
    ...(folderId ? { folderId } : {}),
  });
  if (!result.ok) throw new Failure(result.error);
}
