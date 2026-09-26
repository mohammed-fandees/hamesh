import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  isAppearanceMode,
  isSupportedLanguage,
  parsePreferences,
  resolveDefaultFolderId,
  withGlobalDefaultFolder,
  withPageDefaultFolder,
  type FolderDefaultPreferences,
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
      textNotes: { enabled: true, selectionAction: true },
      releaseNotes: { lastSeenVersion: null },
      folderDefaults: { global: null, pages: {} },
    });
  });

  it('round-trips a valid, explicitly chosen language and appearance', () => {
    expect(parsePreferences({ schemaVersion: 1, language: 'ar', appearance: 'dark' })).toEqual({
      schemaVersion: 1,
      language: 'ar',
      appearance: 'dark',
      textNotes: { enabled: true, selectionAction: true },
      releaseNotes: { lastSeenVersion: null },
      folderDefaults: { global: null, pages: {} },
    });
    expect(parsePreferences({ language: 'en', appearance: 'light' })).toEqual({
      schemaVersion: 1,
      language: 'en',
      appearance: 'light',
      textNotes: { enabled: true, selectionAction: true },
      releaseNotes: { lastSeenVersion: null },
      folderDefaults: { global: null, pages: {} },
    });
  });

  it('normalizes schemaVersion to the current version regardless of stored value', () => {
    expect(parsePreferences({ schemaVersion: 99, language: 'ar' }).schemaVersion).toBe(1);
  });
});

describe('parsePreferences — release notes state', () => {
  it('treats a missing releaseNotes object as "never opened What\u2019s New"', () => {
    expect(parsePreferences({ schemaVersion: 1 }).releaseNotes).toEqual({ lastSeenVersion: null });
  });

  it('round-trips a stored last-seen version', () => {
    const parsed = parsePreferences({ releaseNotes: { lastSeenVersion: '1.2.0' } });
    expect(parsed.releaseNotes.lastSeenVersion).toBe('1.2.0');
  });

  it('falls back to null for a malformed last-seen version rather than trusting it', () => {
    // A non-string here would flow straight into `compareVersions` and make
    // "is there anything new" answer nonsense.
    expect(parsePreferences({ releaseNotes: { lastSeenVersion: 3 } }).releaseNotes).toEqual({
      lastSeenVersion: null,
    });
    expect(parsePreferences({ releaseNotes: 'nope' }).releaseNotes).toEqual({
      lastSeenVersion: null,
    });
  });
});

describe('parsePreferences — folder defaults', () => {
  it('has no default folder anywhere for preferences saved before folder defaults existed', () => {
    expect(parsePreferences({ schemaVersion: 1, language: 'ar' }).folderDefaults).toEqual({
      global: null,
      pages: {},
    });
  });

  it('round-trips a global default and per-page defaults', () => {
    const parsed = parsePreferences({
      folderDefaults: {
        global: 'f-global',
        pages: { 'https://a.com/x': 'f-a', 'https://b.com/y': 'f-b' },
      },
    });
    expect(parsed.folderDefaults).toEqual({
      global: 'f-global',
      pages: { 'https://a.com/x': 'f-a', 'https://b.com/y': 'f-b' },
    });
  });

  it('drops malformed entries instead of trusting them', () => {
    const parsed = parsePreferences({
      folderDefaults: {
        global: 42,
        pages: { 'https://a.com/x': 'f-a', 'https://b.com/y': 7, 'https://c.com/z': '' },
      },
    });
    expect(parsed.folderDefaults).toEqual({ global: null, pages: { 'https://a.com/x': 'f-a' } });
    expect(parsePreferences({ folderDefaults: 'nope' }).folderDefaults).toEqual({
      global: null,
      pages: {},
    });
    expect(parsePreferences({ folderDefaults: { pages: ['f-a'] } }).folderDefaults).toEqual({
      global: null,
      pages: {},
    });
  });
});

describe('resolveDefaultFolderId', () => {
  const PAGE = 'https://example.com/article';
  const existing = new Set(['f-page', 'f-global', 'f-other']);
  const both: FolderDefaultPreferences = {
    global: 'f-global',
    pages: { [PAGE]: 'f-page', 'https://example.com/other': 'f-other' },
  };

  it("prefers the page's own default over the global one", () => {
    expect(resolveDefaultFolderId(both, PAGE, existing)).toBe('f-page');
  });

  it('falls back to the global default on a page with none of its own', () => {
    expect(resolveDefaultFolderId(both, 'https://example.com/new', existing)).toBe('f-global');
  });

  it('selects nothing when neither is set', () => {
    expect(resolveDefaultFolderId({ global: null, pages: {} }, PAGE, existing)).toBeNull();
  });

  it('skips a page default whose folder no longer exists, falling through to the global one', () => {
    const stale = { ...both, pages: { [PAGE]: 'f-deleted' } };
    expect(resolveDefaultFolderId(stale, PAGE, existing)).toBe('f-global');
  });

  it('skips a global default whose folder no longer exists', () => {
    expect(resolveDefaultFolderId({ global: 'f-deleted', pages: {} }, PAGE, existing)).toBeNull();
  });

  it('never reads an inherited property as a page default', () => {
    expect(resolveDefaultFolderId({ global: null, pages: {} }, 'constructor', existing)).toBeNull();
  });
});

describe('withPageDefaultFolder / withGlobalDefaultFolder', () => {
  const start: FolderDefaultPreferences = {
    global: 'f-global',
    pages: { 'https://a.com/x': 'f-a', 'https://b.com/y': 'f-b' },
  };

  it("sets one page's default without touching other pages or the global default", () => {
    expect(withPageDefaultFolder(start, 'https://a.com/x', 'f-new')).toEqual({
      global: 'f-global',
      pages: { 'https://a.com/x': 'f-new', 'https://b.com/y': 'f-b' },
    });
  });

  it("clears one page's default and nothing else", () => {
    expect(withPageDefaultFolder(start, 'https://a.com/x', null)).toEqual({
      global: 'f-global',
      pages: { 'https://b.com/y': 'f-b' },
    });
  });

  it('sets and clears the global default without touching any page default', () => {
    expect(withGlobalDefaultFolder(start, 'f-new')).toEqual({ ...start, global: 'f-new' });
    expect(withGlobalDefaultFolder(start, null)).toEqual({ ...start, global: null });
  });

  it('never mutates the defaults it was given', () => {
    const snapshot = structuredClone(start);
    withPageDefaultFolder(start, 'https://c.com/z', 'f-c');
    withPageDefaultFolder(start, 'https://a.com/x', null);
    withGlobalDefaultFolder(start, null);
    expect(start).toEqual(snapshot);
  });
});
