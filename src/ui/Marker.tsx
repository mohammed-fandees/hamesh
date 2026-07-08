import { MarginMark } from './MarginMark';

interface MarkerProps {
  label: string;
  flip?: boolean;
  badge?: number;
  style?: React.CSSProperties;
  onOpen: () => void;
}

/**
 * A saved marker — the same margin-mark glyph as the logo, at 14px, docked
 * beside its anchor like a proofreader's margin tick. The most-seen brand
 * touchpoint. Positioning is supplied by the caller via `style`.
 */
export function Marker({ label, flip = false, badge, style, onOpen }: MarkerProps) {
  return (
    <button
      type="button"
      className="hm-marker"
      style={style}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <MarginMark size={14} strokeWidth={3.6} flip={flip} />
      {badge && badge > 1 ? (
        <span className="hm-marker__badge" aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
