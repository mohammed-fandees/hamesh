import { describe, it, expect } from 'vitest';
import { anchorBelow, fitPanel } from '@/ui/kit/select-placement';

const VIEWPORT = { width: 900, height: 600 };
const button = (top: number) => ({ top, bottom: top + 28, left: 100, width: 200 });
const place = (b: ReturnType<typeof button>, panel: { width: number; height: number }) =>
  fitPanel(anchorBelow(b), panel, b, VIEWPORT);

describe('where a Select’s list sits', () => {
  it('opens below the button when it fits there', () => {
    const b = button(100);
    expect(place(b, { width: 200, height: 200 })).toEqual({ top: 132, left: 100, width: 200 });
  });

  it('opens above the button when it does not fit below but does above', () => {
    const b = button(500); // 72px below, 492px above
    const fitted = place(b, { width: 200, height: 200 });
    expect(fitted.top).toBe(500 - 200 - 4);
    expect(fitted.maxHeight).toBeUndefined();
  });

  it('never runs off the screen: with room for neither, it takes the roomier side, shortened', () => {
    // A short window: 214px above the button, 330px below it — and the list is 400px tall.
    const b = { top: 214, bottom: 242, left: 100, width: 200 };
    const fitted = fitPanel(anchorBelow(b), { width: 200, height: 400 }, b, VIEWPORT);
    expect(fitted.maxHeight).toBe(600 - 242 - 8); // below is roomier
    expect(fitted.top).toBe(246);

    const high = { top: 380, bottom: 408, left: 100, width: 200 };
    const up = fitPanel(anchorBelow(high), { width: 200, height: 400 }, high, VIEWPORT);
    expect(up.maxHeight).toBe(380 - 8); // above is roomier
    expect(up.top).toBe(380 - (380 - 8) - 4);
  });

  it('settles: fitting an already-fitted list changes nothing', () => {
    const b = { top: 380, bottom: 408, left: 100, width: 200 };
    const first = fitPanel(anchorBelow(b), { width: 200, height: 400 }, b, VIEWPORT);
    const again = fitPanel(first, { width: 200, height: first.maxHeight! }, b, VIEWPORT);
    expect(again).toEqual(first);
  });

  it('keeps a wide list on screen sideways, without leaving its button', () => {
    const b = { top: 100, bottom: 128, left: 700, width: 150 };
    const fitted = fitPanel(anchorBelow(b), { width: 360, height: 100 }, b, VIEWPORT);
    expect(fitted.left).toBe(900 - 4 - 360);
    const left = { top: 100, bottom: 128, left: -20, width: 150 };
    expect(fitPanel(anchorBelow(left), { width: 100, height: 100 }, left, VIEWPORT).left).toBe(4);
  });
});
