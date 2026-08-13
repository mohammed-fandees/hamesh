// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import {
  getVideoAdapters,
  getMatchingAdapter,
  getActiveAdapterMatch,
} from '@/content/video-adapters/registry';

function setLocation(href: string): void {
  Object.defineProperty(window, 'location', {
    value: new URL(href),
    writable: true,
    configurable: true,
  });
}

describe('video adapter registry', () => {
  const originalLocation = window.location;

  afterEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('lists youtube, then custom-timeline, then html5 (priority — first match wins)', () => {
    const ids = getVideoAdapters().map((a) => a.id);
    expect(ids).toEqual(['youtube', 'custom-timeline', 'html5']);
  });

  it('returns null when no adapter matches', () => {
    setLocation('https://example.com/');
    expect(getMatchingAdapter()).toBeNull();
    expect(getActiveAdapterMatch()).toBeNull();
  });

  it('matches html5 on a plain page with a <video> element', () => {
    setLocation('https://example.com/watch');
    document.body.innerHTML = '<video id="v1" src="a.mp4"></video>';
    expect(getMatchingAdapter()?.id).toBe('html5');

    const match = getActiveAdapterMatch();
    expect(match?.adapter.id).toBe('html5');
    expect(match?.video.id).toBe('v1');
  });

  it('prefers custom-timeline over html5 for an opted-in player, off YouTube', () => {
    setLocation('https://example.com/docs');
    document.body.innerHTML = `
      <div data-hamesh-player>
        <video class="html5-main-video" src="a.mp4"></video>
        <div data-hamesh-timeline></div>
      </div>
    `;
    expect(getMatchingAdapter()?.id).toBe('custom-timeline');

    const match = getActiveAdapterMatch();
    expect(match?.adapter.id).toBe('custom-timeline');
    expect(match?.adapter.capabilities.nativeTimeline).toBe(true);
  });

  it('falls through to html5 for a data-hamesh-player missing its timeline', () => {
    setLocation('https://example.com/docs');
    document.body.innerHTML = `
      <div data-hamesh-player><video id="v2" src="a.mp4"></video></div>
    `;
    expect(getMatchingAdapter()?.id).toBe('html5');
  });

  it('prefers youtube over html5 on a YouTube watch page', () => {
    setLocation('https://www.youtube.com/watch?v=abc123');
    document.body.innerHTML = `
      <div id="movie_player">
        <video class="html5-main-video"></video>
        <div class="ytp-progress-bar-container"></div>
      </div>
    `;
    expect(getMatchingAdapter()?.id).toBe('youtube');

    const match = getActiveAdapterMatch();
    expect(match?.adapter.id).toBe('youtube');
    expect(match?.video.classList.contains('html5-main-video')).toBe(true);
  });

  it('returns null when the matching adapter has no active video', () => {
    setLocation('https://www.youtube.com/watch?v=abc123');
    // A YouTube host with no player DOM mounted yet (e.g. between SPA
    // navigations) — youtubeAdapter.matches() is false without the
    // progress bar + video, so this falls through to html5, which also
    // has nothing to match.
    expect(getActiveAdapterMatch()).toBeNull();
  });
});
