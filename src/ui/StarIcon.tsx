interface StarIconProps {
  filled: boolean;
  size?: number;
}

/** A small five-point star — filled when the folder it sits beside is a
 *  default folder. Drawn on the same 14-unit grid as `PinIcon`. */
export function StarIcon({ filled, size = 13 }: StarIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M7 1.6 L8.6 5.05 L12.35 5.45 L9.55 8 L10.33 11.7 L7 9.8 L3.67 11.7 L4.45 8 L1.65 5.45 L5.4 5.05 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  );
}
