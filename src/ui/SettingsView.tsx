import { useEffect, useRef } from 'react';
import { SettingRow } from './SettingRow';
import { SegmentedControl } from './SegmentedControl';
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
    </div>
  );
}

function LightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path
        d="M7 1.4 V2.6 M7 11.4 V12.6 M1.4 7 H2.6 M11.4 7 H12.6 M3.1 3.1 L4 4 M10 10 L10.9 10.9 M3.1 10.9 L4 10 M10 4 L10.9 3.1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M11.2 8.6A4.6 4.6 0 0 1 5.4 2.8a4.6 4.6 0 1 0 5.8 5.8Z" fill="currentColor" />
    </svg>
  );
}

function MatchWebsiteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path d="M7 1.8 A5.2 5.2 0 0 1 7 12.2 Z" fill="currentColor" />
    </svg>
  );
}
