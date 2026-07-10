import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  isAppearanceMode,
  isSupportedLanguage,
  parsePreferences,
} from '@/domain/preferences';

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

describe('isAppearanceMode', () => {
  it('accepts the three shipped modes', () => {
    expect(isAppearanceMode('match-website')).toBe(true);
    expect(isAppearanceMode('light')).toBe(true);
    expect(isAppearanceMode('dark')).toBe(true);
  });

  it('rejects anything else, including near-misses and wrong types', () => {
    expect(isAppearanceMode('auto')).toBe(false);
    expect(isAppearanceMode('Light')).toBe(false);
    expect(isAppearanceMode('')).toBe(false);
    expect(isAppearanceMode(null)).toBe(false);
    expect(isAppearanceMode(undefined)).toBe(false);
    expect(isAppearanceMode(1)).toBe(false);
  });
});

describe('parsePreferences', () => {
  it('defaults to no explicit language and Match Website appearance for missing data', () => {
    expect(parsePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES.appearance).toBe('match-website');
  });

  it('defaults for non-object and malformed shapes without throwing', () => {
    expect(parsePreferences('en')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(42)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences([])).toEqual(DEFAULT_PREFERENCES);
  });

  it('falls back to null for an unknown or malformed language value', () => {
    expect(parsePreferences({ language: 'fr' }).language).toBeNull();
    expect(parsePreferences({ language: 123 }).language).toBeNull();
    expect(parsePreferences({}).language).toBeNull();
  });

  it('falls back to match-website for an unknown or malformed appearance value', () => {
    expect(parsePreferences({ appearance: 'auto' }).appearance).toBe('match-website');
    expect(parsePreferences({ appearance: 123 }).appearance).toBe('match-website');
    expect(parsePreferences({}).appearance).toBe('match-website');
  });

  it('migrates a Phase 2 stored object (no appearance field at all) to Match Website', () => {
    expect(parsePreferences({ schemaVersion: 1, language: 'ar' })).toEqual({
      schemaVersion: 1,
      language: 'ar',
      appearance: 'match-website',
    });
  });

  it('round-trips a valid, explicitly chosen language and appearance', () => {
    expect(parsePreferences({ schemaVersion: 1, language: 'ar', appearance: 'dark' })).toEqual({
      schemaVersion: 1,
      language: 'ar',
      appearance: 'dark',
    });
    expect(parsePreferences({ language: 'en', appearance: 'light' })).toEqual({
      schemaVersion: 1,
      language: 'en',
      appearance: 'light',
    });
  });

  it('normalizes schemaVersion to the current version regardless of stored value', () => {
    expect(parsePreferences({ schemaVersion: 99, language: 'ar' }).schemaVersion).toBe(1);
  });
});
