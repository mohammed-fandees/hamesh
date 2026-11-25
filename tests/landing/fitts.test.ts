import { describe, expect, it } from 'vitest';
// @ts-expect-error the landing page is plain browser JavaScript, with no types
import { travelTime } from '../../landing/js/lib/fitts.js';

describe('travelTime', () => {
  it('follows Fitts’s law with a 24px target by default', () => {
    expect(travelTime(60)).toBeCloseTo(0.34, 2);
    expect(travelTime(300)).toBeCloseTo(0.54, 2);
    expect(travelTime(600)).toBeCloseTo(0.63, 2);
  });

  it('is quicker onto a bigger target', () => {
    expect(travelTime(300, 120)).toBeLessThan(travelTime(300, 24));
  });
});
