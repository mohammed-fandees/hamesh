/** The rail a video note's marker is positioned along — either a site's own
 *  timeline (`VideoPlayerAdapter.getTimelineRect`) or Hamesh's own fallback
 *  rail docked to the video element when no native timeline is available.
 *  Plain fields (not `DOMRect`) so this stays testable with a literal. */
export interface RailRect {
  left: number;
  width: number;
}

/** Pixel x-offset along `railRect` for a note at `timestamp` seconds into a
 *  video of `duration` seconds. Clamped to the rail's bounds — a timestamp
 *  beyond a (possibly since-changed) duration still places a marker at the
 *  rail's end rather than off-screen. `duration <= 0` (unknown/loading)
 *  degrades to the rail's start rather than dividing by zero. */
export function computeMarkerX(timestamp: number, duration: number, railRect: RailRect): number {
  if (!Number.isFinite(duration) || duration <= 0) return railRect.left;
  const ratio = Math.min(1, Math.max(0, timestamp / duration));
  return railRect.left + ratio * railRect.width;
}

export interface MarkerPosition<T> {
  item: T;
  x: number;
}

export interface MarkerCluster<T> {
  items: T[];
  /** Representative x — the mean of its members' positions. */
  x: number;
}

/** Groups markers whose x-offsets fall within `thresholdPx` of their
 *  neighbor into a single cluster (chained: A-B-C cluster together if
 *  A-B and B-C are each within threshold, even if A-C isn't — the same
 *  "adjacent gap" rule map-pin clustering uses, and cheap to compute for the
 *  note counts a single video timeline realistically has). A cluster of one
 *  is just an unclustered marker — callers render clusters of size 1 as a
 *  plain `VideoMarker`. */
export function clusterMarkers<T>(
  positions: MarkerPosition<T>[],
  thresholdPx: number,
): MarkerCluster<T>[] {
  if (positions.length === 0) return [];
  const sorted = [...positions].sort((a, b) => a.x - b.x);

  const clusters: MarkerCluster<T>[] = [];
  let group: MarkerPosition<T>[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = group[group.length - 1];
    const current = sorted[i];
    if (current.x - prev.x <= thresholdPx) {
      group.push(current);
    } else {
      clusters.push(toCluster(group));
      group = [current];
    }
  }
  clusters.push(toCluster(group));
  return clusters;
}

function toCluster<T>(group: MarkerPosition<T>[]): MarkerCluster<T> {
  const x = group.reduce((sum, g) => sum + g.x, 0) / group.length;
  return { items: group.map((g) => g.item), x };
}

/** The hover preview shows only the note's first line, not its full body —
 *  it's a glance, not a read. Trims surrounding whitespace; an empty/
 *  whitespace-only first line (rare, but content could start with a blank
 *  line) degrades to an empty string rather than throwing, leaving the
 *  caller to decide how to render that. */
export function firstLineOf(content: string): string {
  return (content.split('\n')[0] ?? '').trim();
}

/** `m:ss` under an hour, `h:mm:ss` from an hour onward. Negative/NaN input
 *  clamps to `0:00` rather than rendering a broken label. */
export function formatVideoTimestamp(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}
