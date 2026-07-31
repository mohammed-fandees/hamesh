import type { VideoAnchor } from './note';

/** Minimal shape `buildVideoAnchor` needs from a `VideoPlayerAdapter` — kept
 *  structural rather than importing the real adapter type here, since that
 *  type lives in `src/content/video-adapters/` (a content-script concern)
 *  and this module must stay DOM-light and independently unit-testable, the
 *  same separation `anchor.ts`/`anchor-resolution.ts` already keep. */
export interface VideoIdentitySource {
  id: string;
  getVideoId(video: HTMLVideoElement): string | null;
}

/**
 * Captures a `VideoAnchor` for the given video element at its current
 * playback position — the video-note equivalent of `buildElementAnchor`.
 * Returns `null` when the adapter can't produce a stable id for this video
 * (mirrors `resolveAnchor`'s "never throws, just fails to resolve" contract
 * by refusing to build an anchor that could never resolve back).
 */
export function buildVideoAnchor(
  video: HTMLVideoElement,
  adapter: VideoIdentitySource,
): VideoAnchor | null {
  const videoId = adapter.getVideoId(video);
  if (!videoId) return null;

  return {
    type: 'video',
    platform: adapter.id,
    videoId,
    timestamp: video.currentTime,
    duration: Number.isFinite(video.duration) ? video.duration : undefined,
  };
}
