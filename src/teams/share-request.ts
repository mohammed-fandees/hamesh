import type { Note } from '@/domain/note';

/**
 * What sharing one of this device's notes with a team sends — the one shape,
 * whether the Library shares it or the worker does on a page's behalf.
 *
 * The note's own id travels as the idempotency key, so sharing the same note
 * twice is the same share, not a second copy.
 */
export function shareParams(note: Note, teamId: string, folderId: string | null = null) {
  return {
    teamId,
    requestId: note.id,
    originalUrl: note.originalUrl,
    ...(note.pageContext?.title ? { pageTitle: note.pageContext.title } : {}),
    content: note.content,
    anchor: note.anchor,
    ...(folderId ? { folderId } : {}),
  };
}
