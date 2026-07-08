import { MarginMark } from './MarginMark';

interface SelectionHintProps {
  text: string;
  style?: React.CSSProperties;
}

/**
 * The small pill that follows the cursor in selection mode: the mark plus one
 * line of instruction. Uses Hamesh's own ink/paper surface so it stays legible
 * over any host background.
 */
export function SelectionHint({ text, style }: SelectionHintProps) {
  return (
    <div className="hm-hint" style={style} role="status">
      <MarginMark size={13} strokeWidth={3.5} />
      {text}
    </div>
  );
}
