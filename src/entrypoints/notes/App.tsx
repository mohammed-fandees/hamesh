import { useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { MarginMark } from '@/ui/MarginMark';
import { Sidebar, type LibraryView } from '@/ui/Sidebar';
import { LibrarySettingsView } from '@/ui/LibrarySettingsView';
import { WebsiteGroup } from '@/ui/WebsiteGroup';
import { FolderTree } from '@/ui/FolderTree';
import { ContinueSection } from '@/ui/ContinueSection';
import { PinnedSection } from '@/ui/PinnedSection';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { getStrings, resolveLang, dirForLang, type Lang } from '@/ui/i18n';
import { createNotesRepository } from '@/storage/notes-repository';
import { createPreferencesRepository } from '@/storage/preferences-repository';
import { createFoldersRepository } from '@/storage/folders-repository';
import {
  groupNotesByDomain,
  getContinueWebsites,
  getPinnedNotes,
  filterNotesByQuery,
  sortWebsiteGroups,
  type GroupSortMode,
} from '@/domain/notes-grouping';
import { buildFolderTree } from '@/domain/folder-grouping';
import type { AppearanceMode } from '@/domain/preferences';
import type { Note } from '@/domain/note';
import type { Folder } from '@/domain/folder';
import '@/ui/tokens.css';
import '@/ui/notes-library.css';

type LibraryMode = 'domain' | 'folder';

const initialLang = resolveLang(browser.i18n?.getUILanguage?.());
// Lets the popup's "Open full settings" link land directly on the Settings
// view (`notes.html?view=settings`) instead of always opening to Library.
const initialView: LibraryView =
  new URLSearchParams(location.search).get('view') === 'settings' ? 'settings' : 'library';
// Same rationale as the popup: this page has no single host webpage of its
// own to detect a background from, so "Match website" resolves to the OS
// scheme here too.
const prefersDark =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
const repo = createNotesRepository();
const prefsRepo = createPreferencesRepository();
const foldersRepo = createFoldersRepository();

export function App() {
  const [view, setView] = useState<LibraryView>(initialView);
  const [lang, setLang] = useState<Lang>(initialLang);
  const [appearance, setAppearance] = useState<AppearanceMode>('match-website');
  /** `null` while the initial load is in flight; distinguishes "loading" from
   *  "loaded, zero notes" so the empty state doesn't flash before data arrives. */
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<GroupSortMode>('alphabetical');
  const [libraryMode, setLibraryMode] = useState<LibraryMode>('domain');
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await foldersRepo.getAll();
        if (!cancelled) setFolders(all);
      } catch {
        if (!cancelled) setFolders([]);
      }
    })();
    const unwatch = foldersRepo.watch((next) => setFolders(next));
    return () => {
      cancelled = true;
      unwatch();
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
  const folderTree = useMemo(
    () => buildFolderTree(folders ?? [], filteredNotes),
    [folders, filteredNotes],
  );
  // Continue and Pinned always reflect the full, unfiltered library —
  // neither is a "search result" — so both are hidden (not filtered) while
  // actively searching. See render logic below.
  const continueWebsites = useMemo(() => getContinueWebsites(notes ?? []), [notes]);
  const pinnedNotes = useMemo(() => getPinnedNotes(notes ?? []), [notes]);

  function handleLanguageChange(next: Lang) {
    setLang(next); // immediate feedback; persisted below, and re-confirmed by watch()
    void prefsRepo.setLanguage(next);
  }

  function handleAppearanceChange(next: AppearanceMode) {
    setAppearance(next); // immediate feedback; persisted below, and re-confirmed by watch()
    void prefsRepo.setAppearance(next);
  }

  function toggleGroup(domain: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  // None of these mutators touch `folders` state directly — the
  // `foldersRepo.watch()` subscription above already delivers the
  // authoritative array after every write, including this context's own
  // (chrome.storage.onChanged fires same-context too). A second, optimistic
  // local update here would race that subscription: if the watch callback
  // wins, an `[...(prev ?? []), folder]`-style append would append onto the
  // already-updated array and duplicate the entry.
  async function handleCreateFolder(name: string, parentId: string | null): Promise<string> {
    const folder = await foldersRepo.create({ name, parentId });
    return folder.id;
  }

  async function handleRenameFolder(folderId: string, name: string) {
    await foldersRepo.rename(folderId, name);
  }

  async function handleDeleteFolder(folderId: string) {
    const { removedFolderIds } = await foldersRepo.remove(folderId);
    const removedSet = new Set(removedFolderIds);

    // Unfile every note that belonged to the removed folder or any of its
    // descendants — folders-repository and notes-repository stay decoupled
    // from each other, so this two-step orchestration lives here.
    const affected = (notes ?? []).filter((n) => n.folderId && removedSet.has(n.folderId));
    const updates = await Promise.all(
      affected.map((n) => repo.setFolder(n.id, n.pageKey, undefined)),
    );
    if (updates.length > 0) {
      setNotes((prev) => {
        if (!prev) return prev;
        const byId = new Map(updates.filter((u): u is Note => !!u).map((u) => [u.id, u]));
        return prev.map((n) => byId.get(n.id) ?? n);
      });
    }
  }

  async function handleMoveNote(noteId: string, folderId: string | undefined) {
    const note = notes?.find((n) => n.id === noteId);
    if (!note) return;
    const updated = await repo.setFolder(noteId, note.pageKey, folderId);
    if (updated) {
      setNotes((prev) => prev?.map((n) => (n.id === noteId ? updated : n)) ?? prev);
    }
  }

  const loading = notes === null;
  const hasAnyNotes = !loading && notes.length > 0;
  const noNotesAtAll = !loading && !hasAnyNotes;
  const noSearchResults = !loading && isSearching && hasAnyNotes && filteredNotes.length === 0;

  return (
    <div className="hm-scope hm-notes-page" dir={dir} data-hm-theme={theme}>
      <Sidebar view={view} strings={strings} onNavigate={setView} />

      {view === 'settings' ? (
        <LibrarySettingsView
          strings={strings}
          lang={lang}
          appearance={appearance}
          onLanguageChange={handleLanguageChange}
          onAppearanceChange={handleAppearanceChange}
        />
      ) : (
        <div className="hm-notes-main">
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
                {!isSearching && (
                  <div className="hm-sort-row">
                    <SegmentedControl<LibraryMode>
                      value={libraryMode}
                      name="hm-library-mode"
                      groupLabel={strings.libraryModeLabel}
                      options={[
                        { value: 'domain', label: strings.modeDomain },
                        { value: 'folder', label: strings.modeFolder },
                      ]}
                      onChange={setLibraryMode}
                    />
                    {libraryMode === 'domain' && groups.length > 0 && (
                      <>
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
                      </>
                    )}
                  </div>
                )}
                {libraryMode === 'folder' ? (
                  <FolderTree
                    tree={folderTree.tree}
                    unfiledNotes={folderTree.unfiledNotes}
                    strings={strings}
                    lang={lang}
                    onCreateFolder={handleCreateFolder}
                    onRenameFolder={handleRenameFolder}
                    onDeleteFolder={handleDeleteFolder}
                    onMoveNote={handleMoveNote}
                  />
                ) : (
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
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
