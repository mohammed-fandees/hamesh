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

export interface Preferences {
  schemaVersion: SchemaVersion;
  /** No explicit choice yet — callers fall back to the browser's UI language.
   *  This is today's actual behavior, so it's also the default: users who
   *  never open Settings see no change. */
  language: SupportedLanguage | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  schemaVersion: 1,
  language: null,
};

/** Defensively parses stored preferences — missing, malformed, or unknown
 *  values fall back to the default rather than throwing. */
export function parsePreferences(data: unknown): Preferences {
  if (!data || typeof data !== 'object') return DEFAULT_PREFERENCES;
  const language = (data as Record<string, unknown>).language;
  return {
    schemaVersion: 1,
    language: isSupportedLanguage(language) ? language : null,
  };
}
