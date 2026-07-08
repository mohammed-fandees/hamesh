import { describe, it, expect } from 'vitest';
import { parseColorLuminance } from '@/content/theme';

describe('parseColorLuminance', () => {
  it('returns low luminance for dark backgrounds', () => {
    const lum = parseColorLuminance('rgb(22, 20, 15)');
    expect(lum).not.toBeNull();
    expect(lum!).toBeLessThan(0.4);
  });

  it('returns high luminance for light backgrounds', () => {
    const lum = parseColorLuminance('rgb(247, 243, 236)');
    expect(lum).not.toBeNull();
    expect(lum!).toBeGreaterThan(0.4);
  });

  it('treats fully transparent colors as "no background"', () => {
    expect(parseColorLuminance('rgba(0, 0, 0, 0)')).toBeNull();
  });

  it('returns null for non-rgb values (e.g. named/keyword)', () => {
    expect(parseColorLuminance('transparent')).toBeNull();
  });
});
