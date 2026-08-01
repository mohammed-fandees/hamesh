import type { Note } from '@/domain/note';
import { derivePageLabel, extractDomain } from '@/domain/notes-grouping';
import { formatVideoTimestamp } from '@/domain/video-markers';
import { isPlainLeftClick, openNoteAndRestore } from '@/entrypoints/notes/openNote';
import { Favicon } from './Favicon';
import { PinIcon } from './PinIcon';
import { PlayIcon } from './PlayIcon';
import type { Lang, Strings } from './i18n';
import { relativeTime } from './i18n';

interface NoteRowProps {
  note: Note;
  strings: Strings;
  lang: Lang;
  /** Shows a small favicon + domain kicker above the title — off by
   *  default, since the domain-grouped view already shows one favicon per
   *  group header (repeating it per row there would be redundant). The
   *  folder view has no such header (a folder can mix notes from several
   *  sites), so it turns this on — same "flat, cross-site list" reasoning
   *  `PinnedSection` already uses for its own per-item favicon. */
  showDomain?: boolean;
}

/** A single note's compact preview inside an expanded website group —
 *  page title (falls back to the URL pathname/hostname rather than a
 *  generic "Untitled page" when there's no captured title), note text
 *  (clamped, not truncated in JS so it stays reflow-friendly), and a
 *  relative last-edited timestamp — plus, for a video note, a small
 *  timestamp badge (e.g. "▶ 13:27") next to it.
 *
 *  A real `<a target="_blank">` to the note's original URL — right-click,
 *  ctrl/cmd-click, and middle-click all work natively. A plain left-click is
 *  intercepted to drive `openNoteAndRestore` instead, which opens the tab
 *  itself and restores the note. For an element note that's scroll +
 *  highlight + open the viewer; for a video note it's a seek to the stored
 *  timestamp only — same as clicking its on-page marker, no viewer (see
 *  `HameshApp.tsx`'s restore-flow branch).
 *
 *  Pinned notes show a small decorative pin badge. Pin/edit/delete/move
 *  live in the sibling `NoteActionsMenu` (`WebsiteGroup`/`FolderTree`), not
 *  here — this row is already a single full-row link, and a second
 *  interactive control can't nest inside an `<a>`. */
export function NoteRow({ note, strings, lang, showDomain }: NoteRowProps) {
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
      {showDomain && (
        <span className="hm-note-row__domain">
          <Favicon domain={extractDomain(note.originalUrl)} size={14} />
          {extractDomain(note.originalUrl)}
        </span>
      )}
      <p className="hm-note-row__title">
        {note.pinned && <PinIcon filled size={10} />}
        {derivePageLabel(note)}
      </p>
      <p className="hm-note-row__preview" dir="auto">
        {note.content}
      </p>
      <p className="hm-note-row__meta">
        {note.anchor.type === 'video' && (
          <span className="hm-note-row__video-badge">
            <PlayIcon size={9} />
            {formatVideoTimestamp(note.anchor.timestamp)}
          </span>
        )}
        {strings.editedAgo(relativeTime(note.updatedAt, lang))}
      </p>
    </a>
  );
}
