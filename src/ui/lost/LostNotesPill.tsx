import type { LostNotesStrings } from '../i18n';

interface LostNotesPillProps {
  count: number;
  open: boolean;
  strings: LostNotesStrings;
  onToggle: () => void;
}

/**
 * The page's one word about notes that lost their place: a quiet pill in the corner, never over
 * the text being read. Opens the list of them. Not drawn when there are none.
 */
export function LostNotesPill({ count, open, strings, onToggle }: LostNotesPillProps) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      className="hm-lost-pill"
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onToggle}
    >
      <span className="hm-dot" aria-hidden="true" />
      {strings.pill(count)}
    </button>
  );
}
