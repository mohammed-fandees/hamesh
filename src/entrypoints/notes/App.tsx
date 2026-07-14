import { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { MarginMark } from '@/ui/MarginMark';
import { WebsiteGroup } from '@/ui/WebsiteGroup';
import { ContinueSection } from '@/ui/ContinueSection';
import { getStrings, resolveLang, dirForLang, type Lang } from '@/ui/i18n';
import { createNotesRepository } from '@/storage/notes-repository';
import { createPreferencesRepository } from '@/storage/preferences-repository';
import { groupNotesByDomain, getContinueWebsites } from '@/domain/notes-grouping';
import type { AppearanceMode } from '@/domain/preferences';
import type { Note } from '@/domain/note';
import '@/ui/tokens.css';
import '@/ui/notes-library.css';

const initialLang = resolveLang(browser.i18n?.getUILanguage?.());
// Same rationale as the popup: this page has no single host webpage of its
// own to detect a background from, so "Match website" resolves to the OS
// scheme here too.
const prefersDark =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
const repo = createNotesRepository();
const prefsRepo = createPreferencesRepository();

export function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [appearance, setAppearance] = useState<AppearanceMode>('match-website');
  /** `null` while the initial load is in flight; distinguishes "loading" from
   *  "loaded, zero notes" so the empty state doesn't flash before data arrives. */
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const strings = getStrings(lang);
  const dir = dirForLang(lang);
  const theme =
    appearance === 'light'
      ? 'light'
      : appearance === 'dark'
        ? 'dark'
        : prefersDark
          ? 'dark'
          : 'light';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = await prefsRepo.get();
      if (!cancelled) {
        setLang(prefs.language ?? initialLang);
        setAppearance(prefs.appearance);
      }
    })();
    const unwatch = prefsRepo.watch((prefs) => {
      setLang(prefs.language ?? initialLang);
      setAppearance(prefs.appearance);
    });
    return () => {
      cancelled = true;
      unwatch();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await repo.getAll();
        if (!cancelled) setNotes(all);
      } catch {
        if (!cancelled) setNotes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => groupNotesByDomain(notes ?? []), [notes]);
  const continueWebsites = useMemo(() => getContinueWebsites(notes ?? []), [notes]);

  function toggleGroup(domain: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  const loading = notes === null;
  const isEmpty = !loading && groups.length === 0;

  return (
    <div className="hm-scope hm-notes-page" dir={dir} data-hm-theme={theme}>
      <div className="hm-notes-page__inner">
        <header className="hm-notes-page__header">
          <MarginMark size={20} strokeWidth={3.5} style={{ color: 'var(--hm-accent)' }} />
          <h1 className="hm-notes-page__title">{strings.notesLibrary}</h1>
        </header>

        {!loading && !isEmpty && (
          <ContinueSection websites={continueWebsites} strings={strings} lang={lang} />
        )}

        {loading ? null : isEmpty ? (
          <div className="hm-empty hm-fade-in">
            <MarginMark size={28} strokeWidth={3} />
            <p className="hm-empty__title">{strings.notesLibraryEmptyTitle}</p>
            <p className="hm-empty__body">{strings.notesLibraryEmptyBody}</p>
          </div>
        ) : (
          <>
            <h2 className="hm-notes-page__section-label">{strings.allWebsites}</h2>
            <ul className="hm-groups">
              {groups.map((group, i) => (
                <li key={group.domain}>
                  <WebsiteGroup
                    group={group}
                    expanded={expanded.has(group.domain)}
                    onToggle={() => toggleGroup(group.domain)}
                    strings={strings}
                    lang={lang}
                    style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
