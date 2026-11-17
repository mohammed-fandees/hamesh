import { useId } from 'react';
import type { PreferencesState } from '../hooks/usePreferences';
import type { Lang } from '../i18n';
import { getTeamsStrings } from '../teams/strings';
import { formatReport, useTodaysReport, useUsageSharing } from './useUsageSharing';
import './styles';

/** Example counts for a reader who has not agreed: nothing of theirs is counted yet. */
const EXAMPLE = { 'note.created.text': 3, 'library.opened': 5 };

interface UsageAskProps {
  lang: Lang;
  preferences: PreferencesState;
  /** What's New asks current readers; Getting started asks new ones, as an
   *  optional card that is not one of its steps. */
  where: 'whats-new' | 'guide';
  onOpenSettings: () => void;
}

/**
 * Asks, once, whether to share usage counts. Two answers of the same weight,
 * and after either one the card says what happens next and stays until the
 * page is next opened: it is shown only to a reader who had not answered when
 * the page opened.
 */
export function UsageAsk({ lang, preferences, where, onOpenSettings }: UsageAskProps) {
  const strings = getTeamsStrings(lang);
  const titleId = useId();
  const usage = useUsageSharing(preferences);
  const report = useTodaysReport(lang);
  if (preferences.first?.usage.sharing !== 'unasked') return null;

  const after = usage.sharing === 'on' ? strings.usageAfterYes : strings.usageAfterNo;

  return (
    <section className="hm-section hm-usage-ask hm-fade-in" aria-labelledby={titleId}>
      <div className="hm-usage-ask__head">
        <h2 className="hm-section__title" id={titleId}>
          {strings.usageAskTitle}
        </h2>
        {where === 'guide' && <span className="hm-usage-ask__chip">{strings.usageOptional}</span>}
      </div>
      {usage.sharing === 'unasked' ? (
        <>
          <p className="hm-usage-ask__body">{strings.usageAskBody}</p>
          <details className="hm-usage-ask__details">
            <summary className="hm-usage__summary">{strings.usageAskSee}</summary>
            {report && (
              <pre className="hm-usage__report" dir="ltr">
                {formatReport({ ...report, counts: EXAMPLE }, true)}
              </pre>
            )}
          </details>
          <div className="hm-usage-ask__actions">
            <button
              type="button"
              className="hm-btn hm-usage-ask__answer"
              disabled={usage.busy}
              aria-busy={usage.busy || undefined}
              onClick={usage.share}
            >
              {strings.usageAskYes}
            </button>
            <button
              type="button"
              className="hm-btn hm-usage-ask__answer"
              disabled={usage.busy}
              onClick={usage.decline}
            >
              {strings.usageAskNo}
            </button>
            <span className="hm-usage-ask__later">{strings.usageAskLater}</span>
          </div>
        </>
      ) : (
        <>
          <p
            role="status"
            className={usage.sharing === 'on' ? 'hm-usage-ask__thanks' : 'hm-usage-ask__declined'}
          >
            {usage.sharing === 'on' ? strings.usageThanks : strings.usageDeclined}
          </p>
          <p className="hm-usage-ask__later">
            {after.before}
            <button type="button" className="hm-usage-ask__link" onClick={onOpenSettings}>
              {after.link}
            </button>
            {after.after}
          </p>
        </>
      )}
    </section>
  );
}
