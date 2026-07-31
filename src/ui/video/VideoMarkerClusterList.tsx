import { useEffect, useRef } from 'react';
import type { Note, VideoAnchor } from '@/domain/note';
import { formatVideoTimestamp, firstLineOf } from '@/domain/video-markers';
import type { Strings } from '../i18n';

export interface VideoMarkerClusterItem {
  note: Note;
  anchor: VideoAnchor;
}

interface VideoMarkerClusterListProps {
  items: VideoMarkerClusterItem[];
  strings: Strings;
  onSelect: (item: VideoMarkerClusterItem) => void;
  onClose: () => void;
}

/**
 * The small list a cluster expands into on click — one row per clustered
 * note, timestamp-ordered. Selecting a row seeks to that note's timestamp
 * (same as clicking a lone `VideoMarker`) and closes the list. Unlike the
 * markers/preview above, this is a real, deliberate, click-opened surface
 * (same category as the composer/viewer cards), so it's normal
 * `pointer-events: auto` `.hm-card` — it doesn't have the passive-overlay
 * hover-stealing problem those solve for, since it only exists while the
 * user asked for it.
 */
export function VideoMarkerClusterList({
  items,
  strings,
  onSelect,
  onClose,
}: VideoMarkerClusterListProps) {
  const sorted = [...items].sort((a, b) => a.anchor.timestamp - b.anchor.timestamp);
  // Unlike Composer/VideoQuickNote (an autoFocus textarea), this card has
  // no input to focus by default — without focusing *something* inside it
  // on open, a real Escape keypress would land on whatever had focus
  // before the list opened (never this card), so the onKeyDown handler
  // below would simply never see it. Focusing the first row doubles as a
  // reasonable keyboard-navigation starting point (Tab through the rest).
  const firstItemRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstItemRef.current?.focus();
  }, []);
  return (
    <div
      className="hm-card hm-video-cluster-list"
      role="dialog"
      aria-label={strings.videoClusterLabel(items.length)}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        onClose();
      }}
    >
      <ul className="hm-video-cluster-list__items">
        {sorted.map((item, i) => (
          <li key={item.note.id}>
            <button
              ref={i === 0 ? firstItemRef : undefined}
              type="button"
              className="hm-video-cluster-list__item"
              onClick={() => onSelect(item)}
            >
              <span className="hm-video-cluster-list__time">
                {formatVideoTimestamp(item.anchor.timestamp)}
              </span>
              <span className="hm-video-cluster-list__preview" dir="auto">
                {firstLineOf(item.note.content)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
