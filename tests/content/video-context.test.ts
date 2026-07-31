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
    areControlsVisible: () => true,
    ...overrides,
  };
}

/** jsdom has no layout engine — every element's real `getBoundingClientRect`
 *  is a zeroed rect — so the coordinate-based hover check needs a stub to
 *  be testable at all. */
function stubRect(
  el: Element,
  rect: { left: number; top: number; width: number; height: number },
): void {
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => rect,
    }) as DOMRect;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('resolveVideoUnderInteraction', () => {
  it('returns null when there is no adapter match', () => {
    expect(resolveVideoUnderInteraction(null, null, null)).toBeNull();
  });

  it('returns the video when the pointer position is within the player container bounds', () => {
    document.body.innerHTML = `<div id="player"><video id="v"></video></div>`;
    const video = document.getElementById('v') as HTMLVideoElement;
    const container = document.getElementById('player') as HTMLElement;
    stubRect(container, { left: 0, top: 0, width: 300, height: 150 });
    const adapter = makeAdapter({ getPlayerContainer: () => container });

    const result = resolveVideoUnderInteraction({ x: 150, y: 75 }, null, { adapter, video });
    expect(result).toBe(video);
  });

  it('returns the video when the pointer is over an overlay that is a sibling, not a descendant, of the container', () => {
    // Models a real custom player: a play-button/ad overlay CSS-positioned
    // on top of the container as a sibling, not nested inside it — this is
    // exactly the shape a strict `.contains()` check used to miss (see the
    // module doc comment).
    document.body.innerHTML = `
      <div id="wrapper">
        <div id="player"><video id="v"></video></div>
        <div id="overlay"></div>
      </div>
    `;
    const video = document.getElementById('v') as HTMLVideoElement;
    const container = document.getElementById('player') as HTMLElement;
    const overlay = document.getElementById('overlay') as HTMLElement;
    stubRect(container, { left: 0, top: 0, width: 300, height: 150 });
    stubRect(overlay, { left: 0, top: 0, width: 300, height: 150 });
    const adapter = makeAdapter({ getPlayerContainer: () => container });

    // The pointer is over `overlay` (not a descendant of `container`), at
    // coordinates that are visually within the container's bounds.
    const result = resolveVideoUnderInteraction({ x: 150, y: 75 }, null, { adapter, video });
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

  it('returns null when the pointer position is outside the player container bounds', () => {
    document.body.innerHTML = `<div id="player"><video id="v"></video></div>`;
    const video = document.getElementById('v') as HTMLVideoElement;
    const container = document.getElementById('player') as HTMLElement;
    stubRect(container, { left: 0, top: 0, width: 300, height: 150 });
    const adapter = makeAdapter({ getPlayerContainer: () => container });

    const result = resolveVideoUnderInteraction({ x: 500, y: 500 }, null, { adapter, video });
    expect(result).toBeNull();
  });

  it('returns null when neither hover nor focus is inside/over the player container', () => {
    document.body.innerHTML = `
      <div id="player"><video id="v"></video></div>
      <button id="elsewhere"></button>
    `;
    const video = document.getElementById('v') as HTMLVideoElement;
    const container = document.getElementById('player') as HTMLElement;
    const elsewhere = document.getElementById('elsewhere') as HTMLElement;
    stubRect(container, { left: 0, top: 0, width: 300, height: 150 });
    const adapter = makeAdapter({ getPlayerContainer: () => container });

    const result = resolveVideoUnderInteraction({ x: 999, y: 999 }, elsewhere, { adapter, video });
    expect(result).toBeNull();
  });

  it('falls back to the video element itself when getPlayerContainer returns null', () => {
    document.body.innerHTML = `<video id="v"></video>`;
    const video = document.getElementById('v') as HTMLVideoElement;
    stubRect(video, { left: 0, top: 0, width: 300, height: 150 });
    const adapter = makeAdapter({ getPlayerContainer: () => null });

    expect(resolveVideoUnderInteraction({ x: 10, y: 10 }, null, { adapter, video })).toBe(video);
  });

  it('treats a zero-size container rect as not hoverable (nothing rendered yet)', () => {
    document.body.innerHTML = `<div id="player"><video id="v"></video></div>`;
    const video = document.getElementById('v') as HTMLVideoElement;
    const container = document.getElementById('player') as HTMLElement;
    // Deliberately not stubbed — jsdom's real getBoundingClientRect is a
    // zeroed rect, matching an element that hasn't been laid out yet.
    const adapter = makeAdapter({ getPlayerContainer: () => container });

    const result = resolveVideoUnderInteraction({ x: 0, y: 0 }, null, { adapter, video });
    expect(result).toBeNull();
  });
});

describe('trackVideoContext + getActiveVideoUnderInteraction', () => {
  function mountYouTubePlayer(): { container: HTMLElement; video: HTMLVideoElement } {
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
    const container = document.getElementById('movie_player') as HTMLElement;
    stubRect(container, { left: 0, top: 0, width: 640, height: 360 });
    return { container, video: document.querySelector('video') as HTMLVideoElement };
  }

  it('reflects the last pointermove position once tracking has started', () => {
    mountYouTubePlayer();
    const stop = trackVideoContext();
    window.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 300, clientY: 180 }),
    );

    const video = getActiveVideoUnderInteraction();
    expect(video).not.toBeNull();
    expect(video?.classList.contains('html5-main-video')).toBe(true);

    stop();
  });

  it('stops reflecting pointer position after the returned unsubscribe runs', () => {
    mountYouTubePlayer();
    const stop = trackVideoContext();
    stop();

    window.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 300, clientY: 180 }),
    );

    expect(getActiveVideoUnderInteraction()).toBeNull();
  });

  it('returns null when nothing is being hovered/focused, even with a matching adapter', () => {
    mountYouTubePlayer();
    const stop = trackVideoContext();
    expect(getActiveVideoUnderInteraction()).toBeNull();
    stop();
  });

  it('returns null when the pointer has moved but stays outside the player bounds', () => {
    mountYouTubePlayer();
    const stop = trackVideoContext();
    window.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 5000, clientY: 5000 }),
    );

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
      </div>
    `;
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/watch?v=abc123'),
      writable: true,
      configurable: true,
    });
    const container = document.getElementById('movie_player') as HTMLElement;
    stubRect(container, { left: 0, top: 0, width: 640, height: 360 });

    const stop = trackVideoContext();
    window.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 300, clientY: 180 }),
    );

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
    `;
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/watch?v=abc123'),
      writable: true,
      configurable: true,
    });
    const container = document.getElementById('movie_player') as HTMLElement;
    stubRect(container, { left: 0, top: 0, width: 640, height: 360 });

    const stop = trackVideoContext();
    window.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: 9000, clientY: 9000 }),
    );

    expect(getActiveVideoMatchUnderInteraction()).toBeNull();
    stop();
  });
});
