interface VideoMarkerProps {
  label: string;
  style?: React.CSSProperties;
  onOpen: () => void;
}

/**
 * A tiny tick on a video's timeline — deliberately not the branded
 * margin-mark glyph `Marker` uses for page elements. A video timeline is
 * dense, often someone else's UI (YouTube's own progress bar), so this
 * needs to blend in rather than announce itself: a small dot, not a chip.
 * Positioning (`top`/`left` along the rail) is supplied by the caller.
 */
export function VideoMarker({ label, style, onOpen }: VideoMarkerProps) {
  return (
    <button
      type="button"
      className="hm-video-marker"
      style={style}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    />
  );
}
