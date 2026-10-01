import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../i18n';
import { getTeamsStrings } from './strings';
import css from './consent.css?inline';

/** Where the policy this explains lives. Public, and the same for every build. */
const PRIVACY_URL = 'https://hamesh.fandees.tech/privacy.html';

interface ShareConsentProps {
  lang: Lang;
  /** The team a note is about to be shared with. */
  teamName: string;
  /** The reader's answer: whether to share, and whether to ask again. */
  onAnswer: (share: boolean, dontAskAgain: boolean) => void;
}

/**
 * Asked before a note leaves this device for a team.
 *
 * Everything else in Hamesh asks its questions inline, beside the thing they
 * are about. This one is a dialog on purpose: it is consent to personal data
 * being uploaded and moved abroad, and the law wants that informed and
 * explicit, not a line the reader can scroll past. It says what goes up, who
 * sees it, where it is kept and how to take it back, links the policy, and
 * lets the reader stop being asked.
 *
 * The browser's own modal dialog: it traps focus, Escape cancels, and focus
 * returns to where it was when it closes.
 */
export function ShareConsent({ lang, teamName, onAnswer }: ShareConsentProps) {
  const strings = getTeamsStrings(lang);
  const ref = useRef<HTMLDialogElement>(null);
  const [dontAsk, setDontAsk] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="hm-consent"
      aria-labelledby="hm-consent-title"
      onCancel={(e) => {
        e.preventDefault();
        onAnswer(false, false);
      }}
    >
      <style>{css}</style>
      <h2 id="hm-consent-title" className="hm-consent__title">
        {strings.consentTitle(teamName)}
      </h2>
      <p className="hm-consent__intro">{strings.consentIntro}</p>
      <ul className="hm-consent__facts">
        <li>{strings.consentWhat}</li>
        <li>{strings.consentWho(teamName)}</li>
        <li>{strings.consentWhere}</li>
        <li>{strings.consentUndo}</li>
      </ul>
      <a
        className="hm-link hm-link--accent"
        href={PRIVACY_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        {strings.consentPrivacy}
      </a>
      <label className="hm-consent__again">
        <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} />
        {strings.consentDontAsk}
      </label>
      <div className="hm-row hm-consent__answers">
        {/* The cautious answer takes focus, so a stray Enter shares nothing. */}
        <button
          type="button"
          className="hm-btn hm-btn-ghost"
          autoFocus
          onClick={() => onAnswer(false, false)}
        >
          {strings.cancel}
        </button>
        <button
          type="button"
          className="hm-btn hm-btn-primary"
          onClick={() => onAnswer(true, dontAsk)}
        >
          {strings.consentShare}
        </button>
      </div>
    </dialog>
  );
}
