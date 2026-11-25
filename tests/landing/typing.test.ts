// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
// @ts-expect-error the landing page is plain browser JavaScript, with no types
import { graphemes, typingSchedule, typeInto } from '../../landing/js/lib/typing.js';

const MARKED = 'حدِّد';

interface Tween {
  target: { t: number };
  t: number;
  duration: number;
}

/** Stands in for a GSAP timeline: the test drives the tweened property through its setter. */
function fakeTimeline() {
  const tweens: Tween[] = [];
  return {
    tweens,
    to(target: { t: number }, vars: { t: number; duration: number }) {
      tweens.push({ target, t: vars.t, duration: vars.duration });
      return this;
    },
  };
}

const prefixesOf = (text: string) =>
  (graphemes(text) as string[]).map((_, i, all) => all.slice(0, i + 1).join(''));

describe('graphemes', () => {
  it('keeps an Arabic letter and its marks together', () => {
    const parts: string[] = graphemes(MARKED);
    expect(parts).toHaveLength(3);
    expect(parts.join('')).toBe(MARKED);
    for (const part of parts) expect(part).not.toMatch(/^\p{M}/u);
  });
});

describe('typingSchedule', () => {
  const gaps = (text: string): number[] => {
    const times: number[] = typingSchedule(text).times;
    return times.map((t, i) => t - (i ? times[i - 1] : 0));
  };

  it('is the same every time for the same text', () => {
    expect(typingSchedule('هنا بيت القصيد.')).toEqual(typingSchedule('هنا بيت القصيد.'));
  });

  it('jitters by a quarter around 55ms', () => {
    const all = gaps('abcdefghijklmnopqrstuvwxyz');
    for (const gap of all) {
      expect(gap).toBeGreaterThanOrEqual(0.055 * 0.75 - 1e-9);
      expect(gap).toBeLessThanOrEqual(0.055 * 1.25 + 1e-9);
    }
    expect(new Set(all.map((g) => g.toFixed(4))).size).toBeGreaterThan(5);
  });

  it('rests after a space, and longer after punctuation', () => {
    expect(gaps('ab cd')[3]).toBeGreaterThan(0.12 + 0.04);
    for (const mark of ['،', '.', '؛', ',', ';']) {
      expect(gaps(`a${mark}b`)[2]).toBeGreaterThan(0.22 + 0.04);
    }
  });
});

describe('typeInto', () => {
  it('shows whole graphemes only, and the whole text at the end', () => {
    const el = document.createElement('span');
    const tl = fakeTimeline();
    typeInto(tl, el, MARKED);
    expect(el.textContent).toBe('');

    const prefixes = prefixesOf(MARKED);
    const [{ target, t, duration }] = tl.tweens;
    expect(duration).toBeCloseTo(t);
    for (let at = 0; at <= t; at += 0.005) {
      target.t = at;
      if (el.textContent) expect(prefixes).toContain(el.textContent);
    }
    target.t = t;
    expect(el.textContent).toBe(MARKED);
  });

  it('holds the caret solid only while it is typing', () => {
    const caret = document.createElement('span');
    const tl = fakeTimeline();
    typeInto(tl, document.createElement('span'), 'abc', { caret });
    const [{ target, t }] = tl.tweens;
    target.t = t / 2;
    expect(caret.classList.contains('is-typing')).toBe(true);
    target.t = t;
    expect(caret.classList.contains('is-typing')).toBe(false);
  });

  it('rewinds to an empty field', () => {
    const el = document.createElement('span');
    const tl = fakeTimeline();
    const typing = typeInto(tl, el, 'abc');
    tl.tweens[0].target.t = tl.tweens[0].t;
    typing.reset();
    expect(el.textContent).toBe('');
  });
});
