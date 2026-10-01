import { describe, it, expect } from 'vitest';
import { formatDate, formatMoney, relativeTime } from '@/ui/format';

describe('relativeTime', () => {
  const now = new Date();
  function isoMinutesAgo(min: number): string {
    return new Date(now.getTime() - min * 60_000).toISOString();
  }

  it('formats recent, hourly and daily buckets in English', () => {
    expect(relativeTime(isoMinutesAgo(0), 'en')).toBe('just now');
    expect(relativeTime(isoMinutesAgo(5), 'en')).toBe('5m ago');
    expect(relativeTime(isoMinutesAgo(120), 'en')).toBe('2h ago');
    expect(relativeTime(isoMinutesAgo(60 * 24 * 3), 'en')).toBe('3d ago');
  });

  it('formats in Arabic', () => {
    expect(relativeTime(isoMinutesAgo(0), 'ar')).toBe('الآن');
    expect(relativeTime(isoMinutesAgo(5), 'ar')).toContain('دقيقة');
  });

  it('returns the raw value for an unparseable date', () => {
    const bad = 'not-a-date';
    expect(relativeTime(bad, 'en')).toBe(bad);
  });
});

describe('formatMoney', () => {
  it('shows minor units as the currency the server named', () => {
    // 450 EGP arrives as 45000 minor units; the extension knows no prices.
    const shown = formatMoney(45_000, 'EGP', 'en');
    expect(shown).toMatch(/450/);
    expect(shown).not.toMatch(/45000/);
  });

  it('falls back rather than throwing on a currency it does not know', () => {
    expect(formatMoney(1234, 'XYZ-not-a-currency', 'en')).toBe('12.34 XYZ-not-a-currency');
  });
});

describe('one formatter for both timestamp shapes', () => {
  const at = Date.now() - 5 * 60_000;

  it('reads an epoch number as readily as an ISO string', () => {
    expect(relativeTime(at, 'en')).toBe('5m ago');
    expect(relativeTime(new Date(at).toISOString(), 'en')).toBe('5m ago');
    expect(relativeTime(new Date(at), 'en')).toBe('5m ago');
  });

  it('formats a date either way', () => {
    const ms = Date.UTC(2026, 0, 15, 12);
    expect(formatDate(ms, 'en')).toBe(formatDate(new Date(ms).toISOString(), 'en'));
  });
});
