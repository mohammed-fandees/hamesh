import { PreviewPillContent } from '../PreviewPill';

interface VideoMarkerPreviewProps {
  preview: string;
  timestamp: string;
  style?: React.CSSProperties;
}

/**
 * The floating preview shown while hovering a video marker: the note's first
 * line (a glance, not a read) and its moment. Read-only and
 * `pointer-events: none` (`.hm-video-preview` in tokens.css) — hovering it must
 * never itself steal hover from the player underneath, the same reasoning
 * `VideoMarker` documents.
 */
export function VideoMarkerPreview({ preview, timestamp, style }: VideoMarkerPreviewProps) {
  return (
    <div className="hm-video-preview" style={style} role="status">
      <PreviewPillContent preview={preview} time={timestamp} />
    </div>
  );
}
