import { useCallback, useEffect, useState } from 'react';
import type { PreferencesRepository } from '@/storage/preferences-repository';
import {
  withGlobalDefaultFolder,
  withPageDefaultFolder,
  type AppearanceMode,
  type Preferences,
  type TextNotePreferences,
  type Theme,
} from '@/domain/preferences';
import type { Lang } from '../i18n';

/**
 * The reader's preferences, kept live on any surface — the popup, the Library,
 * a web page.
 *
 * Loaded once and then followed through `watch` (backed by
 * `chrome.storage.onChanged`, which reaches every extension context), so a
 * choice made anywhere shows everywhere without messaging. A choice made here
 * shows at once, before storage has answered, and the watch then confirms it.
 *
 * `first` is the preferences as they stood when this surface opened. What's New
 * reads "what had the reader seen" from it rather than from the live value,
 * which the page itself updates on arrival — mirroring that back would clear
 * the "new" marks while they are being read.
 */
export interface PreferencesState {
  /** `null` until storage has answered. */
  prefs: Preferences | null;
  first: Preferences | null;
  setLanguage: (lang: Lang) => void;
  setAppearance: (appearance: AppearanceMode) => void;
  setTextNotes: (patch: Partial<TextNotePreferences>) => void;
  /** Sets (or, with `null`, clears) one page's default folder; `false` if the
   *  write failed, in which case what storage really holds is put back. */
  setPageDefaultFolder: (pageKey: string, folderId: string | null) => Promise<boolean>;
  /** The same, for the default on every page. */
  setGlobalDefaultFolder: (folderId: string | null) => Promise<boolean>;
}

export function usePreferences(repo: PreferencesRepository): PreferencesState {
  const [state, setState] = useState<{ first: Preferences; prefs: Preferences } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const prefs = await repo.get();
      if (!cancelled) setState((s) => s ?? { first: prefs, prefs });
    })();
    const unwatch = repo.watch((prefs) => setState((s) => ({ first: s?.first ?? prefs, prefs })));
    return () => {
      cancelled = true;
      unwatch();
    };
  }, [repo]);

  const patch = useCallback((change: (prefs: Preferences) => Preferences) => {
    setState((s) => (s ? { ...s, prefs: change(s.prefs) } : s));
  }, []);

  /**
   * Applies a change here first — the control it came from is controlled by
   * these values and would otherwise spring back until storage answers — then
   * adopts what was actually written. A failed write puts back what storage
   * really holds.
   */
  const persist = useCallback(
    async (change: (prefs: Preferences) => Preferences, write: () => Promise<Preferences>) => {
      patch(change);
      try {
        const written = await write();
        setState((s) => (s ? { ...s, prefs: written } : s));
        return true;
      } catch {
        const stored = await repo.get().catch(() => null);
        if (stored) setState((s) => (s ? { ...s, prefs: stored } : s));
        return false;
      }
    },
    [patch, repo],
  );

  return {
    prefs: state?.prefs ?? null,
    first: state?.first ?? null,
    setLanguage: useCallback(
      (language) => {
        patch((p) => ({ ...p, language }));
        void repo.setLanguage(language);
      },
      [patch, repo],
    ),
    setAppearance: useCallback(
      (appearance) => {
        patch((p) => ({ ...p, appearance }));
        void repo.setAppearance(appearance);
      },
      [patch, repo],
    ),
    setTextNotes: useCallback(
      (change) => {
        patch((p) => ({ ...p, textNotes: { ...p.textNotes, ...change } }));
        void repo.setTextNotes(change);
      },
      [patch, repo],
    ),
    setPageDefaultFolder: useCallback(
      (pageKey, folderId) =>
        persist(
          (p) => ({
            ...p,
            folderDefaults: withPageDefaultFolder(p.folderDefaults, pageKey, folderId),
          }),
          () => repo.setPageDefaultFolder(pageKey, folderId),
        ),
      [persist, repo],
    ),
    setGlobalDefaultFolder: useCallback(
      (folderId) =>
        persist(
          (p) => ({ ...p, folderDefaults: withGlobalDefaultFolder(p.folderDefaults, folderId) }),
          () => repo.setGlobalDefaultFolder(folderId),
        ),
      [persist, repo],
    ),
  };
}

/**
 * The system's colour scheme — what "Match website" means on Hamesh's own
 * pages, which have no website to match. Read once: these pages are short-lived.
 */
export function systemTheme(): Theme {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}
