import type { VideoPlayerAdapter } from './types';

function getAllVideos(): HTMLVideoElement[] {
  return Array.from(document.querySelectorAll('video'));
}

/** Prefers a currently-playing video; falls back to the first one in
 *  document order. Deliberately simple — this is the last-resort adapter
 *  for arbitrary HTML5 pages, and the only signal Hamesh's dedicated video
 *  shortcut needs: it always targets whichever video an adapter considers
 *  "active," not whichever the pointer happens to be over. */
function pickActiveVideo(): HTMLVideoElement | null {
  const videos = getAllVideos();
  if (videos.length === 0) return null;
  const playing = videos.find((v) => !v.paused && !v.ended && v.readyState > 2);
  return playing ?? videos[0];
}

/** Stable-enough id for a plain HTML5 video with no platform-level identity:
 *  prefer its resolved source (the same video keeps the same source across
 *  reloads); fall back to its ordinal position among the page's `<video>`
 *  elements when no source is set yet — stable within a session, matching
 *  `ElementAnchor`'s own "best available signal, not a perfect one"
 *  philosophy for anchors with nothing better to key off. */
function deriveVideoId(video: HTMLVideoElement): string {
  const src = video.currentSrc || video.getAttribute('src');
  if (src) return src;
  const index = getAllVideos().indexOf(video);
  return `video-${index === -1 ? 0 : index}`;
}

export const html5GenericAdapter: VideoPlayerAdapter = {
  id: 'html5',

  matches(): boolean {
    return getAllVideos().length > 0;
  },

  getActiveVideo(): HTMLVideoElement | null {
    return pickActiveVideo();
  },

  getPlayerContainer(video: HTMLVideoElement): Element | null {
    // No known wider "player chrome" for a plain HTML5 video — the element
    // itself is the whole interactive region.
    return video;
  },

  getVideoId(video: HTMLVideoElement): string | null {
    return deriveVideoId(video);
  },

  capabilities: { nativeTimeline: false },

  getTimelineRect(): DOMRect | null {
    // No native timeline DOM to align with — callers render Hamesh's own
    // overlay rail docked to the video element's own rect instead.
    return null;
  },

  areControlsVisible(video: HTMLVideoElement): boolean {
    // Native <video controls> visibility isn't observable at all — browsers
    // render them in an internal UA shadow tree with no exposed state. This
    // approximates the same two triggers that actually show native controls
    // in every major browser: the pointer being over the video, or playback
    // being paused (controls stay up while paused). It hides immediately on
    // pointer-leave during playback rather than after a fade-timeout, since
    // there's no way to observe or replicate that timing.
    return video.paused || video.matches(':hover');
  },
};
