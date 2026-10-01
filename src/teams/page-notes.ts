import { browser } from 'wxt/browser';
import type { Note } from '@/domain/note';
import type { Lang } from '@/ui/i18n';
import { newRequestId } from './operation-names';
import { readPageNotes, watchPageNotes, watchTeamIndex } from './page-cache';
import { readPeople, watchPeople, type PeopleDirectory } from './people-cache';
import type {
  Destination,
  PageRequest,
  PageResult,
  TeamsPageMessage,
  ThreadPreview,
} from './page-channel';

/**
 * The content script's whole view of Teams: the notes a team has shared on the
 * page it is drawing, the words for saying so, and the little a shared note's
 * popup may ask of the worker.
 *
 * The notes themselves are read from what the worker already cached for this
 * page (see ./page-cache.ts) — no session, no server. A content script runs
 * inside an arbitrary web page, so beyond that it may only ask the worker the
 * few things in ./page-channel.ts, each checked against this very page.
 *
 * Reached only behind this build's Teams constant, so a build without Teams
 * drops it along with everything it imports.
 */
export interface TeamNotesSource {
  /** The team notes cached for one page, already shaped as notes. */
  read(pageKey: string): Promise<Note[]>;
  /** Fires when this page's team notes change, or when the teams themselves do. */
  watch(pageKey: string, onChange: () => void): () => void;
  /** Who is in the teams — a name and a picture for each shared note's pin. */
  people(): Promise<PeopleDirectory>;
  /** Fires when the worker gathers the people again. */
  watchPeople(onChange: (people: PeopleDirectory) => void): () => void;
  /** "Shared with <team>", for a note that has one. */
  label(note: Note, lang: Lang): string | undefined;
  /** The latest of a team note's discussion — see `./page-channel.ts`. */
  thread(teamId: string, noteId: string): Promise<PageResult<ThreadPreview>>;
  /** Adds a comment to a team note's discussion. */
  reply(teamId: string, noteId: string, body: string): Promise<PageResult<null>>;
  /** Opens the note's whole discussion beside the page, in the side panel. */
  openDiscussion(teamId: string, noteId: string): Promise<void>;
  /** Opens the note's own page in Hamesh, in a tab. */
  openInHamesh(teamId: string, noteId: string): Promise<void>;
  /** The teams a new note can go to, with their folders. */
  destinations(): Promise<PageResult<Destination[]>>;
  /** Shares a note this device holds for this page; the local copy then goes. */
  share(noteId: string, teamId: string, folderId: string | null): Promise<PageResult<null>>;
}

/** Asks the worker, through the one channel a page may use. */
async function ask<T>(request: PageRequest): Promise<PageResult<T>> {
  try {
    const reply = (await browser.runtime.sendMessage({
      type: 'TEAMS_PAGE',
      request,
    } satisfies TeamsPageMessage)) as PageResult<T> | undefined;
    return reply ?? { ok: false, error: 'unavailable' };
  } catch {
    return { ok: false, error: 'unavailable' };
  }
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
    people: readPeople,
    watchPeople,
    label(note, lang) {
      return note.team ? sharedWithTeam(note.team.name, lang) : undefined;
    },
    thread: (teamId, noteId) => ask({ op: 'thread', teamId, noteId }),
    // A fresh key each time: a retry of the same reply is one comment, not two.
    reply: (teamId, noteId, body) =>
      ask({ op: 'reply', teamId, noteId, body, requestId: newRequestId() }),
    openDiscussion: async (teamId, noteId) => {
      await ask({ op: 'open', teamId, noteId });
    },
    openInHamesh: async (teamId, noteId) => {
      await ask({ op: 'open', teamId, noteId, in: 'hamesh' });
    },
    destinations: () => ask({ op: 'destinations' }),
    share: (noteId, teamId, folderId) => ask({ op: 'share', noteId, teamId, folderId }),
  };
}
