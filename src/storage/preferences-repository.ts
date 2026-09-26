import type {
  AppearanceMode,
  FolderDefaultPreferences,
  Preferences,
  SupportedLanguage,
  TextNotePreferences,
} from '@/domain/preferences';
import {
  parsePreferences,
  withGlobalDefaultFolder,
  withPageDefaultFolder,
} from '@/domain/preferences';

const STORAGE_KEY = 'local:hamesh:preferences';

export interface PreferencesRepository {
  get(): Promise<Preferences>;
  setLanguage(language: SupportedLanguage | null): Promise<Preferences>;
  setAppearance(appearance: AppearanceMode): Promise<Preferences>;
  /** Patches the contextual-text-note settings, leaving the rest of the
   *  nested object (and the rest of `Preferences`) alone. One setter for the
   *  group rather than one per flag — the group is the unit that grows. */
  setTextNotes(patch: Partial<TextNotePreferences>): Promise<Preferences>;
  /** Records that the user has now read What's New up to `version`. */
  setLastSeenReleaseVersion(version: string): Promise<Preferences>;
  /** Sets (or, with `null`, clears) the default folder for one page. */
  setPageDefaultFolder(pageKey: string, folderId: string | null): Promise<Preferences>;
  /** Sets (or, with `null`, clears) the default folder for every page that
   *  has none of its own. */
  setGlobalDefaultFolder(folderId: string | null): Promise<Preferences>;
  /** Fires on changes from any extension context — popup, other tabs' content
   *  scripts, background — backed by `chrome.storage.onChanged`. Lets open
   *  tabs pick up a preference change made elsewhere without extra messaging. */
  watch(cb: (prefs: Preferences) => void): () => void;
}

async function saveFolderDefaults(
  current: Preferences,
  folderDefaults: FolderDefaultPreferences,
): Promise<Preferences> {
  const next: Preferences = { ...current, folderDefaults };
  await storage.setItem(STORAGE_KEY, next);
  return next;
}

export function createPreferencesRepository(): PreferencesRepository {
  return {
    async get(): Promise<Preferences> {
      const data = await storage.getItem<unknown>(STORAGE_KEY);
      return parsePreferences(data);
    },

    async setLanguage(language: SupportedLanguage | null): Promise<Preferences> {
      const current = await this.get();
      const next: Preferences = { ...current, language };
      await storage.setItem(STORAGE_KEY, next);
      return next;
    },

    async setAppearance(appearance: AppearanceMode): Promise<Preferences> {
      const current = await this.get();
      const next: Preferences = { ...current, appearance };
      await storage.setItem(STORAGE_KEY, next);
      return next;
    },

    async setTextNotes(patch: Partial<TextNotePreferences>): Promise<Preferences> {
      const current = await this.get();
      const next: Preferences = { ...current, textNotes: { ...current.textNotes, ...patch } };
      await storage.setItem(STORAGE_KEY, next);
      return next;
    },

    async setLastSeenReleaseVersion(version: string): Promise<Preferences> {
      const current = await this.get();
      const next: Preferences = { ...current, releaseNotes: { lastSeenVersion: version } };
      await storage.setItem(STORAGE_KEY, next);
      return next;
    },

    async setPageDefaultFolder(pageKey: string, folderId: string | null): Promise<Preferences> {
      const current = await this.get();
      return saveFolderDefaults(
        current,
        withPageDefaultFolder(current.folderDefaults, pageKey, folderId),
      );
    },

    async setGlobalDefaultFolder(folderId: string | null): Promise<Preferences> {
      const current = await this.get();
      return saveFolderDefaults(current, withGlobalDefaultFolder(current.folderDefaults, folderId));
    },

    watch(cb: (prefs: Preferences) => void): () => void {
      return storage.watch<unknown>(STORAGE_KEY, (newValue) => {
        cb(parsePreferences(newValue));
      });
    },
  };
}
