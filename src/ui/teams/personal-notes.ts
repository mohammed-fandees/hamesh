import type { TeamNote } from '@hamesh/teams-contract';

/**
 * The two things the Teams page needs from the personal library, so it can be
 * handed them rather than reaching into storage itself.
 *
 * Sharing a note moves it into the team: the copy the team now has is the one
 * shown on the page, so leaving a personal copy behind would draw the same note
 * twice. Taking it back does the reverse — the server hands the note back, and
 * it becomes personal again.
 */
export interface PersonalNotes {
  /** Forgets the local copy of a note that has just been shared. */
  forget: (noteId: string) => Promise<void>;
  /** Keeps a note that has just been taken back out of a team. */
  keep: (note: TeamNote) => Promise<void>;
}
