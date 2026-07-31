import { describe, it, expect } from 'vitest';
import { buildVideoAnchor } from '@/domain/video-anchor';
import type { VideoIdentitySource } from '@/domain/video-anchor';

function makeVideo(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  return {
    currentTime: 0,
    duration: NaN,
    ...overrides,
  } as HTMLVideoElement;
}

describe('buildVideoAnchor', () => {
  it('captures the current timestamp and adapter id/videoId', () => {
    const video = makeVideo({ currentTime: 42.5 });
    const adapter: VideoIdentitySource = { id: 'youtube', getVideoId: () => 'abc123' };

    const anchor = buildVideoAnchor(video, adapter);

    expect(anchor).toEqual({
      type: 'video',
      platform: 'youtube',
      videoId: 'abc123',
      timestamp: 42.5,
      duration: undefined,
    });
  });

  it('captures duration when finite', () => {
    const video = makeVideo({ currentTime: 10, duration: 300 });
    const adapter: VideoIdentitySource = { id: 'youtube', getVideoId: () => 'abc123' };

    const anchor = buildVideoAnchor(video, adapter);

    expect(anchor?.duration).toBe(300);
  });

  it('omits duration when Infinity (e.g. a live stream)', () => {
    const video = makeVideo({ currentTime: 10, duration: Infinity });
    const adapter: VideoIdentitySource = { id: 'youtube', getVideoId: () => 'abc123' };

    const anchor = buildVideoAnchor(video, adapter);

    expect(anchor?.duration).toBeUndefined();
  });

  it('returns null when the adapter cannot produce a stable id', () => {
    const video = makeVideo();
    const adapter: VideoIdentitySource = { id: 'html5', getVideoId: () => null };

    expect(buildVideoAnchor(video, adapter)).toBeNull();
  });
});
