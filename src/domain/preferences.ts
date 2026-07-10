import type { SchemaVersion } from './note';

/**
 * Supported interface languages. Kept structurally identical to `ui/i18n`'s
 * `Lang` (today: English + Arabic) without the domain layer depending on it.
 */
export type SupportedLanguage = 'en' | 'ar';

const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['en', 'ar'];

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Appearance modes. `match-website` is the MVP's original (and only) prior
 * behavior — adaptively picking light/dark from the host page — and stays
 * the default so nothing changes for anyone who hasn't opened Settings.
 */
export type AppearanceMode = 'match-website' | 'light' | 'dark';

const APPEARANCE_MODES: readonly AppearanceMode[] = ['match-website', 'light', 'dark'];

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return typeof value === 'string' && (APPEARANCE_MODES as readonly string[]).includes(value);
}

export interface Preferences {
  schemaVersion: SchemaVersion;
  /** No explicit choice yet — callers fall back to the browser's UI language.
   *  This is today's actual behavior, so it's also the default: users who
   *  never open Settings see no change. */
  language: SupportedLanguage | null;
  appearance: AppearanceMode;
}

export const DEFAULT_PREFERENCES: Preferences = {
  schemaVersion: 1,
  language: null,
  appearance: 'match-website',
};

/** Defensively parses stored preferences — missing, malformed, or unknown
 *  values fall back to the default rather than throwing. Also the migration
 *  path: preferences saved by Phase 2 (no `appearance` field at all) parse
 *  `appearance` as missing and fall back to `match-website`, so existing
 *  installs see no behavior change. */
export function parsePreferences(data: unknown): Preferences {
  if (!data || typeof data !== 'object') return DEFAULT_PREFERENCES;
  const record = data as Record<string, unknown>;
  return {
    schemaVersion: 1,
    language: isSupportedLanguage(record.language) ? record.language : null,
    appearance: isAppearanceMode(record.appearance) ? record.appearance : 'match-website',
  };
}
