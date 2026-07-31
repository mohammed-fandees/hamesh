// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { youtubeAdapter } from '@/content/video-adapters/youtube';

// The adapter's URL-derived methods (getVideoId, getTimelineRect) ignore
// their `video` argument entirely — it exists to satisfy the shared
// `VideoPlayerAdapter` interface, which other adapters (e.g. html5-generic)
// do need it for. This stub just satisfies the call signature.
const stubVideo = {} as HTMLVideoElement;

function setLocation(href: string): void {
  Object.defineProperty(window, 'location', {
    value: new URL(href),
    writable: true,
    configurable: true,
  });
}

/** A trimmed-down replica of YouTube's watch-page player DOM shape: a
 *  `#movie_player` container holding the `<video class="html5-main-video">`
 *  and a `.ytp-progress-bar-container` — the two selectors the adapter
 *  actually depends on. */
function mountYouTubePlayer(): void {
  document.body.innerHTML = `
    <div id="movie_player" class="html5-video-player">
      <div class="html5-video-container">
        <video class="html5-main-video"></video>
      </div>
      <div class="ytp-chrome-bottom">
        <div class="ytp-progress-bar-container">
          <div class="ytp-progress-bar" role="slider"></div>
        </div>
      </div>
    </div>
  `;
}

describe('youtubeAdapter', () => {
  const originalLocation = window.location;

  afterEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  describe('matches', () => {
    it('is false on a non-YouTube host even with a matching DOM shape', () => {
      setLocation('https://example.com/watch?v=abc123');
      mountYouTubePlayer();
      expect(youtubeAdapter.matches()).toBe(false);
    });

    it('is false on a YouTube host with no player DOM (e.g. the homepage)', () => {
      setLocation('https://www.youtube.com/');
      expect(youtubeAdapter.matches()).toBe(false);
    });

    it('is true on a YouTube watch page with the player mounted', () => {
      setLocation('https://www.youtube.com/watch?v=abc123');
      mountYouTubePlayer();
      expect(youtubeAdapter.matches()).toBe(true);
    });

    it('is true on youtu.be short links', () => {
      setLocation('https://youtu.be/abc123');
      mountYouTubePlayer();
      expect(youtubeAdapter.matches()).toBe(true);
    });

    it('is true on m.youtube.com', () => {
      setLocation('https://m.youtube.com/watch?v=abc123');
      mountYouTubePlayer();
      expect(youtubeAdapter.matches()).toBe(true);
    });
  });

  describe('getActiveVideo / getPlayerContainer', () => {
    beforeEach(() => {
      setLocation('https://www.youtube.com/watch?v=abc123');
      mountYouTubePlayer();
    });

    it('finds the main video element', () => {
      const video = youtubeAdapter.getActiveVideo();
      expect(video).not.toBeNull();
      expect(video?.classList.contains('html5-main-video')).toBe(true);
    });

    it('returns the #movie_player container', () => {
      const container = youtubeAdapter.getPlayerContainer(youtubeAdapter.getActiveVideo()!);
      expect(container?.id).toBe('movie_player');
    });

    it('returns null for both when the player is not mounted', () => {
      document.body.innerHTML = '';
      expect(youtubeAdapter.getActiveVideo()).toBeNull();
    });
  });

  describe('getVideoId', () => {
    it('parses the v= query param on a watch page', () => {
      setLocation('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s');
      expect(youtubeAdapter.getVideoId(stubVideo)).toBe('dQw4w9WgXcQ');
    });

    it('parses the id from a youtu.be short link', () => {
      setLocation('https://youtu.be/dQw4w9WgXcQ');
      expect(youtubeAdapter.getVideoId(stubVideo)).toBe('dQw4w9WgXcQ');
    });

    it('parses the id from a youtu.be short link with extra path segments', () => {
      setLocation('https://youtu.be/dQw4w9WgXcQ/extra');
      expect(youtubeAdapter.getVideoId(stubVideo)).toBe('dQw4w9WgXcQ');
    });

    it('parses the id from a /shorts/ URL', () => {
      setLocation('https://www.youtube.com/shorts/dQw4w9WgXcQ');
      expect(youtubeAdapter.getVideoId(stubVideo)).toBe('dQw4w9WgXcQ');
    });

    it('parses the id from an /embed/ URL', () => {
      setLocation('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(youtubeAdapter.getVideoId(stubVideo)).toBe('dQw4w9WgXcQ');
    });

    it('returns null when no id can be found', () => {
      setLocation('https://www.youtube.com/feed/subscriptions');
      expect(youtubeAdapter.getVideoId(stubVideo)).toBeNull();
    });
  });

  describe('capabilities / getTimelineRect', () => {
    it('declares a native timeline', () => {
      expect(youtubeAdapter.capabilities.nativeTimeline).toBe(true);
    });

    it('returns the progress bar container rect when mounted', () => {
      setLocation('https://www.youtube.com/watch?v=abc123');
      mountYouTubePlayer();
      const rect = youtubeAdapter.getTimelineRect(stubVideo);
      expect(rect).not.toBeNull();
    });

    it('returns null when the progress bar is not mounted', () => {
      document.body.innerHTML = '';
      expect(youtubeAdapter.getTimelineRect(stubVideo)).toBeNull();
    });
  });

  describe('areControlsVisible', () => {
    beforeEach(() => {
      setLocation('https://www.youtube.com/watch?v=abc123');
      mountYouTubePlayer();
    });

    it('is true when the player container has no ytp-autohide class', () => {
      expect(youtubeAdapter.areControlsVisible(stubVideo)).toBe(true);
    });

    it('is false when the player container has the ytp-autohide class', () => {
      document.getElementById('movie_player')!.classList.add('ytp-autohide');
      expect(youtubeAdapter.areControlsVisible(stubVideo)).toBe(false);
    });

    it('fails open (true) when the player container cannot be found', () => {
      document.body.innerHTML = '';
      expect(youtubeAdapter.areControlsVisible(stubVideo)).toBe(true);
    });
  });
});
