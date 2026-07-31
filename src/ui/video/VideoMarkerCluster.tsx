interface VideoMarkerClusterProps {
  count: number;
  label: string;
  style?: React.CSSProperties;
  onOpen: () => void;
}

/**
 * Several notes close enough together on the timeline that individual
 * `VideoMarker` dots would overlap — rendered as one slightly larger dot
 * with a count instead. Clicking opens the small list of clustered notes
 * (`VideoMarkerClusterList`). Same `pointer-events: none` reasoning as
 * `VideoMarker`: real mouse clicks are handled by HameshApp's
 * coordinate-based listener, not by this element being hit-tested
 * directly — a hit-testable overlay here would steal hover from the
 * player the same way a plain marker would. Keyboard activation (Tab +
 * Enter/Space) still works, since it doesn't go through pointer
 * hit-testing.
 */
export function VideoMarkerCluster({ count, label, style, onOpen }: VideoMarkerClusterProps) {
  return (
    <button
      type="button"
      className="hm-video-marker hm-video-marker--cluster"
      style={style}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <span aria-hidden="true">{count}</span>
    </button>
  );
}
