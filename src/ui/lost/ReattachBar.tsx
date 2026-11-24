import { MarginMark } from '../kit/MarginMark';

interface ReattachBarProps {
  text: string;
  cancelLabel: string;
  onCancel: () => void;
}

/**
 * While a note is being put back: what to do now, and the way out. Pinned to the top of the
 * view, above the selection overlay, so it stays readable and its Cancel stays pressable
 * wherever the reader points.
 */
export function ReattachBar({ text, cancelLabel, onCancel }: ReattachBarProps) {
  return (
    <div className="hm-reattach-bar" role="status">
      <MarginMark size={13} strokeWidth={3.5} />
      <span>{text}</span>
      <button type="button" className="hm-reattach-bar__cancel" onClick={onCancel}>
        {cancelLabel}
      </button>
    </div>
  );
}
