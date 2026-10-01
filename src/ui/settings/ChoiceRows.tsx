import type { AppearanceMode } from '@/domain/preferences';
import { SegmentedControl } from '../kit/SegmentedControl';
import { SettingRow } from '../kit/SettingRow';
import { DarkIcon, LanguageIcon, LightIcon, MatchWebsiteIcon } from '../kit/icons';
import type { Lang, Strings } from '../i18n';

/**
 * The two choices a reader can make from anywhere Hamesh has a settings screen
 * — the popup's pane and the full Settings page — drawn once, so a choice looks
 * and reads the same wherever it is made.
 */

export function LanguageRow({
  strings,
  lang,
  onChange,
  withIcon = true,
}: {
  strings: Strings;
  lang: Lang;
  onChange: (lang: Lang) => void;
  withIcon?: boolean;
}) {
  return (
    <SettingRow
      label={strings.settingsLanguage}
      icon={withIcon ? <LanguageIcon /> : undefined}
      value={
        <SegmentedControl<Lang>
          value={lang}
          name="hm-language"
          groupLabel={strings.settingsLanguage}
          options={[
            { value: 'en', label: strings.settingsLanguageEnglish },
            { value: 'ar', label: strings.settingsLanguageArabic },
          ]}
          onChange={onChange}
        />
      }
    />
  );
}

/** Three marks rather than three words: three labels, in either language, do
 *  not stay compact in the popup's 252px row, and each keeps its name. */
export function AppearanceRow({
  strings,
  appearance,
  onChange,
  withIcon = true,
}: {
  strings: Strings;
  appearance: AppearanceMode;
  onChange: (appearance: AppearanceMode) => void;
  withIcon?: boolean;
}) {
  return (
    <SettingRow
      label={strings.settingsAppearance}
      icon={withIcon ? <MatchWebsiteIcon /> : undefined}
      value={
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
          onChange={onChange}
        />
      }
    />
  );
}
