import type { ContinueWebsite } from '@/domain/notes-grouping';
import { isPlainLeftClick, openNoteAndRestore } from '@/entrypoints/notes/openNote';
import { Favicon } from '../Favicon';
import { relativeTime } from '../format';
import { stagger } from '../kit/motion';
import type { Lang, Strings } from '../i18n';

interface ContinueSectionProps {
  websites: ContinueWebsite[];
  strings: Strings;
  lang: Lang;
}

/**
 * "Continue" — the few sites the reader most recently left notes on, so they
 * can pick a train of thought back up without scanning the whole Library.
 * Derived from the notes' own timestamps, not from browsing history. Nothing at
 * all when there are no notes yet.
 *
 * Each is a real `<a target="_blank">` to that site's most recently edited note
 * — right-click, ctrl-click and middle-click work natively — and a plain
 * left-click restores the note there once the tab is ready.
 */
export function ContinueSection({ websites, strings, lang }: ContinueSectionProps) {
  if (websites.length === 0) return null;
  return (
    <section className="hm-library-section hm-continue" aria-label={strings.continueSection}>
      <h2 className="hm-overline hm-library-section__title">{strings.continueSection}</h2>
      <ul className="hm-continue__list">
        {websites.map((site, i) => (
          <li key={site.domain}>
            <a
              className="hm-continue__item hm-fade-in"
              style={stagger(i)}
              href={site.latestNoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!isPlainLeftClick(e)) return;
                e.preventDefault();
                void openNoteAndRestore(site.latestNoteUrl, site.latestNoteId);
              }}
            >
              <Favicon domain={site.domain} size={20} />
              <span className="hm-continue__text">
                <span className="hm-continue__domain">{site.domain}</span>
                <span className="hm-continue__meta">
                  {strings.notesCount(site.count)} ·{' '}
                  {strings.continueLastActivity(relativeTime(site.lastActivity, lang))}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
