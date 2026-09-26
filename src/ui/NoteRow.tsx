import { useEffect, useId, useRef, useState } from 'react';
import type { Note } from '@/domain/note';
import { derivePageLabel, extractDomain } from '@/domain/notes-grouping';
import { formatVideoTimestamp } from '@/domain/video-markers';
import { isPlainLeftClick, openNoteAndRestore } from '@/entrypoints/notes/openNote';
import { AttachedText } from './AttachedText';
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
 *  timestamp badge (e.g. "▶ 13:27") next to it, or for a contextual text
 *  note, the page text it's attached to shown as a compact quote above the
 *  note itself.
 *
 *  The whole card opens the note: its `<a target="_blank">` to the note's
 *  original URL is stretched over the card (`::after`, see
 *  notes-library.css), so right-click, ctrl/cmd-click, and middle-click all
 *  work natively anywhere on it. A plain left-click is intercepted to drive
 *  `openNoteAndRestore` instead, which opens the tab itself and restores
 *  the note. For an element note that's scroll + highlight + open the
 *  viewer; for a video note it's a seek to the stored timestamp only — same
 *  as clicking its on-page marker, no viewer (see `HameshApp.tsx`'s
 *  restore-flow branch).
 *
 *  A note too long for its two clamped lines gets a "Show more" toggle
 *  under them — a real button, which is why the link is stretched over the
 *  card rather than being the card: a button can't nest inside an `<a>`.
 *  The toggle only appears when the text is actually cut off at the row's
 *  current width, and expanding reveals the note in place (line breaks
 *  kept, height capped with its own scroll) so the rows around it don't
 *  move far and the library stays easy to scan.
 *
 *  Pinned notes show a small decorative pin badge. Pin/edit/delete/move
 *  live in the sibling `NoteActionsMenu` (`WebsiteGroup`/`FolderTree`). */
export function NoteRow({ note, strings, lang, showDomain }: NoteRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const previewRef = useRef<HTMLParagraphElement>(null);
  const previewId = useId();

  // Whether the collapsed preview is actually cutting text off — measured,
  // not guessed from a character count, because the same note is two lines
  // in a wide window and six in a narrow one. Re-measured whenever the row
  // resizes (a `ResizeObserver` reports once on `observe`, and again on
  // every size change) and whenever the text itself changes. Not measured
  // while expanded: nothing is clamped then, and the toggle must stay to
  // collapse it again.
  useEffect(() => {
    const el = previewRef.current;
    if (!el || expanded || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setClamped(el.scrollHeight > el.clientHeight + 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, note.content]);

  return (
    <div className="hm-note-row">
      <a
        className="hm-note-row__link"
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
        {note.anchor.type === 'text' && <AttachedText label="" text={note.anchor.exact} compact />}
        <p
          ref={previewRef}
          id={previewId}
          className="hm-note-row__preview"
          data-expanded={expanded}
          dir="auto"
        >
          {note.content}
        </p>
      </a>
      {(clamped || expanded) && (
        <button
          type="button"
          className="hm-note-row__toggle"
          aria-expanded={expanded}
          aria-controls={previewId}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? strings.showLess : strings.showMore}
          <svg
            className="hm-note-row__toggle-chevron"
            data-expanded={expanded}
            width="8"
            height="8"
            viewBox="0 0 10 10"
            aria-hidden="true"
          >
            <path
              d="M2 3.5 L5 6.5 L8 3.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </button>
      )}
      <p className="hm-note-row__meta">
        {note.anchor.type === 'video' && (
          <span className="hm-note-row__video-badge">
            <PlayIcon size={9} />
            {formatVideoTimestamp(note.anchor.timestamp)}
          </span>
        )}
        {strings.editedAgo(relativeTime(note.updatedAt, lang))}
      </p>
    </div>
  );
}
