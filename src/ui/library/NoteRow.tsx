import { useEffect, useId, useRef, useState } from 'react';
import { isSharedNote, mayMutateNote, type Note } from '@/domain/note';
import { derivePageLabel, extractDomain } from '@/domain/notes-grouping';
import { formatVideoTimestamp } from '@/domain/video-markers';
import { isPlainLeftClick, openNoteAndRestore } from '@/entrypoints/notes/openNote';
import { AttachedText } from '../AttachedText';
import { Favicon } from '../Favicon';
import { relativeTime } from '../format';
import { InlineError } from '../kit/Feedback';
import { ChevronIcon, PinIcon, PlayIcon } from '../kit/icons';
import type { Lang, Strings } from '../i18n';
import { useNoteActions } from './NoteActions';
import { NoteActionsMenu } from './NoteActionsMenu';
import { useDiscussAction, useShareAction } from './NoteShareSlot';

interface NoteRowProps {
  note: Note;
  strings: Strings;
  lang: Lang;
  /** Names the site above the title — for a list that mixes sites (a folder,
   *  Pinned). A site group already names it once in its header. */
  showDomain?: boolean;
  /** Offer "Move to folder" in the note's menu — the folder view does. */
  movable?: boolean;
}

/**
 * One note in the Library — the only way a note is shown in a list, whether in
 * a site's group, a folder, or Pinned, so a long note can be opened out, and a
 * failure is said, in all three alike.
 *
 * The page it is on, the text it is attached to (for a note on selected text),
 * its words — clamped, and opened out in place by "Show more" when they are
 * really cut off — and, beside the title, when it was edited and its menu.
 *
 * The whole row opens the note: its `<a target="_blank">` is stretched over
 * the row, so ctrl/cmd-click, middle-click and "open in new tab" all work
 * natively anywhere on it, while a plain left-click opens the tab itself and
 * restores the note there (`openNoteAndRestore`). The menu, "Show more" and
 * "Discuss" sit above that link as controls of their own — a button cannot
 * nest inside an `<a>`, which is why the link is stretched rather than being
 * the row.
 */
export function NoteRow({ note, strings, lang, showDomain, movable }: NoteRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const previewRef = useRef<HTMLParagraphElement>(null);
  const previewId = useId();
  const actions = useNoteActions();
  const share = useShareAction();
  const discuss = useDiscussAction();
  const domain = extractDomain(note.originalUrl);

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

  const hasMenu = actions && (mayMutateNote(note) || share);
  const showToggle = clamped || expanded;
  const showDiscuss = isSharedNote(note) && discuss;

  return (
    <article className="hm-note-row" data-busy={actions?.busy(note.id) || undefined}>
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
            <Favicon domain={domain} size={14} />
            {domain}
          </span>
        )}
        <span className="hm-note-row__title">
          {note.pinned && <PinIcon filled size={10} className="hm-note-row__pin" />}
          <span className="hm-note-row__label">{derivePageLabel(note)}</span>
          {/* A note that lives in a team says so here, where the reader's eye
              already is. Absent on every note this device stored, which is
              every note at all in a build without Teams. */}
          {note.team && (
            <span className="hm-team-chip">
              <span className="hm-team-chip__dot" aria-hidden="true" />
              <bdi>{note.team.name}</bdi>
            </span>
          )}
        </span>
        {note.anchor.type === 'text' && <AttachedText label="" text={note.anchor.exact} compact />}
        <p
          ref={previewRef}
          id={previewId}
          className="hm-note-row__preview hm-prose"
          data-expanded={expanded}
          dir="auto"
        >
          {note.content}
        </p>
      </a>

      <div className="hm-note-row__aside">
        {note.anchor.type === 'video' && (
          <span className="hm-note-row__video-badge">
            <PlayIcon size={9} />
            {formatVideoTimestamp(note.anchor.timestamp)}
          </span>
        )}
        <span className="hm-note-row__time">
          {strings.editedAgo(relativeTime(note.updatedAt, lang))}
        </span>
        {hasMenu && (
          <NoteActionsMenu note={note} strings={strings} actions={actions} movable={movable} />
        )}
      </div>

      {(showToggle || showDiscuss) && (
        <div className="hm-note-row__tail">
          {showToggle && (
            <button
              type="button"
              className="hm-note-row__toggle"
              aria-expanded={expanded}
              aria-controls={previewId}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? strings.showLess : strings.showMore}
              <ChevronIcon size={9} className="hm-note-row__toggle-chevron" />
            </button>
          )}
          {/* A team note has a discussion, and this is the one way to it from
              the list. */}
          {showDiscuss && (
            <button
              type="button"
              className="hm-note-row__discuss"
              onClick={() => discuss.open(note)}
            >
              {discuss.label}
            </button>
          )}
        </div>
      )}

      {actions?.failed(note.id) && (
        <div className="hm-note-row__alert">
          <InlineError>{strings.saveError}</InlineError>
        </div>
      )}
    </article>
  );
}
