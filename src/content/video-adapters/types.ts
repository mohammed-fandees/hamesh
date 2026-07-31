/**
 * A player adapter knows how to find, identify, and (where the site exposes
 * its own timeline DOM) place markers on one kind of video player. Adding a
 * new site (Vimeo, Coursera, …) is just another adapter in the registry
 * (`registry.ts`) — nothing in domain resolution, storage, or `HameshApp`
 * needs to change. Capability-driven, not site-driven: callers branch on
 * `capabilities.nativeTimeline`, not on `id`.
 */
export interface VideoPlayerAdapter {
  /** Stable id, stored on `VideoAnchor.platform` — identifies which adapter
   *  produced/should resolve a given note's anchor. */
  id: string;

  /** Does this adapter own the current page? Registry order is a priority
   *  chain (first match wins), mirroring `resolveAnchor`'s own priority
   *  chain for element anchors. */
  matches(): boolean;

  /** The video this adapter currently considers "the" video on the page —
   *  used for capture (Alt+H), restore/seek, and marker resolution. Pages
   *  with several videos get a best-effort pick (see each adapter for its
   *  heuristic); this is not a general multi-video timeline system. */
  getActiveVideo(): HTMLVideoElement | null;

  /** The DOM region a hover/focus counts as "interacting with this video"
   *  for — the whole player chrome (video + controls + timeline) where a
   *  site has one, not just the bare `<video>` element's box. Falls back to
   *  the video element itself when no wider chrome is known. */
  getPlayerContainer(video: HTMLVideoElement): Element | null;

  /** A stable identifier for the specific video, used as `VideoAnchor.videoId`
   *  and compared against on resolution. `null` when this adapter can't
   *  produce anything stable for the given video (resolution/capture then
   *  treat it as unavailable, same as an unresolved element anchor). */
  getVideoId(video: HTMLVideoElement): string | null;

  capabilities: {
    /** True when the site exposes its own timeline/progress-bar DOM this
     *  adapter can inject markers into directly (e.g. YouTube). False means
     *  callers fall back to Hamesh's own overlay rail docked to the video
     *  element — native `<video controls>` scrubbers are browser-internal
     *  and can never be true here. */
    nativeTimeline: boolean;
  };

  /** The site's own progress-bar rect to align markers with, or `null` when
   *  `capabilities.nativeTimeline` is false (no such DOM exists). */
  getTimelineRect(video: HTMLVideoElement): DOMRect | null;
}
