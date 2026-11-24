import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { watchVisit } from '@/content/visit-watch';
import type { VisitOutcome } from '@/domain/anchor-health';

/** A page whose changes the test makes, and whose notes it decides are found or not. */
function page(initial: Record<string, VisitOutcome>) {
  let state = new Map(Object.entries(initial));
  let onChange: () => void = () => {};
  const observe = vi.fn((cb: () => void) => {
    onChange = cb;
    return vi.fn();
  });
  return {
    observe,
    evaluate: vi.fn(() => new Map(state)),
    set(next: Record<string, VisitOutcome>) {
      state = new Map(Object.entries(next));
    },
    change: () => onChange(),
  };
}

describe('watchVisit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('gives a quiet page its verdict at 10 s, after a quiet check, and not before', () => {
    const p = page({ a: 'missed', b: 'found' });
    const onVerdict = vi.fn();
    watchVisit({ evaluate: p.evaluate, onVerdict, observe: p.observe });

    vi.advanceTimersByTime(3_000);
    expect(p.evaluate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(6_999);
    expect(onVerdict).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onVerdict).toHaveBeenCalledWith(
      new Map([
        ['a', 'missed'],
        ['b', 'found'],
      ]),
    );
    expect(p.evaluate).toHaveBeenCalledTimes(2);
  });

  it('counts a section that loads late as found', () => {
    const p = page({ a: 'missed' });
    const onVerdict = vi.fn();
    watchVisit({ evaluate: p.evaluate, onVerdict, observe: p.observe });

    vi.advanceTimersByTime(2_000);
    p.set({ a: 'found' });
    p.change();
    vi.advanceTimersByTime(10_000);
    expect(onVerdict).toHaveBeenCalledWith(new Map([['a', 'found']]));
  });

  it('counts a note found at any check as found, even if the last check missed it', () => {
    const p = page({ a: 'found' });
    const onVerdict = vi.fn();
    watchVisit({ evaluate: p.evaluate, onVerdict, observe: p.observe });

    vi.advanceTimersByTime(3_000);
    p.set({ a: 'missed' });
    vi.advanceTimersByTime(7_000);
    expect(onVerdict).toHaveBeenCalledWith(new Map([['a', 'found']]));
  });

  it('waits past 10 s for a page that is still changing, until it is quiet', () => {
    const p = page({ a: 'missed' });
    const onVerdict = vi.fn();
    watchVisit({ evaluate: p.evaluate, onVerdict, observe: p.observe });

    for (let t = 0; t < 12_000; t += 1_000) {
      p.change();
      vi.advanceTimersByTime(1_000);
    }
    expect(onVerdict).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3_000);
    expect(onVerdict).toHaveBeenCalledWith(new Map([['a', 'missed']]));
  });

  it('still decides at 30 s on a page that never stops changing', () => {
    const p = page({ a: 'missed' });
    const onVerdict = vi.fn();
    watchVisit({ evaluate: p.evaluate, onVerdict, observe: p.observe });

    for (let t = 0; t < 29_000; t += 1_000) {
      p.change();
      vi.advanceTimersByTime(1_000);
    }
    expect(onVerdict).not.toHaveBeenCalled();
    p.change();
    vi.advanceTimersByTime(1_000);
    expect(onVerdict).toHaveBeenCalledTimes(1);
  });

  it('says nothing about a visit stopped before its verdict, and stops listening', () => {
    const p = page({ a: 'missed' });
    const onVerdict = vi.fn();
    const stop = watchVisit({ evaluate: p.evaluate, onVerdict, observe: p.observe });

    vi.advanceTimersByTime(5_000);
    stop();
    vi.advanceTimersByTime(60_000);
    expect(onVerdict).not.toHaveBeenCalled();
    const unobserve = p.observe.mock.results[0].value;
    expect(unobserve).toHaveBeenCalled();
  });

  it('decides once and then goes quiet', () => {
    const p = page({ a: 'missed' });
    const onVerdict = vi.fn();
    watchVisit({ evaluate: p.evaluate, onVerdict, observe: p.observe });
    vi.advanceTimersByTime(60_000);
    p.change();
    vi.advanceTimersByTime(60_000);
    expect(onVerdict).toHaveBeenCalledTimes(1);
  });
});
