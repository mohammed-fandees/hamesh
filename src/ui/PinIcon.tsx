interface PinIconProps {
  filled: boolean;
  size?: number;
}

/** A small pin/thumbtack glyph — filled when pinned. Shared by the
 *  content-script NoteViewer's pin toggle and the Notes Library's
 *  read-only pin badge on NoteRow. */
export function PinIcon({ filled, size = 13 }: PinIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <circle
        cx="7"
        cy="4.5"
        r="3"
        stroke="currentColor"
        strokeWidth="1.3"
        fill={filled ? 'currentColor' : 'none'}
      />
      <path d="M7 7.5 L7 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
