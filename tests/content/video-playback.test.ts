// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { holdPlayback } from '@/content/video-playback';

/** A real `<video>` in the document whose playback state is simulated —
 *  jsdom implements no media playback. `pause()`/`play()` flip `paused` and
 *  fire the same events a browser would. */
function makeVideo({
  playing,
  src = 'https://cdn.test/a.mp4',
}: {
  playing: boolean;
  src?: string;
}) {
  const video = document.createElement('video');
  document.body.appendChild(video);
  let paused = !playing;
  let currentSrc = src;
  Object.defineProperty(video, 'paused', { get: () => paused });
  Object.defineProperty(video, 'ended', { get: () => false });
  Object.defineProperty(video, 'currentSrc', { get: () => currentSrc });
  const pause = vi.fn(() => {
    paused = true;
    video.dispatchEvent(new Event('pause'));
  });
  const play = vi.fn(() => {
    paused = false;
    video.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  video.pause = pause;
  video.play = play;
  return {
    video,
    pause,
    play,
    isPaused: () => paused,
    /** The user pressing the player's own play/pause. */
    userPlay: () => play(),
    userPause: () => pause(),
    switchSource: (next: string) => {
      currentSrc = next;
    },
  };
}

describe('holdPlayback', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('pauses a playing video, and plays it again on release', () => {
    const v = makeVideo({ playing: true });
    const release = holdPlayback(v.video);
    expect(v.isPaused()).toBe(true);

    release();
    expect(v.play).toHaveBeenCalledTimes(1);
    expect(v.isPaused()).toBe(false);
  });

  it('never touches a video that was already paused — releasing it does not start it', () => {
    const v = makeVideo({ playing: false });
    const release = holdPlayback(v.video);
    release();
    expect(v.pause).not.toHaveBeenCalled();
    expect(v.play).not.toHaveBeenCalled();
    expect(v.isPaused()).toBe(true);
  });

  it('hands control to the user once they play it themselves while writing', () => {
    const v = makeVideo({ playing: true });
    const release = holdPlayback(v.video);
    v.userPlay();
    v.userPause(); // …and then pause it again, on purpose.
    v.play.mockClear();

    release();
    expect(v.play).not.toHaveBeenCalled();
    expect(v.isPaused()).toBe(true);
  });

  it('ignores a late play event from before the hold (a note reopened moments after closing)', () => {
    const v = makeVideo({ playing: true });
    const release = holdPlayback(v.video);
    // The previous resume's `play` event, dispatched only now — to a video
    // this hold has already paused.
    v.video.dispatchEvent(new Event('play'));

    release();
    expect(v.play).toHaveBeenCalledTimes(1);
    expect(v.isPaused()).toBe(false);
  });

  it('does not resume a different video that took over the same element', () => {
    const v = makeVideo({ playing: true });
    const release = holdPlayback(v.video);
    v.switchSource('https://cdn.test/b.mp4');
    release();
    expect(v.play).not.toHaveBeenCalled();
  });

  it('does not resume a video that has left the page', () => {
    const v = makeVideo({ playing: true });
    const release = holdPlayback(v.video);
    v.video.remove();
    release();
    expect(v.play).not.toHaveBeenCalled();
  });

  it('swallows a refused play() instead of throwing', async () => {
    const v = makeVideo({ playing: true });
    const release = holdPlayback(v.video);
    v.play.mockImplementationOnce(() =>
      Promise.reject(new DOMException('blocked', 'NotAllowedError')),
    );
    expect(() => release()).not.toThrow();
    await Promise.resolve();
  });
});
