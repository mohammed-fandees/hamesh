interface PlayIconProps {
  size?: number;
}

/** A small filled play-triangle — marks a video note's timestamp badge in
 *  the Notes Library, the same way `PinIcon` marks a pinned note. */
export function PlayIcon({ size = 10 }: PlayIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M4 2.5 L11 7 L4 11.5 Z" fill="currentColor" />
    </svg>
  );
}
