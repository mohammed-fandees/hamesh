import { Favicon } from './Favicon';
import { relativeTime } from './i18n';
import { isPlainLeftClick, openNoteAndRestore } from '@/entrypoints/notes/openNote';
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
 *
 * Each card is a real `<a target="_blank">` to that site's most recently
 * edited note — right-click/ctrl-click/middle-click work natively. A plain
 * left-click drives `openNoteAndRestore` instead, which restores the note
 * (scrolls to it, highlights it, opens it) once the new tab is ready.
 */
export function ContinueSection({ websites, strings, lang }: ContinueSectionProps) {
  if (websites.length === 0) return null;
  return (
    <section className="hm-continue" aria-label={strings.continueSection}>
      <h2 className="hm-continue__title">{strings.continueSection}</h2>
      <ul className="hm-continue__list">
        {websites.map((site, i) => (
          <li key={site.domain}>
            <a
              className="hm-continue__item hm-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
              href={site.latestNoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!isPlainLeftClick(e)) return;
                e.preventDefault();
                void openNoteAndRestore(site.latestNoteUrl, site.latestNoteId);
              }}
            >
              <Favicon domain={site.domain} size={22} />
              <span className="hm-continue__domain">{site.domain}</span>
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
