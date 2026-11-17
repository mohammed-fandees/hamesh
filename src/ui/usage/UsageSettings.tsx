import { useState } from 'react';
import { Section } from '../kit/Section';
import { Switch } from '../kit/Switch';
import { UsageIcon } from '../kit/icons';
import type { PreferencesState } from '../hooks/usePreferences';
import type { Lang } from '../i18n';
import { getTeamsStrings } from '../teams/strings';
import { PRIVACY_URL } from './privacy';
import { formatReport, useTodaysReport, useUsageSharing } from './useUsageSharing';
import './styles';

/**
 * Settings → Help improve Hamesh: the one switch for usage counts, and the
 * exact report this device would send today, built from its real counts.
 *
 * Off unless the reader turns it on. Turning it off deletes the counts kept here
 * at once and says so.
 */
export function UsageSettings({
  lang,
  preferences,
}: {
  lang: Lang;
  preferences: PreferencesState;
}) {
  const strings = getTeamsStrings(lang);
  const usage = useUsageSharing(preferences);
  const report = useTodaysReport(lang);
  const [turnedOff, setTurnedOff] = useState(false);
  const on = usage.sharing === 'on';

  const change = (checked: boolean) => {
    if (checked) {
      setTurnedOff(false);
      usage.share();
    } else {
      usage.stop();
      setTurnedOff(true);
    }
  };

  return (
    <Section title={strings.usageTitle}>
      <div className="hm-usage">
        <UsageIcon size={16} className="hm-usage__icon" />
        <div className="hm-usage__text">
          <span className="hm-usage__label">{strings.usageSwitch}</span>
          {turnedOff && !on ? (
            <p role="status" className="hm-usage__status">
              {strings.usageTurnedOff}
            </p>
          ) : (
            <p className="hm-usage__hint">{strings.usageHint}</p>
          )}
        </div>
        <Switch label={strings.usageSwitch} checked={on} disabled={usage.busy} onChange={change} />
      </div>
      <details className="hm-usage__details">
        <summary className="hm-usage__summary">{strings.usageSeeShared}</summary>
        <div className="hm-usage__shared">
          <p className="hm-usage__intro">
            {on ? strings.usageSharedIntro : strings.usageSharedIntroOff}
          </p>
          {report && (
            <pre className="hm-usage__report" dir="ltr">
              {formatReport(report)}
            </pre>
          )}
          <p className="hm-usage__foot">
            {strings.usageSharedFoot}{' '}
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
              {strings.usagePrivacyLink}
            </a>
          </p>
        </div>
      </details>
    </Section>
  );
}
