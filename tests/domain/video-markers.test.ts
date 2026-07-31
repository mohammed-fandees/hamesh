import { describe, it, expect } from 'vitest';
import { computeMarkerX, clusterMarkers, formatVideoTimestamp } from '@/domain/video-markers';

describe('computeMarkerX', () => {
  const rail = { left: 100, width: 200 };

  it('places a marker at the start of the rail for timestamp 0', () => {
    expect(computeMarkerX(0, 60, rail)).toBe(100);
  });

  it('places a marker at the end of the rail for timestamp === duration', () => {
    expect(computeMarkerX(60, 60, rail)).toBe(300);
  });

  it('places a marker proportionally in between', () => {
    expect(computeMarkerX(30, 60, rail)).toBe(200);
  });

  it('clamps a timestamp beyond duration to the rail end', () => {
    expect(computeMarkerX(90, 60, rail)).toBe(300);
  });

  it('clamps a negative timestamp to the rail start', () => {
    expect(computeMarkerX(-5, 60, rail)).toBe(100);
  });

  it('degrades to the rail start when duration is unknown (0)', () => {
    expect(computeMarkerX(30, 0, rail)).toBe(100);
  });

  it('degrades to the rail start when duration is not finite', () => {
    expect(computeMarkerX(30, NaN, rail)).toBe(100);
    expect(computeMarkerX(30, Infinity, rail)).toBe(100);
  });
});

describe('clusterMarkers', () => {
  it('returns an empty array for no positions', () => {
    expect(clusterMarkers([], 10)).toEqual([]);
  });

  it('keeps far-apart markers as separate single-item clusters', () => {
    const positions = [
      { item: 'a', x: 0 },
      { item: 'b', x: 100 },
    ];
    const clusters = clusterMarkers(positions, 10);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toEqual({ items: ['a'], x: 0 });
    expect(clusters[1]).toEqual({ items: ['b'], x: 100 });
  });

  it('groups markers within threshold into one cluster', () => {
    const positions = [
      { item: 'a', x: 0 },
      { item: 'b', x: 5 },
      { item: 'c', x: 9 },
    ];
    const clusters = clusterMarkers(positions, 10);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].items).toEqual(['a', 'b', 'c']);
    expect(clusters[0].x).toBeCloseTo((0 + 5 + 9) / 3);
  });

  it('chains adjacent-gap groups even when the endpoints are far apart', () => {
    // a-b gap 8, b-c gap 8: both within threshold, so all three cluster
    // together even though a-c (16) would not on its own.
    const positions = [
      { item: 'a', x: 0 },
      { item: 'b', x: 8 },
      { item: 'c', x: 16 },
    ];
    const clusters = clusterMarkers(positions, 10);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].items).toEqual(['a', 'b', 'c']);
  });

  it('does not depend on input order', () => {
    const positions = [
      { item: 'c', x: 16 },
      { item: 'a', x: 0 },
      { item: 'b', x: 8 },
    ];
    const clusters = clusterMarkers(positions, 10);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].items).toEqual(['a', 'b', 'c']);
  });
});

describe('formatVideoTimestamp', () => {
  it('formats sub-minute values as m:ss', () => {
    expect(formatVideoTimestamp(5)).toBe('0:05');
  });

  it('formats minutes as m:ss', () => {
    expect(formatVideoTimestamp(90)).toBe('1:30');
  });

  it('formats double-digit minutes', () => {
    expect(formatVideoTimestamp(13 * 60 + 27)).toBe('13:27');
  });

  it('formats hours as h:mm:ss', () => {
    expect(formatVideoTimestamp(3661)).toBe('1:01:01');
  });

  it('floors fractional seconds', () => {
    expect(formatVideoTimestamp(5.9)).toBe('0:05');
  });

  it('clamps negative input to 0:00', () => {
    expect(formatVideoTimestamp(-10)).toBe('0:00');
  });

  it('clamps NaN input to 0:00', () => {
    expect(formatVideoTimestamp(NaN)).toBe('0:00');
  });
});
