// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { html5GenericAdapter } from '@/content/video-adapters/html5-generic';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('html5GenericAdapter', () => {
  describe('matches', () => {
    it('is false when the page has no <video> element', () => {
      expect(html5GenericAdapter.matches()).toBe(false);
    });

    it('is true when the page has any <video> element', () => {
      document.body.innerHTML = '<video src="movie.mp4"></video>';
      expect(html5GenericAdapter.matches()).toBe(true);
    });
  });

  describe('getActiveVideo', () => {
    it('returns null when there are no videos', () => {
      expect(html5GenericAdapter.getActiveVideo()).toBeNull();
    });

    it('returns the only video when there is one', () => {
      document.body.innerHTML = '<video id="v1" src="a.mp4"></video>';
      const video = html5GenericAdapter.getActiveVideo();
      expect(video?.id).toBe('v1');
    });

    it('prefers a currently-playing video among several', () => {
      document.body.innerHTML = `
        <video id="paused" src="a.mp4"></video>
        <video id="playing" src="b.mp4"></video>
      `;
      const playing = document.getElementById('playing') as HTMLVideoElement;
      Object.defineProperty(playing, 'paused', { value: false, configurable: true });
      Object.defineProperty(playing, 'readyState', { value: 3, configurable: true });

      const video = html5GenericAdapter.getActiveVideo();
      expect(video?.id).toBe('playing');
    });

    it('falls back to the first video in document order when none are playing', () => {
      document.body.innerHTML = `
        <video id="first" src="a.mp4"></video>
        <video id="second" src="b.mp4"></video>
      `;
      const video = html5GenericAdapter.getActiveVideo();
      expect(video?.id).toBe('first');
    });
  });

  describe('getPlayerContainer', () => {
    it('returns the video element itself', () => {
      document.body.innerHTML = '<video id="v1" src="a.mp4"></video>';
      const video = document.getElementById('v1') as HTMLVideoElement;
      expect(html5GenericAdapter.getPlayerContainer(video)).toBe(video);
    });
  });

  describe('getVideoId', () => {
    it('derives an id from currentSrc when available', () => {
      document.body.innerHTML = '<video id="v1"></video>';
      const video = document.getElementById('v1') as HTMLVideoElement;
      Object.defineProperty(video, 'currentSrc', {
        value: 'https://example.com/a.mp4',
        configurable: true,
      });
      expect(html5GenericAdapter.getVideoId(video)).toBe('https://example.com/a.mp4');
    });

    it('falls back to the src attribute when currentSrc is empty', () => {
      document.body.innerHTML = '<video id="v1" src="a.mp4"></video>';
      const video = document.getElementById('v1') as HTMLVideoElement;
      expect(html5GenericAdapter.getVideoId(video)).toBe('a.mp4');
    });

    it('falls back to an ordinal id when no source is set at all', () => {
      document.body.innerHTML = '<video id="first"></video><video id="second"></video>';
      const second = document.getElementById('second') as HTMLVideoElement;
      expect(html5GenericAdapter.getVideoId(second)).toBe('video-1');
    });
  });

  describe('capabilities / getTimelineRect', () => {
    it('declares no native timeline', () => {
      expect(html5GenericAdapter.capabilities.nativeTimeline).toBe(false);
    });

    it('always returns null for getTimelineRect', () => {
      document.body.innerHTML = '<video id="v1" src="a.mp4"></video>';
      const video = document.getElementById('v1') as HTMLVideoElement;
      expect(html5GenericAdapter.getTimelineRect(video)).toBeNull();
    });
  });
});
