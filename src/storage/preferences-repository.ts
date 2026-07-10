import type { Preferences, SupportedLanguage } from '@/domain/preferences';
import { parsePreferences } from '@/domain/preferences';

const STORAGE_KEY = 'local:hamesh:preferences';

export interface PreferencesRepository {
  get(): Promise<Preferences>;
  setLanguage(language: SupportedLanguage | null): Promise<Preferences>;
  /** Fires on changes from any extension context — popup, other tabs' content
   *  scripts, background — backed by `chrome.storage.onChanged`. Lets open
   *  tabs pick up a language change made elsewhere without extra messaging. */
  watch(cb: (prefs: Preferences) => void): () => void;
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

    watch(cb: (prefs: Preferences) => void): () => void {
      return storage.watch<unknown>(STORAGE_KEY, (newValue) => {
        cb(parsePreferences(newValue));
      });
    },
  };
}
