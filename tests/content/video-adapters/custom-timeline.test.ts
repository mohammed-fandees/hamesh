// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { customTimelineAdapter } from '@/content/video-adapters/custom-timeline';

/** A minimal opted-in custom player: a `data-hamesh-player` container holding
 *  a `<video>` and a `[data-hamesh-timeline]` scrubber marker — the convention
 *  the adapter matches on, with no host allowlist involved. */
function mountPlayer(opts: { controls?: 'hidden'; videoId?: string; src?: string } = {}): void {
  const controls = opts.controls ? ` data-hamesh-controls="${opts.controls}"` : '';
  const vid = opts.videoId ? ` data-hamesh-video-id="${opts.videoId}"` : '';
  const src = opts.src ? ` src="${opts.src}"` : '';
  document.body.innerHTML = `
    <figure>
      <div data-hamesh-player class="yt-player"${controls}>
        <video class="html5-main-video"${vid}${src}></video>
        <div class="ytp-chrome-bottom">
          <div class="ytp-progress-bar-container" data-hamesh-timeline></div>
        </div>
      </div>
    </figure>
  `;
}

// A real, detached <video> (unlike youtube's `{}` stub): this adapter reads
// the video arg via `.closest()`, so it needs a genuine element.
const detachedVideo = document.createElement('video');

describe('customTimelineAdapter', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('matches', () => {
    it('is true for an opted-in player with both a video and a timeline', () => {
      mountPlayer();
      expect(customTimelineAdapter.matches()).toBe(true);
    });

    it('is false when nothing on the page opts in', () => {
      document.body.innerHTML = '<video src="a.mp4"></video>';
      expect(customTimelineAdapter.matches()).toBe(false);
    });

    it('is false for a data-hamesh-player missing its timeline element', () => {
      document.body.innerHTML = '<div data-hamesh-player><video></video></div>';
      expect(customTimelineAdapter.matches()).toBe(false);
    });

    it('is false for a data-hamesh-player missing its video', () => {
      document.body.innerHTML = '<div data-hamesh-player><div data-hamesh-timeline></div></div>';
      expect(customTimelineAdapter.matches()).toBe(false);
    });
  });

  describe('getActiveVideo / getPlayerContainer', () => {
    it('finds the video inside the opted-in player', () => {
      mountPlayer();
      const video = customTimelineAdapter.getActiveVideo();
      expect(video).not.toBeNull();
      expect(video?.classList.contains('html5-main-video')).toBe(true);
    });

    it('returns the data-hamesh-player container for its video', () => {
      mountPlayer();
      const video = customTimelineAdapter.getActiveVideo()!;
      const container = customTimelineAdapter.getPlayerContainer(video);
      expect((container as HTMLElement).hasAttribute('data-hamesh-player')).toBe(true);
    });

    it('returns null for getActiveVideo when no opted-in player exists', () => {
      document.body.innerHTML = '<video></video>';
      expect(customTimelineAdapter.getActiveVideo()).toBeNull();
    });
  });

  describe('getVideoId', () => {
    it('prefers an explicit data-hamesh-video-id', () => {
      mountPlayer({ videoId: 'lesson-1', src: 'a.mp4' });
      const video = customTimelineAdapter.getActiveVideo()!;
      expect(customTimelineAdapter.getVideoId(video)).toBe('lesson-1');
    });

    it('falls back to the resolved source', () => {
      mountPlayer({ src: 'https://x/intro.mp4' });
      const video = customTimelineAdapter.getActiveVideo()!;
      expect(customTimelineAdapter.getVideoId(video)).toBe('https://x/intro.mp4');
    });

    it('falls back to an ordinal id when there is no source', () => {
      mountPlayer();
      const video = customTimelineAdapter.getActiveVideo()!;
      expect(customTimelineAdapter.getVideoId(video)).toBe('video-0');
    });
  });

  describe('capabilities / getTimelineRect', () => {
    it('declares a native timeline', () => {
      expect(customTimelineAdapter.capabilities.nativeTimeline).toBe(true);
    });

    it('returns the timeline element rect when mounted', () => {
      mountPlayer();
      const video = customTimelineAdapter.getActiveVideo()!;
      expect(customTimelineAdapter.getTimelineRect(video)).not.toBeNull();
    });

    it('returns null when there is no opted-in player to key off', () => {
      expect(customTimelineAdapter.getTimelineRect(detachedVideo)).toBeNull();
    });
  });

  describe('areControlsVisible', () => {
    it('is true by default (no data-hamesh-controls set)', () => {
      mountPlayer();
      const video = customTimelineAdapter.getActiveVideo()!;
      expect(customTimelineAdapter.areControlsVisible(video)).toBe(true);
    });

    it('is false while the page marks its chrome hidden', () => {
      mountPlayer({ controls: 'hidden' });
      const video = customTimelineAdapter.getActiveVideo()!;
      expect(customTimelineAdapter.areControlsVisible(video)).toBe(false);
    });

    it('fails open (true) when the player cannot be found for the video', () => {
      expect(customTimelineAdapter.areControlsVisible(detachedVideo)).toBe(true);
    });
  });
});
