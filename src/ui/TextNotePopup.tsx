import type { Strings } from './i18n';

interface TextNotePopupProps {
  /** The note's first line — a glance, not a read. */
  preview: string;
  strings: Strings;
  style?: React.CSSProperties;
  onOpen: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

/**
 * The pill shown while the pointer is over highlighted text: an accent dot
 * and the note's first line. Nothing else.
 *
 * Literally the video marker's own hover preview — it carries
 * `.hm-video-preview`, not a lookalike — because it does the same job. The
 * one thing it drops is the timestamp: a video note is a moment, a
 * contextual note is a piece of text that is already right there under the
 * pill, so there is nothing to stamp it with.
 *
 * The one thing it adds is interactivity. The video preview is
 * `pointer-events: none` so it can't steal hover from the player beneath it;
 * this one has to take pointer events, because the pointer must be able to
 * travel from the words into it without it vanishing (see `HameshApp`'s
 * hover-intent grace period), and because clicking it opens the note. That
 * opens the ordinary `NoteViewer` — the only place reading, editing,
 * deleting and pinning happen, for this note as for every other.
 */
export function TextNotePopup({
  preview,
  strings,
  style,
  onOpen,
  onPointerEnter,
  onPointerLeave,
}: TextNotePopupProps) {
  return (
    <button
      type="button"
      className="hm-video-preview hm-text-popup"
      style={style}
      aria-label={strings.viewNote}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen();
      }}
    >
      <span className="hm-video-preview__dot" aria-hidden="true" />
      <span className="hm-video-preview__text" dir="auto">
        {preview}
      </span>
    </button>
  );
}
