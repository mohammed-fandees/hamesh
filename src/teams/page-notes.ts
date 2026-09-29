import type { Note } from '@/domain/note';
import type { Lang } from '@/ui/i18n';
import { readPageNotes, watchPageNotes, watchTeamIndex } from './page-cache';

/**
 * The content script's whole view of Teams: the notes a team has shared on the
 * page it is drawing, and the words for saying so.
 *
 * Nothing here talks to the server, holds a session, or sends a message to the
 * background worker — it reads what the worker already cached for this page (see
 * ./page-cache.ts). That is deliberate: a content script runs inside an
 * arbitrary web page, so it is given the notes it is about to draw and nothing
 * else, and the worker's "only Hamesh's own pages may drive Teams" rule needs no
 * exception for it.
 *
 * Reached only behind this build's Teams constant, so a build without Teams
 * drops it along with everything it imports.
 */
export interface TeamNotesSource {
  /** The team notes cached for one page, already shaped as notes. */
  read(pageKey: string): Promise<Note[]>;
  /** Fires when this page's team notes change, or when the teams themselves do. */
  watch(pageKey: string, onChange: () => void): () => void;
  /** "Shared with <team>", for a note that has one. */
  label(note: Note, lang: Lang): string | undefined;
}

export function sharedWithTeam(team: string, lang: Lang): string {
  return lang === 'ar' ? `مُشاركة مع ${team}` : `Shared with ${team}`;
}

export function createTeamNotesSource(): TeamNotesSource {
  return {
    read: readPageNotes,
    watch(pageKey, onChange) {
      const unwatchPage = watchPageNotes(pageKey, onChange);
      // A team's name (or the fact this account is still in it) changes what a
      // shared note says, and whether it is drawn at all.
      const unwatchIndex = watchTeamIndex(() => onChange());
      return () => {
        unwatchPage();
        unwatchIndex();
      };
    },
    label(note, lang) {
      return note.team ? sharedWithTeam(note.team.name, lang) : undefined;
    },
  };
}
