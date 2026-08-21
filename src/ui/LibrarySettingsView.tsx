import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { SettingRow } from './SettingRow';
import { SegmentedControl } from './SegmentedControl';
import { BackupSection, type BackupHandlers } from './BackupSection';
import {
  AppearanceIcon,
  DarkIcon,
  LanguageIcon,
  LightIcon,
  MatchWebsiteIcon,
  SelectionActionIcon,
  TextNoteIcon,
} from './SettingsIcons';
import { MarginMark } from './MarginMark';
import { PlayIcon } from './PlayIcon';
import type { AppearanceMode, TextNotePreferences } from '@/domain/preferences';
import type { Lang, Strings } from './i18n';

/** On/off rendered through the same segmented control every other choice in
 *  Settings uses, rather than introducing a switch component for two flags. */
type Toggle = 'on' | 'off';

interface LibrarySettingsViewProps {
  strings: Strings;
  lang: Lang;
  appearance: AppearanceMode;
  textNotes: TextNotePreferences;
  onLanguageChange: (lang: Lang) => void;
  onAppearanceChange: (appearance: AppearanceMode) => void;
  onTextNotesChange: (patch: Partial<TextNotePreferences>) => void;
  /** Export/import of every note and folder — see `BackupSection`. Passed in
   *  rather than reached for here, so this view keeps knowing nothing about
   *  storage. */
  backup: BackupHandlers;
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
 *
 * Contextual text notes get their own section here rather than in the
 * popup's compact Settings pane, which is deliberately only Language and
 * Appearance. Turning the feature off stops new contextual notes and hides
 * highlights; it never deletes a note or its anchor, and everything comes
 * back when it's turned on again.
 */
export function LibrarySettingsView({
  strings,
  lang,
  appearance,
  textNotes,
  onLanguageChange,
  onAppearanceChange,
  onTextNotesChange,
  backup,
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
            icon={<LanguageIcon />}
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
            icon={<AppearanceIcon />}
            value={
              // Same icon options as the popup's Settings pane, so a choice
              // looks identical wherever it's made.
              <SegmentedControl<AppearanceMode>
                value={appearance}
                name="hm-appearance"
                groupLabel={strings.settingsAppearance}
                options={[
                  {
                    value: 'match-website',
                    label: strings.settingsMatchWebsite,
                    icon: <MatchWebsiteIcon />,
                  },
                  { value: 'light', label: strings.settingsAppearanceLight, icon: <LightIcon /> },
                  { value: 'dark', label: strings.settingsAppearanceDark, icon: <DarkIcon /> },
                ]}
                onChange={onAppearanceChange}
              />
            }
          />
        </div>

        <h2 className="hm-settings__subheading">{strings.settingsTextNotes}</h2>
        <div className="hm-settings__body">
          <SettingRow
            label={strings.settingsTextNotesEnabled}
            icon={<TextNoteIcon />}
            value={
              <SegmentedControl<Toggle>
                value={textNotes.enabled ? 'on' : 'off'}
                name="hm-text-notes-enabled"
                groupLabel={strings.settingsTextNotesEnabled}
                options={[
                  { value: 'on', label: strings.settingsOn },
                  { value: 'off', label: strings.settingsOff },
                ]}
                onChange={(next) => onTextNotesChange({ enabled: next === 'on' })}
              />
            }
          />
          <SettingRow
            label={strings.settingsTextSelectionAction}
            icon={<SelectionActionIcon />}
            value={
              <SegmentedControl<Toggle>
                value={textNotes.selectionAction ? 'on' : 'off'}
                name="hm-text-selection-action"
                groupLabel={strings.settingsTextSelectionAction}
                options={[
                  { value: 'on', label: strings.settingsOn },
                  { value: 'off', label: strings.settingsOff },
                ]}
                onChange={(next) => onTextNotesChange({ selectionAction: next === 'on' })}
              />
            }
          />
        </div>

        <h2 className="hm-settings__subheading">{strings.settingsShortcuts}</h2>
        <div className="hm-settings__body">
          <SettingRow
            label={strings.addNote}
            icon={<MarginMark size={13} strokeWidth={4} />}
            value={
              <kbd className="hm-shortcut-badge">
                {commands['activate-hamesh'] || strings.shortcutNotSet}
              </kbd>
            }
          />
          <SettingRow
            label={strings.videoQuickNoteLabel}
            icon={<PlayIcon size={12} />}
            value={
              <kbd className="hm-shortcut-badge">
                {commands['activate-hamesh-video'] || strings.shortcutNotSet}
              </kbd>
            }
          />
          <SettingRow
            label={strings.addTextNote}
            icon={<TextNoteIcon />}
            value={
              <kbd className="hm-shortcut-badge">
                {commands['activate-hamesh-text'] || strings.shortcutNotSet}
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

        <BackupSection strings={strings} handlers={backup} />
      </div>
    </div>
  );
}
