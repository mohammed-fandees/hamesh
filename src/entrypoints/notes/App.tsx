import { useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { MarginMark } from '@/ui/MarginMark';
import { WebsiteGroup } from '@/ui/WebsiteGroup';
import { ContinueSection } from '@/ui/ContinueSection';
import { PinnedSection } from '@/ui/PinnedSection';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { getStrings, resolveLang, dirForLang, type Lang } from '@/ui/i18n';
import { createNotesRepository } from '@/storage/notes-repository';
import { createPreferencesRepository } from '@/storage/preferences-repository';
import {
  groupNotesByDomain,
  getContinueWebsites,
  getPinnedNotes,
  filterNotesByQuery,
  sortWebsiteGroups,
  type GroupSortMode,
} from '@/domain/notes-grouping';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<GroupSortMode>('alphabetical');
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // "/" focuses search from anywhere on the page — ignored while focus is
  // already in an editable field (so it types a literal "/" there instead,
  // e.g. into the search box itself).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || !!target?.isContentEditable;
      if (isEditable) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const isSearching = searchQuery.trim() !== '';
  const filteredNotes = useMemo(
    () => filterNotesByQuery(notes ?? [], searchQuery),
    [notes, searchQuery],
  );
  const groups = useMemo(
    () => sortWebsiteGroups(groupNotesByDomain(filteredNotes), sortMode),
    [filteredNotes, sortMode],
  );
  // Continue and Pinned always reflect the full, unfiltered library —
  // neither is a "search result" — so both are hidden (not filtered) while
  // actively searching. See render logic below.
  const continueWebsites = useMemo(() => getContinueWebsites(notes ?? []), [notes]);
  const pinnedNotes = useMemo(() => getPinnedNotes(notes ?? []), [notes]);

  function toggleGroup(domain: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  const loading = notes === null;
  const hasAnyNotes = !loading && notes.length > 0;
  const noNotesAtAll = !loading && !hasAnyNotes;
  const noSearchResults = !loading && isSearching && hasAnyNotes && groups.length === 0;

  return (
    <div className="hm-scope hm-notes-page" dir={dir} data-hm-theme={theme}>
      <div className="hm-notes-page__inner">
        <header className="hm-notes-page__header">
          <MarginMark size={20} strokeWidth={3.5} style={{ color: 'var(--hm-accent)' }} />
          <h1 className="hm-notes-page__title">{strings.notesLibrary}</h1>
        </header>

        <span className="hm-visually-hidden" role="status">
          {loading ? strings.loadingNotes : ''}
        </span>

        {hasAnyNotes && (
          <div className="hm-search-wrap">
            <input
              ref={searchInputRef}
              type="search"
              className="hm-search"
              placeholder={strings.searchPlaceholder}
              aria-label={strings.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Escape' || !searchQuery) return;
                e.preventDefault();
                e.stopPropagation();
                setSearchQuery('');
              }}
            />
            {!isSearching && (
              <kbd className="hm-search__hint" aria-hidden="true">
                /
              </kbd>
            )}
          </div>
        )}

        {!isSearching && hasAnyNotes && (
          <ContinueSection websites={continueWebsites} strings={strings} lang={lang} />
        )}

        {!isSearching && hasAnyNotes && (
          <PinnedSection notes={pinnedNotes} strings={strings} lang={lang} />
        )}

        {loading ? (
          <div className="hm-skeleton" aria-hidden="true">
            <div className="hm-skeleton__row" />
            <div className="hm-skeleton__row" />
            <div className="hm-skeleton__row" />
          </div>
        ) : noNotesAtAll ? (
          <div className="hm-empty hm-fade-in">
            <MarginMark size={28} strokeWidth={3} />
            <p className="hm-empty__title">{strings.notesLibraryEmptyTitle}</p>
            <p className="hm-empty__body">{strings.notesLibraryEmptyBody}</p>
          </div>
        ) : noSearchResults ? (
          <div className="hm-empty hm-fade-in">
            <MarginMark size={28} strokeWidth={3} />
            <p className="hm-empty__title">{strings.searchNoResultsTitle}</p>
            <p className="hm-empty__body">{strings.searchNoResultsBody(searchQuery.trim())}</p>
          </div>
        ) : (
          <>
            {!isSearching && groups.length > 0 && (
              <div className="hm-sort-row">
                <span className="hm-sort-row__label">{strings.sortLabel}</span>
                <SegmentedControl<GroupSortMode>
                  value={sortMode}
                  name="hm-notes-sort"
                  groupLabel={strings.sortLabel}
                  options={[
                    { value: 'alphabetical', label: strings.sortAlphabetical },
                    { value: 'recent', label: strings.sortRecent },
                  ]}
                  onChange={setSortMode}
                />
              </div>
            )}
            <ul className="hm-groups">
              {groups.map((group, i) => (
                <li key={group.domain}>
                  <WebsiteGroup
                    group={group}
                    expanded={isSearching || expanded.has(group.domain)}
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
