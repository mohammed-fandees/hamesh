// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  trackVideoContext,
  resolveVideoUnderInteraction,
  getActiveVideoUnderInteraction,
  getActiveVideoMatchUnderInteraction,
} from '@/content/video-context';
import type { VideoPlayerAdapter } from '@/content/video-adapters/types';

function makeAdapter(overrides?: Partial<VideoPlayerAdapter>): VideoPlayerAdapter {
  return {
    id: 'test',
    matches: () => true,
    getActiveVideo: () => null,
    getPlayerContainer: (video) => video,
    getVideoId: () => null,
    capabilities: { nativeTimeline: false },
    getTimelineRect: () => null,
    ...overrides,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('resolveVideoUnderInteraction', () => {
  it('returns null when there is no adapter match', () => {
    expect(resolveVideoUnderInteraction(null, null, null)).toBeNull();
  });

  it('returns the video when the hovered element is inside the player container', () => {
    document.body.innerHTML = `
      <div id="player"><video id="v"></video><button id="control"></button></div>
    `;
    const video = document.getElementById('v') as HTMLVideoElement;
    const control = document.getElementById('control') as HTMLElement;
    const container = document.getElementById('player') as HTMLElement;
    const adapter = makeAdapter({ getPlayerContainer: () => container });

    const result = resolveVideoUnderInteraction(control, null, { adapter, video });
    expect(result).toBe(video);
  });

  it('returns the video when the focused element is inside the player container', () => {
    document.body.innerHTML = `<div id="player"><video id="v"></video></div>`;
    const video = document.getElementById('v') as HTMLVideoElement;
    const container = document.getElementById('player') as HTMLElement;
    const adapter = makeAdapter({ getPlayerContainer: () => container });

    const result = resolveVideoUnderInteraction(null, video, { adapter, video });
    expect(result).toBe(video);
  });

  it('returns null when neither hover nor focus is inside the player container', () => {
    document.body.innerHTML = `
      <div id="player"><video id="v"></video></div>
      <button id="elsewhere"></button>
    `;
    const video = document.getElementById('v') as HTMLVideoElement;
    const container = document.getElementById('player') as HTMLElement;
    const elsewhere = document.getElementById('elsewhere') as HTMLElement;
    const adapter = makeAdapter({ getPlayerContainer: () => container });

    const result = resolveVideoUnderInteraction(elsewhere, elsewhere, { adapter, video });
    expect(result).toBeNull();
  });

  it('falls back to the video element itself when getPlayerContainer returns null', () => {
    document.body.innerHTML = `<video id="v"></video>`;
    const video = document.getElementById('v') as HTMLVideoElement;
    const adapter = makeAdapter({ getPlayerContainer: () => null });

    expect(resolveVideoUnderInteraction(video, null, { adapter, video })).toBe(video);
  });
});

describe('trackVideoContext + getActiveVideoUnderInteraction', () => {
  it('reflects the last pointermove target once tracking has started', () => {
    document.body.innerHTML = `
      <div id="movie_player">
        <video class="html5-main-video"></video>
        <div class="ytp-progress-bar-container"></div>
        <button id="control"></button>
      </div>
    `;
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/watch?v=abc123'),
      writable: true,
      configurable: true,
    });

    const stop = trackVideoContext();
    const control = document.getElementById('control')!;
    control.dispatchEvent(new Event('pointermove', { bubbles: true }));

    const video = getActiveVideoUnderInteraction();
    expect(video).not.toBeNull();
    expect(video?.classList.contains('html5-main-video')).toBe(true);

    stop();
  });

  it('stops reflecting pointer position after the returned unsubscribe runs', () => {
    document.body.innerHTML = `
      <div id="movie_player">
        <video class="html5-main-video"></video>
        <div class="ytp-progress-bar-container"></div>
        <button id="control"></button>
      </div>
    `;
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/watch?v=abc123'),
      writable: true,
      configurable: true,
    });

    const stop = trackVideoContext();
    stop();

    const control = document.getElementById('control')!;
    control.dispatchEvent(new Event('pointermove', { bubbles: true }));

    expect(getActiveVideoUnderInteraction()).toBeNull();
  });

  it('returns null when nothing is being hovered/focused, even with a matching adapter', () => {
    document.body.innerHTML = `
      <div id="movie_player">
        <video class="html5-main-video"></video>
        <div class="ytp-progress-bar-container"></div>
      </div>
    `;
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/watch?v=abc123'),
      writable: true,
      configurable: true,
    });

    const stop = trackVideoContext();
    expect(getActiveVideoUnderInteraction()).toBeNull();
    stop();
  });
});

describe('getActiveVideoMatchUnderInteraction', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns the adapter alongside the video when interacting with it', () => {
    document.body.innerHTML = `
      <div id="movie_player">
        <video class="html5-main-video"></video>
        <div class="ytp-progress-bar-container"></div>
        <button id="control"></button>
      </div>
    `;
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/watch?v=abc123'),
      writable: true,
      configurable: true,
    });

    const stop = trackVideoContext();
    document.getElementById('control')!.dispatchEvent(new Event('pointermove', { bubbles: true }));

    const match = getActiveVideoMatchUnderInteraction();
    expect(match?.adapter.id).toBe('youtube');
    expect(match?.video.classList.contains('html5-main-video')).toBe(true);

    stop();
  });

  it('returns null when not interacting with the video, even with a matching adapter', () => {
    document.body.innerHTML = `
      <div id="movie_player">
        <video class="html5-main-video"></video>
        <div class="ytp-progress-bar-container"></div>
      </div>
      <button id="elsewhere"></button>
    `;
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/watch?v=abc123'),
      writable: true,
      configurable: true,
    });

    const stop = trackVideoContext();
    document
      .getElementById('elsewhere')!
      .dispatchEvent(new Event('pointermove', { bubbles: true }));

    expect(getActiveVideoMatchUnderInteraction()).toBeNull();
    stop();
  });
});
