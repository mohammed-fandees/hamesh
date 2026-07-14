import { Favicon } from './Favicon';
import { relativeTime } from './i18n';
import type { ContinueWebsite } from '@/domain/notes-grouping';
import type { Lang, Strings } from './i18n';

interface ContinueSectionProps {
  websites: ContinueWebsite[];
  strings: Strings;
  lang: Lang;
}

/**
 * "Continue" — a shortcut to the handful of websites a returning user most
 * recently left notes on, so they can resume a train of thought without
 * scanning the full grouped list. Derived from existing note timestamps, not
 * a browsing-history feature. Renders nothing when there are no notes yet.
 */
export function ContinueSection({ websites, strings, lang }: ContinueSectionProps) {
  if (websites.length === 0) return null;
  return (
    <section className="hm-continue" aria-label={strings.continueSection}>
      <h2 className="hm-continue__title">{strings.continueSection}</h2>
      <ul className="hm-continue__list">
        {websites.map((site) => (
          <li key={site.domain} className="hm-continue__item">
            <Favicon domain={site.domain} size={22} />
            <span className="hm-continue__domain">{site.domain}</span>
            <span className="hm-continue__meta">
              {strings.notesCount(site.count)} ·{' '}
              {strings.continueLastActivity(relativeTime(site.lastActivity, lang))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
