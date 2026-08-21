import { useEffect, useRef } from 'react';
import { SettingRow } from './SettingRow';
import { SegmentedControl } from './SegmentedControl';
import { DarkIcon, LightIcon, MatchWebsiteIcon } from './SettingsIcons';
import type { AppearanceMode } from '@/domain/preferences';
import type { Lang, Strings } from './i18n';

interface SettingsViewProps {
  strings: Strings;
  lang: Lang;
  dir: 'rtl' | 'ltr';
  appearance: AppearanceMode;
  /** True while this is the visible pane. Mounted for the whole popup lifetime
   *  (both panes must coexist for the slide transition), so focus is driven by
   *  this flag transitioning to `true` rather than by component mount. */
  active: boolean;
  onBack: () => void;
  onLanguageChange: (lang: Lang) => void;
  onAppearanceChange: (appearance: AppearanceMode) => void;
  /** Opens the Notes Library's full-page Settings view (Shortcuts section,
   *  etc.) — this popup pane only has room for Language/Appearance. */
  onOpenFullSettings: () => void;
}

/**
 * The Settings screen. Language and Appearance are both live segmented
 * choices — the compact few-option case a dropdown would be overkill for.
 */
export function SettingsView({
  strings,
  lang,
  dir,
  appearance,
  active,
  onBack,
  onLanguageChange,
  onAppearanceChange,
  onOpenFullSettings,
}: SettingsViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Announces the view to assistive tech on each navigation into Settings.
  // `preventScroll` matters here: the two panes sit side by side in a wide
  // flex track clipped by an `overflow:hidden` viewport, which is still a
  // programmatic scroll container. Without it, focusing the heading before
  // the slide transition completes makes the browser auto-scroll that
  // viewport to reveal it, desyncing scroll position from the CSS transform.
  useEffect(() => {
    if (active) headingRef.current?.focus({ preventScroll: true });
  }, [active]);

  return (
    <div className="hm-settings" role="region" aria-label={strings.settings}>
      <div className="hm-settings__header">
        <button
          type="button"
          className="hm-icon-btn"
          aria-label={strings.settingsBack}
          onClick={onBack}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden="true"
            style={dir === 'rtl' ? { transform: 'scaleX(-1)' } : undefined}
          >
            <path
              d="M10 3 L5 8 L10 13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </button>
        <h2 ref={headingRef} className="hm-settings__title" tabIndex={-1}>
          {strings.settings}
        </h2>
      </div>

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

      <button type="button" className="hm-popup__library-link" onClick={onOpenFullSettings}>
        {strings.settingsOpenFull}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
          style={dir === 'rtl' ? { transform: 'scaleX(-1)' } : undefined}
        >
          <path
            d="M3 2 L7 5 L3 8"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </button>
    </div>
  );
}
