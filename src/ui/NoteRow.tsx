import type { Note } from '@/domain/note';
import type { Lang, Strings } from './i18n';
import { relativeTime } from './i18n';

interface NoteRowProps {
  note: Note;
  strings: Strings;
  lang: Lang;
}

/** A single note's compact preview inside an expanded website group —
 *  page title, note text (clamped, not truncated in JS so it stays
 *  reflow-friendly), and a relative last-edited timestamp. Read-only in this
 *  phase; opening a note back up on its page is PR2 scope. */
export function NoteRow({ note, strings, lang }: NoteRowProps) {
  const title = note.pageContext?.title?.trim() || strings.untitledPage;
  return (
    <div className="hm-note-row">
      <p className="hm-note-row__title">{title}</p>
      <p className="hm-note-row__preview" dir="auto">
        {note.content}
      </p>
      <p className="hm-note-row__meta">{strings.editedAgo(relativeTime(note.updatedAt, lang))}</p>
    </div>
  );
}
