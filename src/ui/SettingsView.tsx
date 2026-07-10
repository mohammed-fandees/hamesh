import { useEffect, useRef } from 'react';
import { SettingRow } from './SettingRow';
import type { Lang, Strings } from './i18n';

interface SettingsViewProps {
  strings: Strings;
  lang: Lang;
  dir: 'rtl' | 'ltr';
  /** True while this is the visible pane. Mounted for the whole popup lifetime
   *  (both panes must coexist for the slide transition), so focus is driven by
   *  this flag transitioning to `true` rather than by component mount. */
  active: boolean;
  onBack: () => void;
  onLanguageChange: (lang: Lang) => void;
}

/**
 * The Settings screen. Language is a live segmented choice (the compact
 * two-option case a dropdown would be overkill for); Appearance stays a
 * read-only row showing today's fixed value ("Match website") — Phase 3
 * makes it interactive.
 */
export function SettingsView({
  strings,
  lang,
  dir,
  active,
  onBack,
  onLanguageChange,
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
            <LanguageControl
              lang={lang}
              groupLabel={strings.settingsLanguage}
              englishLabel={strings.settingsLanguageEnglish}
              arabicLabel={strings.settingsLanguageArabic}
              onChange={onLanguageChange}
            />
          }
        />
        <SettingRow label={strings.settingsAppearance} value={strings.settingsMatchWebsite} />
      </div>
    </div>
  );
}

interface LanguageControlProps {
  lang: Lang;
  groupLabel: string;
  englishLabel: string;
  arabicLabel: string;
  onChange: (lang: Lang) => void;
}

/**
 * A two-option segmented control backed by native radio inputs — real radio
 * semantics (grouped Tab stop, arrow-key switching) come for free, styled to
 * match Hamesh rather than the browser's default radio appearance.
 */
function LanguageControl({
  lang,
  groupLabel,
  englishLabel,
  arabicLabel,
  onChange,
}: LanguageControlProps) {
  const options: { value: Lang; label: string }[] = [
    { value: 'en', label: englishLabel },
    { value: 'ar', label: arabicLabel },
  ];
  return (
    <div className="hm-segmented" role="radiogroup" aria-label={groupLabel}>
      {options.map((opt) => (
        <label key={opt.value} className="hm-segmented__option">
          <input
            type="radio"
            name="hm-language"
            value={opt.value}
            checked={lang === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
