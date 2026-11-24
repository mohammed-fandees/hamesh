import { describe, it, expect } from 'vitest';
import {
  applyVisit,
  healthIds,
  isLost,
  isPlaceless,
  nextAnchorHealth,
  parseAnchorHealth,
  type AnchorHealth,
  type VisitOutcome,
} from '@/domain/anchor-health';

const PAGE = 'https://maktaba.site/bennabi/conditions';
const T1 = '2026-11-01T10:00:00.000Z';
const T2 = '2026-11-02T10:00:00.000Z';
const visit = (now = T1) => ({ pageKey: PAGE, now });

const entry = (overrides: Partial<AnchorHealth> = {}): AnchorHealth => ({
  status: 'suspect',
  misses: 1,
  lastCheckedAt: T1,
  pageKey: PAGE,
  ...overrides,
});

describe('nextAnchorHealth', () => {
  it('keeps nothing for a note that was found', () => {
    expect(nextAnchorHealth(undefined, 'found', visit())).toBeUndefined();
  });

  it('only suspects a note after one missed visit — one miss never flags it', () => {
    const after = nextAnchorHealth(undefined, 'missed', visit());
    expect(after).toEqual({ status: 'suspect', misses: 1, lastCheckedAt: T1, pageKey: PAGE });
    expect(isLost(after)).toBe(false);
  });

  it('calls a note lost when a second visit misses it too', () => {
    const after = nextAnchorHealth(entry(), 'missed', visit(T2));
    expect(after).toEqual({ status: 'lost', misses: 2, lastCheckedAt: T2, pageKey: PAGE });
    expect(isLost(after)).toBe(true);
  });

  it('caps the misses of a note that stays lost', () => {
    const after = nextAnchorHealth(entry({ status: 'lost', misses: 2 }), 'missed', visit(T2));
    expect(after?.misses).toBe(2);
    expect(after?.status).toBe('lost');
  });

  it('clears a lost note the moment a visit finds it', () => {
    expect(
      nextAnchorHealth(entry({ status: 'lost', misses: 2 }), 'found', visit()),
    ).toBeUndefined();
  });

  it('clears a suspect note that a later visit finds', () => {
    expect(nextAnchorHealth(entry(), 'found', visit())).toBeUndefined();
  });

  it('leaves a note the reader kept without a place alone when it is missed again', () => {
    const kept = entry({ status: 'kept-without-place', misses: 2 });
    expect(nextAnchorHealth(kept, 'missed', visit(T2))).toBe(kept);
  });

  it('clears a kept note that finds its place again', () => {
    const kept = entry({ status: 'kept-without-place', misses: 2 });
    expect(nextAnchorHealth(kept, 'found', visit())).toBeUndefined();
  });
});

describe('parseAnchorHealth', () => {
  it('keeps valid entries and drops everything else', () => {
    const parsed = parseAnchorHealth({
      a: entry(),
      b: { ...entry(), status: 'gone' },
      c: { ...entry(), misses: -1 },
      d: { ...entry(), misses: 1.5 },
      e: { ...entry(), pageKey: '' },
      f: { ...entry(), lastCheckedAt: 4 },
      g: 'lost',
      h: null,
      i: entry({ status: 'lost', misses: 9 }),
    });
    expect(Object.keys(parsed).sort()).toEqual(['a', 'i']);
    expect(parsed.i.misses).toBe(2);
  });

  it('reads anything that is not a map as empty', () => {
    expect(parseAnchorHealth(null)).toEqual({});
    expect(parseAnchorHealth([entry()])).toEqual({});
    expect(parseAnchorHealth('x')).toEqual({});
  });
});

describe('applyVisit', () => {
  const outcomes = (pairs: [string, VisitOutcome][]) => new Map(pairs);

  it('changes nothing when every note was found and none was flagged', () => {
    expect(applyVisit({}, PAGE, outcomes([['a', 'found']]), T1)).toBeNull();
  });

  it('adds a suspect, clears a found one, and leaves notes the visit did not check', () => {
    const map = { b: entry({ status: 'lost', misses: 2 }), other: entry({ pageKey: 'x' }) };
    const next = applyVisit(
      map,
      PAGE,
      outcomes([
        ['a', 'missed'],
        ['b', 'found'],
      ]),
      T2,
    );
    expect(next).toEqual({
      a: { status: 'suspect', misses: 1, lastCheckedAt: T2, pageKey: PAGE },
      other: map.other,
    });
  });

  it('changes nothing for a kept note that is missed again', () => {
    const map = { a: entry({ status: 'kept-without-place' }) };
    expect(applyVisit(map, PAGE, outcomes([['a', 'missed']]), T2)).toBeNull();
  });
});

describe('isPlaceless and healthIds', () => {
  it('counts lost and kept notes as having no place, and only lost ones as lost', () => {
    const map = {
      s: entry(),
      l: entry({ status: 'lost', misses: 2 }),
      k: entry({ status: 'kept-without-place' }),
    };
    expect([...healthIds(map, isPlaceless)].sort()).toEqual(['k', 'l']);
    expect([...healthIds(map, isLost)]).toEqual(['l']);
  });
});
