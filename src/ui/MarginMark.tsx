/**
 * The Hamesh "margin mark" — a vertical rule with a short tick reaching off it.
 * One glyph used at every scale: icon, marker, composer label, cursor hint.
 *
 * `flip` mirrors the tick horizontally for RTL contexts, so it always points
 * into the text (the direction of reading), never away from it.
 */
interface MarginMarkProps {
  size?: number;
  strokeWidth?: number;
  flip?: boolean;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}

export function MarginMark({
  size = 16,
  strokeWidth = 3,
  flip = false,
  className = 'hm-mark',
  title,
  style,
}: MarginMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      style={{ ...(flip ? { transform: 'scaleX(-1)' } : null), ...style }}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M10 5 L10 27"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M10 14 L20 14"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M20 10.5 L20 17.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}
