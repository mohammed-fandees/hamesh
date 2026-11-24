import type { LostNotesStrings } from '../i18n';

interface LostNotesPillProps {
  /** Notes that lost their place: said as a warning. */
  lost: number;
  /** Notes kept without a place: the page's own notes, said quietly when nothing is lost. */
  kept: number;
  open: boolean;
  strings: LostNotesStrings;
  onToggle: () => void;
}

/**
 * The page's one word about notes with no place on it: a pill in the corner, never over the
 * text being read. A warning while any note is lost; otherwise a quiet line that the page has
 * notes kept without a place. Opens the list of them. Not drawn when there are none.
 */
export function LostNotesPill({ lost, kept, open, strings, onToggle }: LostNotesPillProps) {
  if (lost + kept === 0) return null;
  return (
    <button
      type="button"
      className="hm-lost-pill"
      data-tone={lost > 0 ? 'warning' : 'quiet'}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onToggle}
    >
      <span className="hm-dot" aria-hidden="true" />
      {lost > 0 ? strings.pill(lost) : strings.keptPill(kept)}
    </button>
  );
}
