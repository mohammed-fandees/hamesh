interface AttachedTextProps {
  label: string;
  text: string;
  /** Rendered without the label above it (a compact list row, where the
   *  quote mark alone already says what it is). */
  compact?: boolean;
}

/**
 * The page text a contextual note is attached to, shown as a quoted block
 * with the accent rule down its inline-start edge — the same "margin note
 * beside the text" idea the marker glyph draws, in prose form.
 *
 * Used by the note viewer (in-page) and by the Notes Library's note rows, so
 * a contextual note reads the same wherever it turns up.
 */
export function AttachedText({ label, text, compact = false }: AttachedTextProps) {
  return (
    <div className={compact ? 'hm-attached hm-attached--compact' : 'hm-attached'}>
      {!compact && <span className="hm-attached__label">{label}</span>}
      <p className="hm-attached__quote" dir="auto" title={compact ? text : undefined}>
        {text}
      </p>
    </div>
  );
}
