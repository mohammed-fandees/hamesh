import type { VideoPlayerAdapter } from './types';

/** Opt-in convention: a custom HTML5 player marks its own chrome so Hamesh can
 *  treat it like a native-timeline player instead of falling back to the rail
 *  docked below the bare `<video>`. A player container carries
 *  `data-hamesh-player` and holds both a `<video>` and a `[data-hamesh-timeline]`
 *  element marking its scrubber; it sets `data-hamesh-controls="hidden"` while
 *  its chrome is faded out.
 *
 *  Matching is purely opt-in via these attributes — never a host allowlist and
 *  never bare markup — so no real site gets this behavior unless it explicitly
 *  asks for it. This is what lets a non-YouTube player (any site's, or the local
 *  testbed's) still get on-timeline marker placement. */
const PLAYER_SELECTOR = '[data-hamesh-player]';
const TIMELINE_SELECTOR = '[data-hamesh-timeline]';

/** The first opted-in player that is actually complete — has both a video and
 *  a timeline element. An incomplete `data-hamesh-player` (missing either) is
 *  ignored so this adapter doesn't claim a page it can't place markers on. */
function getOptedInPlayer(): Element | null {
  const players = Array.from(document.querySelectorAll(PLAYER_SELECTOR));
  return (
    players.find((p) => p.querySelector('video') && p.querySelector(TIMELINE_SELECTOR)) ?? null
  );
}

/** The opted-in player owning a given video, falling back to the first
 *  complete opted-in player on the page (single-player pages, the common
 *  case, resolve to the same element either way). */
function playerFor(video: HTMLVideoElement): Element | null {
  return video.closest(PLAYER_SELECTOR) ?? getOptedInPlayer();
}

/** Prefers a currently-playing video among opted-in players; falls back to the
 *  first in document order. Mirrors `html5-generic`'s heuristic, scoped to
 *  opted-in players. */
function pickActiveVideo(): HTMLVideoElement | null {
  const videos = Array.from(
    document.querySelectorAll<HTMLVideoElement>(`${PLAYER_SELECTOR} video`),
  );
  if (videos.length === 0) return null;
  const playing = videos.find((v) => !v.paused && !v.ended && v.readyState > 2);
  return playing ?? videos[0];
}

/** Stable id for a video in a custom player: an explicit
 *  `data-hamesh-video-id` wins (a page that manages its own sources can pin
 *  identity across reloads); otherwise the resolved source, then the ordinal
 *  position among all `<video>` elements — same fallback ladder as
 *  `html5-generic`. */
function deriveVideoId(video: HTMLVideoElement): string {
  const explicit = video.getAttribute('data-hamesh-video-id');
  if (explicit) return explicit;
  const src = video.currentSrc || video.getAttribute('src');
  if (src) return src;
  const index = Array.from(document.querySelectorAll('video')).indexOf(video);
  return `video-${index === -1 ? 0 : index}`;
}

export const customTimelineAdapter: VideoPlayerAdapter = {
  id: 'custom-timeline',

  matches(): boolean {
    return getOptedInPlayer() !== null;
  },

  getActiveVideo(): HTMLVideoElement | null {
    return pickActiveVideo();
  },

  getPlayerContainer(video: HTMLVideoElement): Element | null {
    return playerFor(video);
  },

  getVideoId(video: HTMLVideoElement): string | null {
    return deriveVideoId(video);
  },

  capabilities: { nativeTimeline: true },

  getTimelineRect(video: HTMLVideoElement): DOMRect | null {
    const timeline = playerFor(video)?.querySelector(TIMELINE_SELECTOR);
    return timeline?.getBoundingClientRect() ?? null;
  },

  areControlsVisible(video: HTMLVideoElement): boolean {
    // The page tells us directly via `data-hamesh-controls`: it sets it to
    // "hidden" while its own chrome is faded out, mirroring how the YouTube
    // adapter reads `.ytp-autohide`. Fails open (visible) when the player
    // can't be found.
    const player = playerFor(video);
    if (!player) return true;
    return player.getAttribute('data-hamesh-controls') !== 'hidden';
  },
};
