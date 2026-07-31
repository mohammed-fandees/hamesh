interface VideoMarkerPreviewProps {
  preview: string;
  timestamp: string;
  /** Reserved for a future workspace feature — no caller passes this yet
   *  (Hamesh has exactly one, implicit workspace today, with no color of
   *  its own). Defaults to the brand accent so the component doesn't need
   *  restructuring once workspace colors exist. */
  color?: string;
  style?: React.CSSProperties;
}

/**
 * The floating preview shown while hovering a video marker: the note's
 * first line (not its full body — a glance, not a read) plus its
 * timestamp. Read-only and `pointer-events: none` (see `.hm-video-preview`
 * in tokens.css) — hovering it must never itself steal hover away from the
 * player underneath, the same reasoning `VideoMarker` already documents.
 */
export function VideoMarkerPreview({ preview, timestamp, color, style }: VideoMarkerPreviewProps) {
  return (
    <div className="hm-video-preview" style={style} role="status">
      <span
        className="hm-video-preview__dot"
        aria-hidden="true"
        style={color ? { background: color } : undefined}
      />
      <span className="hm-video-preview__text" dir="auto">
        {preview}
      </span>
      <span className="hm-video-preview__time">{timestamp}</span>
    </div>
  );
}
