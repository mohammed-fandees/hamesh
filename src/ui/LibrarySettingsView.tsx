import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { SettingRow } from './SettingRow';
import { SegmentedControl } from './SegmentedControl';
import type { AppearanceMode } from '@/domain/preferences';
import type { Lang, Strings } from './i18n';

interface LibrarySettingsViewProps {
  strings: Strings;
  lang: Lang;
  appearance: AppearanceMode;
  onLanguageChange: (lang: Lang) => void;
  onAppearanceChange: (appearance: AppearanceMode) => void;
}

/**
 * The Notes Library's full-page Settings view — language and appearance
 * mirror the popup's own SettingsView (same controls, same persisted
 * preferences), plus a Shortcuts section. Chrome extensions have no API to
 * change their own keyboard shortcut (`chrome.commands` exposes only
 * `getAll`/`onCommand` — `update`/`reset` are a Firefox-only WebExtensions
 * addition), so this reads the current bindings for display and links out
 * to `chrome://extensions/shortcuts`, the only place they can actually be
 * changed.
 */
export function LibrarySettingsView({
  strings,
  lang,
  appearance,
  onLanguageChange,
  onAppearanceChange,
}: LibrarySettingsViewProps) {
  const [commands, setCommands] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    browser.commands
      ?.getAll()
      .then((list) => {
        if (cancelled) return;
        const next: Record<string, string | null> = {};
        for (const c of list) {
          if (c.name) next[c.name] = c.shortcut || null;
        }
        setCommands(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function openChromeShortcutSettings() {
    browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
  }

  return (
    <div className="hm-notes-main">
      <div className="hm-notes-page__inner">
        <header className="hm-notes-page__header">
          <h1 className="hm-notes-page__title">{strings.settings}</h1>
        </header>

        <div className="hm-settings__body">
          <SettingRow
            label={strings.settingsLanguage}
            value={
              <SegmentedControl<Lang>
                value={lang}
                name="hm-language"
                groupLabel={strings.settingsLanguage}
                options={[
                  { value: 'en', label: strings.settingsLanguageEnglish },
                  { value: 'ar', label: strings.settingsLanguageArabic },
                ]}
                onChange={onLanguageChange}
              />
            }
          />
          <SettingRow
            label={strings.settingsAppearance}
            value={
              <SegmentedControl<AppearanceMode>
                value={appearance}
                name="hm-appearance"
                groupLabel={strings.settingsAppearance}
                options={[
                  { value: 'match-website', label: strings.settingsMatchWebsite },
                  { value: 'light', label: strings.settingsAppearanceLight },
                  { value: 'dark', label: strings.settingsAppearanceDark },
                ]}
                onChange={onAppearanceChange}
              />
            }
          />
        </div>

        <h2 className="hm-settings__subheading">{strings.settingsShortcuts}</h2>
        <div className="hm-settings__body">
          <SettingRow
            label={strings.addNote}
            value={
              <kbd className="hm-shortcut-badge">
                {commands['activate-hamesh'] || strings.shortcutNotSet}
              </kbd>
            }
          />
          <SettingRow
            label={strings.videoQuickNoteLabel}
            value={
              <kbd className="hm-shortcut-badge">
                {commands['activate-hamesh-video'] || strings.shortcutNotSet}
              </kbd>
            }
          />
        </div>
        <button
          type="button"
          className="hm-link"
          style={{ marginTop: 'var(--hm-space-3)' }}
          onClick={openChromeShortcutSettings}
        >
          {strings.shortcutOpenChromeSettings}
        </button>
      </div>
    </div>
  );
}
