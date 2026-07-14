import type { Note } from '@/domain/note';
import { derivePageLabel } from '@/domain/notes-grouping';
import type { Lang, Strings } from './i18n';
import { relativeTime } from './i18n';

interface NoteRowProps {
  note: Note;
  strings: Strings;
  lang: Lang;
}

/** A single note's compact preview inside an expanded website group. The
 *  note's own text is the focal point (larger, primary-ink serif); the page
 *  label and timestamp recede as secondary/tertiary context, since the note
 *  content — not the page it came from — is what a returning user is
 *  scanning for. Read-only in this phase; opening a note back up on its page
 *  is PR2 scope. */
export function NoteRow({ note, strings, lang }: NoteRowProps) {
  return (
    <div className="hm-note-row">
      <p className="hm-note-row__title">{derivePageLabel(note)}</p>
      <p className="hm-note-row__preview" dir="auto">
        {note.content}
      </p>
      <p className="hm-note-row__meta">{strings.editedAgo(relativeTime(note.updatedAt, lang))}</p>
    </div>
  );
}
