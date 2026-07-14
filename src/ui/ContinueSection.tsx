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
 * "Continue" — the page's primary entry point for a returning user: a
 * shortcut to resume the train of thought behind their most recently edited
 * notes, not just a list of recently visited sites. Each row leads with the
 * note's own text (the thing being resumed), with the website as a small
 * kicker above it — deliberately light on chrome, reading more like a
 * "continue reading" list than a dashboard widget. Derived from existing
 * note timestamps, not a browsing-history feature. Renders nothing when
 * there are no notes yet.
 *
 * Each card is a plain `<a target="_blank">` to that site's most recently
 * edited note — no `browser.tabs` call, no new permission. Same PR1/PR2
 * split as NoteRow: this establishes the interaction model now, the full
 * restore experience is PR2.
 */
export function ContinueSection({ websites, strings, lang }: ContinueSectionProps) {
  if (websites.length === 0) return null;
  return (
    <section className="hm-continue" aria-label={strings.continueSection}>
      <h2 className="hm-continue__title">{strings.continueSection}</h2>
      <ul className="hm-continue__list">
        {websites.map((site) => (
          <li key={site.domain}>
            <a
              className="hm-continue__item"
              href={site.latestNoteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="hm-continue__kicker">
                <Favicon domain={site.domain} size={14} />
                {site.domain}
              </span>
              <p className="hm-continue__preview" dir="auto">
                {site.latestNotePreview}
              </p>
              <span className="hm-continue__meta">
                {strings.notesCount(site.count)} ·{' '}
                {strings.continueLastActivity(relativeTime(site.lastActivity, lang))}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
