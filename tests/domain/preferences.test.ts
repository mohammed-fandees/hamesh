import { describe, it, expect } from 'vitest';
import { DEFAULT_PREFERENCES, isSupportedLanguage, parsePreferences } from '@/domain/preferences';

describe('isSupportedLanguage', () => {
  it('accepts only the languages Hamesh ships today', () => {
    expect(isSupportedLanguage('en')).toBe(true);
    expect(isSupportedLanguage('ar')).toBe(true);
  });

  it('rejects anything else, including near-misses and wrong types', () => {
    expect(isSupportedLanguage('fr')).toBe(false);
    expect(isSupportedLanguage('EN')).toBe(false);
    expect(isSupportedLanguage('')).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
    expect(isSupportedLanguage(undefined)).toBe(false);
    expect(isSupportedLanguage(1)).toBe(false);
  });
});

describe('parsePreferences', () => {
  it('defaults to no explicit language (follow the browser) for missing data', () => {
    expect(parsePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it('defaults for non-object and malformed shapes without throwing', () => {
    expect(parsePreferences('en')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(42)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences([])).toEqual(DEFAULT_PREFERENCES);
  });

  it('falls back to null for an unknown or malformed language value', () => {
    expect(parsePreferences({ language: 'fr' })).toEqual({ schemaVersion: 1, language: null });
    expect(parsePreferences({ language: 123 })).toEqual({ schemaVersion: 1, language: null });
    expect(parsePreferences({})).toEqual({ schemaVersion: 1, language: null });
  });

  it('round-trips a valid, explicitly chosen language', () => {
    expect(parsePreferences({ schemaVersion: 1, language: 'ar' })).toEqual({
      schemaVersion: 1,
      language: 'ar',
    });
    expect(parsePreferences({ language: 'en' })).toEqual({ schemaVersion: 1, language: 'en' });
  });

  it('normalizes schemaVersion to the current version regardless of stored value', () => {
    expect(parsePreferences({ schemaVersion: 99, language: 'ar' }).schemaVersion).toBe(1);
  });
});
