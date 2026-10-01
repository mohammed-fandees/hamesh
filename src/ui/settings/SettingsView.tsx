import { useEffect, useRef } from 'react';
import type { AppearanceMode } from '@/domain/preferences';
import { ChevronIcon } from '../kit/icons';
import type { Lang, Strings } from '../i18n';
import { AppearanceRow, LanguageRow } from './ChoiceRows';

interface SettingsViewProps {
  strings: Strings;
  lang: Lang;
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
 * The popup's Settings pane: the two choices worth making in a hurry —
 * language and appearance, the same rows the full page has — and the way to
 * everything else.
 */
export function SettingsView({
  strings,
  lang,
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
    <div className="hm-popup-settings" role="region" aria-label={strings.settings}>
      <div className="hm-popup-settings__header">
        <button
          type="button"
          className="hm-icon-btn"
          aria-label={strings.settingsBack}
          onClick={onBack}
        >
          <ChevronIcon direction="back" size={16} />
        </button>
        <h2 ref={headingRef} className="hm-popup-settings__title" tabIndex={-1}>
          {strings.settings}
        </h2>
      </div>

      <div className="hm-settings__body hm-popup-settings__body">
        <LanguageRow strings={strings} lang={lang} onChange={onLanguageChange} withIcon={false} />
        <AppearanceRow
          strings={strings}
          appearance={appearance}
          onChange={onAppearanceChange}
          withIcon={false}
        />
      </div>

      <button type="button" className="hm-popup__link" onClick={onOpenFullSettings}>
        {strings.settingsOpenFull}
        <ChevronIcon direction="forward" />
      </button>
    </div>
  );
}
