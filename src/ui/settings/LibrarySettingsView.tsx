import { useState } from 'react';
import { browser } from 'wxt/browser';
import type { TeamsClient } from '@/teams/client';
import { MarginMark } from '../kit/MarginMark';
import { Page, PageHeader } from '../kit/Page';
import { Section } from '../kit/Section';
import { SettingRow } from '../kit/SettingRow';
import { Switch } from '../kit/Switch';
import { PlayIcon, SelectionActionIcon, TextNoteIcon } from '../kit/icons';
import type { PreferencesState } from '../hooks/usePreferences';
import { COMMANDS, useShortcuts } from '../hooks/useShortcuts';
import { DevSignIn } from '../teams/DevSignIn';
import { TeamsAccount } from '../teams/TeamsAccount';
import type { Lang, Strings } from '../i18n';
import { BackupSection, type BackupHandlers } from './BackupSection';
import { AppearanceRow, LanguageRow } from './ChoiceRows';
import { TeamsSection } from './TeamsSection';

interface LibrarySettingsViewProps {
  strings: Strings;
  lang: Lang;
  /** The reader's preferences, and how each is changed. */
  preferences: PreferencesState;
  /** Export/import of every note and folder — see `BackupSection`. Passed in
   *  rather than reached for here, so this view knows nothing about storage. */
  backup: BackupHandlers;
  /** Present only in builds that include Teams; the section is absent otherwise. */
  teams?: TeamsClient | null;
  /** Opens the Teams page on a team just joined from here. */
  onOpenTeam?: (teamId: string) => void;
  /** A panel to open and bring into view on arrival — the plan, from "Subscribe". */
  focus?: 'plan' | null;
}

/**
 * The full Settings page — everything the popup's pane has, and what it has no
 * room for: notes on selected text, the keyboard shortcuts, Teams and the
 * account, and backup.
 *
 * Turning notes on selected text off stops new ones and hides their highlights;
 * it never deletes a note or its anchor, and everything is back when it is
 * turned on again.
 *
 * The shortcuts are shown, not set: Chrome gives an extension its bindings to
 * read (`commands.getAll`) and nothing to change them with — the only place
 * they change is Chrome's own shortcuts page, which this links to.
 */
export function LibrarySettingsView({
  strings,
  lang,
  preferences,
  backup,
  teams,
  onOpenTeam,
  focus = null,
}: LibrarySettingsViewProps) {
  const shortcuts = useShortcuts();
  /** Bumped by a dev sign-in, to remount the Teams card on the new account. */
  const [devSignedIn, setDevSignedIn] = useState(0);
  const { prefs } = preferences;
  const textNotes = prefs?.textNotes;
  const binding = (name: (typeof COMMANDS)[keyof typeof COMMANDS]) => (
    <kbd className="hm-kbd">{shortcuts[name] || strings.shortcutNotSet}</kbd>
  );

  return (
    <Page>
      <PageHeader title={strings.settings} />

      <Section label={strings.settings}>
        <div className="hm-settings__body">
          <LanguageRow strings={strings} lang={lang} onChange={preferences.setLanguage} />
          <AppearanceRow
            strings={strings}
            appearance={prefs?.appearance ?? 'match-website'}
            onChange={preferences.setAppearance}
          />
        </div>
      </Section>

      <Section title={strings.settingsTextNotes}>
        <div className="hm-settings__body">
          <SettingRow
            label={strings.settingsTextNotesEnabled}
            icon={<TextNoteIcon />}
            value={
              <Switch
                label={strings.settingsTextNotesEnabled}
                checked={textNotes?.enabled ?? true}
                onChange={(enabled) => preferences.setTextNotes({ enabled })}
              />
            }
          />
          <SettingRow
            label={strings.settingsTextSelectionAction}
            icon={<SelectionActionIcon />}
            value={
              <Switch
                label={strings.settingsTextSelectionAction}
                checked={textNotes?.selectionAction ?? true}
                onChange={(selectionAction) => preferences.setTextNotes({ selectionAction })}
              />
            }
          />
        </div>
      </Section>

      <Section title={strings.settingsShortcuts}>
        <div className="hm-settings__body">
          <SettingRow
            label={strings.addNote}
            icon={<MarginMark size={13} strokeWidth={4} />}
            value={binding(COMMANDS.addNote)}
          />
          <SettingRow
            label={strings.videoQuickNoteLabel}
            icon={<PlayIcon size={12} />}
            value={binding(COMMANDS.addVideoNote)}
          />
          <SettingRow
            label={strings.addTextNote}
            icon={<TextNoteIcon />}
            value={binding(COMMANDS.addTextNote)}
          />
        </div>
        <button
          type="button"
          className="hm-link hm-link--accent hm-section__after"
          onClick={() => void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}
        >
          {strings.shortcutOpenChromeSettings}
        </button>
      </Section>

      {/* The build-time constant as well as the client: with it folded away,
          a build without Teams drops this section and its stylesheet too. */}
      {import.meta.env.WXT_TEAMS_API_ORIGIN && teams && (
        <>
          {/* Remounted after a dev sign-in, so it reads the new account. */}
          <TeamsSection lang={lang} client={teams} key={devSignedIn} />
          {/* Only a build that asked for it; the constant folds away in every
              other one, and this component goes with it. */}
          {__HAMESH_DEV_SIGN_IN__ && (
            <DevSignIn lang={lang} client={teams} onSignedIn={() => setDevSignedIn((n) => n + 1)} />
          )}
          {/* Joining a team and paying for one belong to the account, which
              is here — not to any one team's page. */}
          <TeamsAccount
            lang={lang}
            client={teams}
            revealPlan={focus === 'plan'}
            onJoined={(id) => onOpenTeam?.(id)}
          />
        </>
      )}

      <BackupSection strings={strings} handlers={backup} />
    </Page>
  );
}
