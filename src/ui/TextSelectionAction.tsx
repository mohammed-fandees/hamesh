import { MarginMark } from './MarginMark';

interface TextSelectionActionProps {
  label: string;
  flip?: boolean;
  style?: React.CSSProperties;
  onActivate: () => void;
}

/**
 * The chip that appears beside a finished text selection — the *only* thing
 * a selection does on its own. It opens nothing by itself; it is an explicit
 * trigger the user has to click, so selecting text to read or copy it stays
 * completely ordinary.
 *
 * `onMouseDown`'s `preventDefault` is load-bearing: without it the browser
 * collapses the page selection the instant this button takes the press, and
 * the note would be attached to nothing. (The capture is preserved
 * independently too — see `captureTextSelection` — so this is belt and
 * braces, not the only defense.)
 *
 * Same margin-mark glyph in the same opaque chip as `Marker`, one size down:
 * branded and recognizable, small enough not to sit on top of the sentence
 * the user is still reading.
 */
export function TextSelectionAction({
  label,
  flip = false,
  style,
  onActivate,
}: TextSelectionActionProps) {
  return (
    <button
      type="button"
      className="hm-marker hm-text-action"
      style={style}
      aria-label={label}
      title={undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onActivate();
      }}
    >
      <MarginMark size={13} strokeWidth={3.6} flip={flip} />
    </button>
  );
}
