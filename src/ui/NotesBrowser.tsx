import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { Note } from '@/domain/note';
import { groupNotesByWebsite } from '@/domain/note-grouping';
import type { Lang, Strings } from './i18n';
import { relativeTime } from './i18n';
import { linkify } from './linkify';

interface NotesBrowserProps {
  notes: Note[];
  strings: Strings;
  lang: Lang;
  active: boolean;
  onBack: () => void;
}

export function NotesBrowser({ notes, strings, lang, active, onBack }: NotesBrowserProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const groups = useMemo(() => groupNotesByWebsite(notes), [notes]);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.websiteKey)),
  );

  useEffect(() => {
    if (active) headingRef.current?.focus({ preventScroll: true });
  }, [active]);

  const toggleWebsite = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a.hm-link-url') as HTMLAnchorElement | null;
    if (anchor?.href) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Opening link via tabs.create:', anchor.href);
      void browser.tabs.create({ url: anchor.href, active: true });
    }
  }, []);

  return (
    <div className="hm-notes-browser" role="region" aria-label={strings.notesBrowser} onClick={handleLinkClick}>
      <div className="hm-settings__header">
        <button type="button" className="hm-icon-btn" aria-label={strings.settingsBack} onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
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
          {strings.notesBrowser}
        </h2>
      </div>

      <div className="hm-notes-browser__summary">
        <span>{strings.notesBrowserSummary(groups.length, notes.length)}</span>
      </div>

      {groups.length === 0 ? (
        <div className="hm-notes-browser__empty">
          <strong>{strings.noSavedNotes}</strong>
          <span>{strings.noSavedNotesHint}</span>
        </div>
      ) : (
        <div className="hm-notes-browser__list">
          {groups.map((website) => {
            const isCollapsed = collapsed.has(website.websiteKey);
            return (
              <section key={website.websiteKey} className="hm-notes-browser__website">
                <button
                  type="button"
                  className="hm-notes-browser__website-head"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleWebsite(website.websiteKey)}
                >
                  <svg
                    className={`hm-notes-browser__chevron${isCollapsed ? ' hm-notes-browser__chevron--collapsed' : ''}`}
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 2 L8 6 L4 10"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  <h3 className="hm-notes-browser__website-title" dir="auto">
                    {website.websiteLabel}
                  </h3>
                  <span className="hm-notes-browser__count">
                    {strings.websiteNotesCount(website.noteCount)}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="hm-notes-browser__pages">
                    {website.pages.map((page) => (
                      <article key={page.pageKey} className="hm-notes-browser__page">
                        <div className="hm-notes-browser__page-head">
                          <h4 className="hm-notes-browser__page-title" dir="auto">
                            <a href={page.pageKey} className="hm-link-url" style={{ color: 'inherit', textDecoration: 'none' }}>
                              {page.pageLabel}
                            </a>
                          </h4>
                          <span className="hm-notes-browser__count">
                            {strings.pageNotesCount(page.noteCount)}
                          </span>
                        </div>
                        <p className="hm-notes-browser__page-meta">
                          {strings.editedAgo(relativeTime(page.latestUpdatedAt, lang))}
                        </p>

                        <ul className="hm-notes-browser__notes" aria-label={page.pageLabel}>
                          {page.notes.map((note) => (
                            <li key={note.id} className="hm-notes-browser__note" dir="auto">
                              <span className="hm-notes-browser__note-body">{linkify(note.content)}</span>
                              <span className="hm-notes-browser__note-meta">
                                {strings.editedAgo(relativeTime(note.updatedAt, lang))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
