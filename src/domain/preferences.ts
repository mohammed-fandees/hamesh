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

/**
 * What's New state. Not a setting the user chooses — it's the extension
 * remembering what it has already shown them — but it lives here rather than
 * in a storage key of its own for the same reason every other small piece of
 * persisted state does: one record, one repository, one `watch()`, one
 * defensive parse (see "Storage boundary" in docs/architecture.md).
 *
 * `null` means "has never opened What's New", which is deliberately
 * different from "has seen version X": the page shows the whole history to
 * someone who has never read it, instead of claiming there is nothing new.
 */
export interface ReleaseNotesPreferences {
  lastSeenVersion: string | null;
}

export const DEFAULT_RELEASE_NOTES_PREFERENCES: ReleaseNotesPreferences = {
  lastSeenVersion: null,
};

/**
 * Which folder a new note is filed into without the user having to pick
 * one — the composer's folder selector starts on it. Two levels, resolved
 * page first (see `resolveDefaultFolderId`):
 *
 * - `pages` — a default for one page, keyed by the same `pageKey` notes are
 *   stored under. Setting or clearing one never touches another page's, or
 *   the global default.
 * - `global` — the default everywhere a page has none of its own.
 *
 * Nested for the same reason `textNotes` is: the unit that grows is the
 * group, not a flat field per setting. A default is only a pointer — it can
 * outlive the folder it names (deleted from the Notes Library, or never
 * restored from a backup), so every reader resolves it against the folders
 * that actually exist rather than trusting it.
 */
export interface FolderDefaultPreferences {
  global: string | null;
  pages: Record<string, string>;
}

export const DEFAULT_FOLDER_DEFAULT_PREFERENCES: FolderDefaultPreferences = {
  global: null,
  pages: {},
};

export interface Preferences {
  schemaVersion: SchemaVersion;
  /** No explicit choice yet — callers fall back to the browser's UI language.
   *  This is today's actual behavior, so it's also the default: users who
   *  never open Settings see no change. */
  language: SupportedLanguage | null;
  appearance: AppearanceMode;
  textNotes: TextNotePreferences;
  releaseNotes: ReleaseNotesPreferences;
  folderDefaults: FolderDefaultPreferences;
}

export const DEFAULT_PREFERENCES: Preferences = {
  schemaVersion: 1,
  language: null,
  appearance: 'match-website',
  textNotes: DEFAULT_TEXT_NOTE_PREFERENCES,
  releaseNotes: DEFAULT_RELEASE_NOTES_PREFERENCES,
  folderDefaults: DEFAULT_FOLDER_DEFAULT_PREFERENCES,
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

function parseReleaseNotes(value: unknown): ReleaseNotesPreferences {
  if (!value || typeof value !== 'object') return DEFAULT_RELEASE_NOTES_PREFERENCES;
  const record = value as Record<string, unknown>;
  return {
    lastSeenVersion: typeof record.lastSeenVersion === 'string' ? record.lastSeenVersion : null,
  };
}

function parseFolderDefaults(value: unknown): FolderDefaultPreferences {
  if (!value || typeof value !== 'object') return DEFAULT_FOLDER_DEFAULT_PREFERENCES;
  const record = value as Record<string, unknown>;
  const pages: Record<string, string> = {};
  if (record.pages && typeof record.pages === 'object' && !Array.isArray(record.pages)) {
    for (const [pageKey, folderId] of Object.entries(record.pages)) {
      if (typeof folderId === 'string' && folderId) pages[pageKey] = folderId;
    }
  }
  return {
    global: typeof record.global === 'string' && record.global ? record.global : null,
    pages,
  };
}

/** The folder a new note on `pageKey` should start in: the page's own
 *  default, else the global one, else none. A default naming a folder that
 *  no longer exists is skipped rather than returned — so a stale page
 *  default falls through to the global one instead of hiding it. */
export function resolveDefaultFolderId(
  defaults: FolderDefaultPreferences,
  pageKey: string,
  existingFolderIds: ReadonlySet<string>,
): string | null {
  const pageDefault = Object.prototype.hasOwnProperty.call(defaults.pages, pageKey)
    ? defaults.pages[pageKey]
    : null;
  if (pageDefault && existingFolderIds.has(pageDefault)) return pageDefault;
  if (defaults.global && existingFolderIds.has(defaults.global)) return defaults.global;
  return null;
}

/** Sets (or, with `null`, clears) one page's default — every other page's,
 *  and the global default, are carried over untouched. */
export function withPageDefaultFolder(
  defaults: FolderDefaultPreferences,
  pageKey: string,
  folderId: string | null,
): FolderDefaultPreferences {
  const pages = { ...defaults.pages };
  if (folderId) pages[pageKey] = folderId;
  else delete pages[pageKey];
  return { ...defaults, pages };
}

/** Sets (or, with `null`, clears) the global default, leaving every page's
 *  own default in place. */
export function withGlobalDefaultFolder(
  defaults: FolderDefaultPreferences,
  folderId: string | null,
): FolderDefaultPreferences {
  return { ...defaults, global: folderId };
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
    releaseNotes: parseReleaseNotes(record.releaseNotes),
    folderDefaults: parseFolderDefaults(record.folderDefaults),
  };
}
