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

/**
 * Contextual text notes ("هوامش") — one nested object rather than two flat
 * fields, so the feature's own settings can grow without reshaping
 * `Preferences` again (same reasoning as `Note.pageContext`).
 *
 * Both default to on: the feature ships enabled, and the selection action is
 * how it's discovered. `selectionAction` is the escape hatch for anyone who
 * finds a chip appearing after every selection intrusive — turning it off
 * leaves the keyboard shortcut as the way in, it does not turn the feature
 * off.
 *
 * Turning `enabled` off hides highlights and refuses new contextual notes.
 * It never touches stored notes or their anchors: every contextual note is
 * an ordinary note, still listed, searchable, editable and deletable in the
 * Notes Library, and every highlight comes back when it's switched on again.
 */
export interface TextNotePreferences {
  enabled: boolean;
  selectionAction: boolean;
}

export const DEFAULT_TEXT_NOTE_PREFERENCES: TextNotePreferences = {
  enabled: true,
  selectionAction: true,
};

export interface Preferences {
  schemaVersion: SchemaVersion;
  /** No explicit choice yet — callers fall back to the browser's UI language.
   *  This is today's actual behavior, so it's also the default: users who
   *  never open Settings see no change. */
  language: SupportedLanguage | null;
  appearance: AppearanceMode;
  textNotes: TextNotePreferences;
}

export const DEFAULT_PREFERENCES: Preferences = {
  schemaVersion: 1,
  language: null,
  appearance: 'match-website',
  textNotes: DEFAULT_TEXT_NOTE_PREFERENCES,
};

function parseTextNotes(value: unknown): TextNotePreferences {
  if (!value || typeof value !== 'object') return DEFAULT_TEXT_NOTE_PREFERENCES;
  const record = value as Record<string, unknown>;
  return {
    enabled:
      typeof record.enabled === 'boolean' ? record.enabled : DEFAULT_TEXT_NOTE_PREFERENCES.enabled,
    selectionAction:
      typeof record.selectionAction === 'boolean'
        ? record.selectionAction
        : DEFAULT_TEXT_NOTE_PREFERENCES.selectionAction,
  };
}

/** Defensively parses stored preferences — missing, malformed, or unknown
 *  values fall back to the default rather than throwing. Also the migration
 *  path: preferences saved by Phase 2 (no `appearance` field at all) parse
 *  `appearance` as missing and fall back to `match-website`, and preferences
 *  saved before contextual text notes existed get the feature's defaults —
 *  so existing installs see no behavior change either way. */
export function parsePreferences(data: unknown): Preferences {
  if (!data || typeof data !== 'object') return DEFAULT_PREFERENCES;
  const record = data as Record<string, unknown>;
  return {
    schemaVersion: 1,
    language: isSupportedLanguage(record.language) ? record.language : null,
    appearance: isAppearanceMode(record.appearance) ? record.appearance : 'match-website',
    textNotes: parseTextNotes(record.textNotes),
  };
}
