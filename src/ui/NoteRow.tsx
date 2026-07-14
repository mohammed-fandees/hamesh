import type { Note } from '@/domain/note';
import { derivePageLabel } from '@/domain/notes-grouping';
import { isPlainLeftClick, openNoteAndRestore } from '@/entrypoints/notes/openNote';
import type { Lang, Strings } from './i18n';
import { relativeTime } from './i18n';

interface NoteRowProps {
  note: Note;
  strings: Strings;
  lang: Lang;
}

/** A single note's compact preview inside an expanded website group —
 *  page title (falls back to the URL pathname/hostname rather than a
 *  generic "Untitled page" when there's no captured title), note text
 *  (clamped, not truncated in JS so it stays reflow-friendly), and a
 *  relative last-edited timestamp.
 *
 *  A real `<a target="_blank">` to the note's original URL — right-click,
 *  ctrl/cmd-click, and middle-click all work natively. A plain left-click is
 *  intercepted to drive `openNoteAndRestore` instead, which opens the tab
 *  itself and restores the note (scrolls to it, highlights it, opens it)
 *  once that tab's content script is ready. */
export function NoteRow({ note, strings, lang }: NoteRowProps) {
  return (
    <a
      className="hm-note-row"
      href={note.originalUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (!isPlainLeftClick(e)) return;
        e.preventDefault();
        void openNoteAndRestore(note.originalUrl, note.id);
      }}
    >
      <p className="hm-note-row__title">{derivePageLabel(note)}</p>
      <p className="hm-note-row__preview" dir="auto">
        {note.content}
      </p>
      <p className="hm-note-row__meta">{strings.editedAgo(relativeTime(note.updatedAt, lang))}</p>
    </a>
  );
}
