import type { VideoPlayerAdapter } from './types';
import { pickActiveVideo, sourceOrOrdinalId } from './shared';

function getAllVideos(): HTMLVideoElement[] {
  return Array.from(document.querySelectorAll('video'));
}

export const html5GenericAdapter: VideoPlayerAdapter = {
  id: 'html5',

  matches(): boolean {
    return getAllVideos().length > 0;
  },

  getActiveVideo(): HTMLVideoElement | null {
    return pickActiveVideo(getAllVideos());
  },

  getPlayerContainer(video: HTMLVideoElement): Element | null {
    // No known wider "player chrome" for a plain HTML5 video — the element
    // itself is the whole interactive region.
    return video;
  },

  getVideoId(video: HTMLVideoElement): string | null {
    return sourceOrOrdinalId(video);
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
