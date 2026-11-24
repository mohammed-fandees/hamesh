import { useId, useState } from 'react';
import type { PreferencesState } from '../hooks/usePreferences';
import type { Lang } from '../i18n';
import { CloseIcon } from '../kit/icons';
import { escapeLayer } from '../kit/keys';
import { MarginMark } from '../kit/MarginMark';
import { getTeamsStrings } from '../teams/strings';
import { formatReport, useTodaysReport, useUsageSharing } from './useUsageSharing';
import './styles';

/** Example counts for a reader who has not agreed: nothing of theirs is counted yet. */
const EXAMPLE = { 'note.created.text': 3, 'library.opened': 5 };

interface UsageBubbleProps {
  lang: Lang;
  preferences: PreferencesState;
  onOpenSettings: () => void;
}

/**
 * The Library's side bubble that asks whether to share usage counts, for a reader who has never
 * answered. It sits in the corner, comes in with one soft pulse each time the Library opens and
 * then keeps still, and opens into the question on a click. "Hide for now" folds it until the
 * Library is next opened; "Don't show this again" is the same answer as "No thanks", which
 * Hamesh never asks past.
 */
export function UsageBubble({ lang, preferences, onOpenSettings }: UsageBubbleProps) {
  const strings = getTeamsStrings(lang);
  const titleId = useId();
  const usage = useUsageSharing(preferences);
  const report = useTodaysReport(lang);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  // Asked only of a reader who had not answered when the page opened; after an answer here, the
  // card stays to say what happens next until it is closed.
  if (preferences.first?.usage.sharing !== 'unasked' || hidden) return null;
  const answered = usage.sharing !== 'unasked';
  const after = usage.sharing === 'on' ? strings.usageAfterYes : strings.usageAfterNo;
  const hide = () => (answered ? setHidden(true) : setOpen(false));

  return (
    <aside className="hm-usage-bubble" aria-label={strings.usageBubble}>
      {open && (
        <div
          className="hm-usage-bubble__card"
          role="dialog"
          aria-labelledby={titleId}
          onKeyDown={escapeLayer(hide)}
        >
          <div className="hm-usage-bubble__head">
            <h2 className="hm-usage-bubble__title" id={titleId}>
              {strings.usageAskTitle}
            </h2>
            <button
              type="button"
              className="hm-icon-btn hm-icon-btn--small"
              aria-label={strings.usageBubbleHide}
              onClick={hide}
            >
              <CloseIcon size={10} />
            </button>
          </div>
          {answered ? (
            <>
              <p
                role="status"
                className={
                  usage.sharing === 'on' ? 'hm-usage-ask__thanks' : 'hm-usage-ask__declined'
                }
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
          ) : (
            <>
              <p className="hm-usage-bubble__body">{strings.usageAskBody}</p>
              <details className="hm-usage-ask__details">
                <summary className="hm-usage__summary">{strings.usageAskSee}</summary>
                {report && (
                  <pre className="hm-usage__report" dir="ltr">
                    {formatReport({ ...report, counts: EXAMPLE }, true)}
                  </pre>
                )}
              </details>
              <div className="hm-usage-bubble__actions">
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
                  {strings.usageNeverShow}
                </button>
              </div>
              <p className="hm-usage-ask__later">{strings.usageAskLater}</p>
            </>
          )}
        </div>
      )}
      <button
        type="button"
        className="hm-usage-bubble__button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <MarginMark size={14} strokeWidth={3.5} />
        <span>{strings.usageBubble}</span>
      </button>
    </aside>
  );
}
