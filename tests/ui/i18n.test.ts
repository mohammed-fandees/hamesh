import { describe, it, expect } from 'vitest';
import { resolveLang, getStrings, dirForLang, relativeTime, type Lang } from '@/ui/i18n';

describe('resolveLang', () => {
  it('maps Arabic locale variants to "ar"', () => {
    expect(resolveLang('ar')).toBe('ar');
    expect(resolveLang('ar-EG')).toBe('ar');
    expect(resolveLang('AR-SA')).toBe('ar');
  });

  it('defaults to "en" for everything else and missing input', () => {
    expect(resolveLang('en-US')).toBe('en');
    expect(resolveLang('fr')).toBe('en');
    expect(resolveLang(undefined)).toBe('en');
    expect(resolveLang('')).toBe('en');
  });
});

describe('dirForLang', () => {
  it('is rtl for Arabic and ltr otherwise', () => {
    expect(dirForLang('ar')).toBe('rtl');
    expect(dirForLang('en')).toBe('ltr');
  });
});

describe('getStrings', () => {
  it('returns a distinct, complete string set per language', () => {
    const en = getStrings('en');
    const ar = getStrings('ar');
    expect(en.save).toBe('Save');
    expect(ar.save).toBe('حفظ');
    // Both language packs expose the same keys.
    expect(Object.keys(en).sort()).toEqual(Object.keys(ar).sort());
  });

  it('pluralizes the English page-count label', () => {
    const en = getStrings('en');
    expect(en.notesOnPage(1)).toBe('note on this page');
    expect(en.notesOnPage(3)).toBe('notes on this page');
  });
});

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
    expect(relativeTime(bad, 'en' as Lang)).toBe(bad);
  });
});
