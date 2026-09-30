import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { MarginMark } from '@/ui/MarginMark';
import { Sidebar, type LibraryView } from '@/ui/Sidebar';
import { LibrarySettingsView } from '@/ui/LibrarySettingsView';
import { WhatsNewView } from '@/ui/WhatsNewView';
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
import type { AppearanceMode, TextNotePreferences } from '@/domain/preferences';
import { DEFAULT_TEXT_NOTE_PREFERENCES } from '@/domain/preferences';
import { getLatestReleaseVersion, hasUnseenReleases } from '@/domain/release-notes';
import {
  backupFileName,
  buildBackup,
  mergeFolders,
  mergeNotes,
  parseBackup,
  serializeBackup,
} from '@/domain/backup';
import type { BackupImportOutcome } from '@/ui/BackupSection';
import { teamsConfig } from '@/teams/config';
import { createTeamsClient } from '@/teams/client';
import { TeamsView } from '@/ui/teams/TeamsView';
import { ShareNoteAction } from '@/ui/teams/ShareNoteAction';
import { NoteShareSlot } from '@/ui/NoteShareSlot';
import { generatePageKey } from '@/domain/page-key';
import { watchTeamIndex } from '@/teams/page-cache';
import {
  newestMentionId,
  readTeamNotesForLibrary,
  NO_TEAM_NOTES,
  type LibraryTeamNotes,
} from '@/ui/teams/library-notes';
import { MentionsInbox } from '@/ui/teams/MentionsInbox';
import { NoteFilter, matchesOwner, type NoteOwner } from '@/ui/teams/NoteFilter';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { PersonalNotes } from '@/ui/teams/personal-notes';
import type { TeamNote } from '@hamesh/teams-contract';
import type { Note } from '@/domain/note';
import type { Folder } from '@/domain/folder';
import '@/ui/tokens.css';
import '@/ui/notes-library.css';

type LibraryMode = 'domain' | 'folder';

const initialLang = resolveLang(browser.i18n?.getUILanguage?.());
// Lets another context deep-link straight to a view instead of always
// opening to Library: the popup's "Open full settings" link
// (`notes.html?view=settings`), and the tab the background opens after an
// update (`notes.html?view=whats-new`).
const requestedView = new URLSearchParams(location.search).get('view');
const initialView: LibraryView =
  requestedView === 'settings' || requestedView === 'whats-new' ? requestedView : 'library';
// The build's own version, so What's New can mark the entry actually
// installed rather than assuming it's the newest one listed.
const currentVersion = browser.runtime.getManifest().version;
// Same rationale as the popup: this page has no single host webpage of its
// own to detect a background from, so "Match website" resolves to the OS
// scheme here too.
const prefersDark =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
/** What "a note moves between this device and a team" means when there are no
 *  teams: nothing at all. Named here so the real one below can sit behind this
 *  build's Teams constant. */
const NO_SHARING: PersonalNotes = { forget: async () => {}, keep: async () => {} };

const repo = createNotesRepository();
const prefsRepo = createPreferencesRepository();
const foldersRepo = createFoldersRepository();

export function App() {
  const [view, setView] = useState<LibraryView>(initialView);
  const [lang, setLang] = useState<Lang>(initialLang);
  const [appearance, setAppearance] = useState<AppearanceMode>('match-website');
  const [textNotes, setTextNotes] = useState<TextNotePreferences>(DEFAULT_TEXT_NOTE_PREFERENCES);
  /** `undefined` until preferences load — distinct from `null`, which means
   *  "loaded, and this user has never opened What's New". */
  const [lastSeenVersion, setLastSeenVersion] = useState<string | null | undefined>(undefined);
  /** `null` while the initial load is in flight; distinguishes "loading" from
   *  "loaded, zero notes" so the empty state doesn't flash before data arrives. */
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<GroupSortMode>('alphabetical');
  const [libraryMode, setLibraryMode] = useState<LibraryMode>('domain');
  /** Every team note this device holds, and the teams they came from. Always
   *  empty in a build without Teams, and while nobody is signed in. */
  const [shared, setShared] = useState<LibraryTeamNotes>(NO_TEAM_NOTES);
  /** Whose notes the library is showing. */
  const [owner, setOwner] = useState<NoteOwner>('all');
  /** The newest mention the server has, and the newest this reader has looked
   *  at — the difference is what puts a dot on Mentions in the sidebar. */
  const [newestMention, setNewestMention] = useState<string | null>(null);
  const [lastSeenMention, setLastSeenMention] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const strings = getStrings(lang);
  // Null in builds without Teams, which leaves Settings exactly as it was.
  const teamsClient = useMemo(() => {
    // A build-time constant: builds without Teams drop this code entirely.
    if (!import.meta.env.WXT_TEAMS_API_ORIGIN) return null;
    const config = teamsConfig();
    return config ? createTeamsClient(config) : null;
  }, []);
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
        setTextNotes(prefs.textNotes);
        setLastSeenVersion(prefs.releaseNotes.lastSeenVersion);
        setLastSeenMention(prefs.teams.lastSeenMentionId);
      }
    })();
    const unwatch = prefsRepo.watch((prefs) => {
      setLang(prefs.language ?? initialLang);
      setAppearance(prefs.appearance);
      setTextNotes(prefs.textNotes);
      // Deliberately not mirrored back into `lastSeenVersion`: this view
      // marks itself read as soon as it opens, and echoing that write back
      // would clear the "new" dot mid-visit, before the reader has read it.
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

  // The team notes this device already holds, beside the reader's own. Nothing
  // is fetched from the server here: the worker pulled each team's changes and
  // filed them, and this asks it for what it has. Re-read when the set of teams
  // changes, and when the window comes back — a pull may have landed while it
  // was in the background.
  const loadShared = useCallback(async () => {
    if (!import.meta.env.WXT_TEAMS_API_ORIGIN || !teamsClient) return;
    try {
      setShared(await readTeamNotesForLibrary(teamsClient));
    } catch {
      setShared(NO_TEAM_NOTES);
    }
  }, [teamsClient]);

  useEffect(() => {
    if (!import.meta.env.WXT_TEAMS_API_ORIGIN || !teamsClient) return;
    let cancelled = false;
    (async () => {
      const next = await readTeamNotesForLibrary(teamsClient).catch(() => NO_TEAM_NOTES);
      if (!cancelled) setShared(next);
      const newest = await newestMentionId(teamsClient).catch(() => null);
      if (!cancelled) setNewestMention(newest);
    })();
    const unwatch = watchTeamIndex(() => void loadShared());
    const onFocus = () => void loadShared();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      unwatch();
      window.removeEventListener('focus', onFocus);
    };
  }, [teamsClient, loadShared]);

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
  /**
   * One list: what this device stored and what its teams have shared. A reader
   * thinks of them as their notes, so the library shows them together and the
   * chip on a row says which are not theirs alone.
   */
  const visibleNotes = useMemo(
    () => [...(notes ?? []), ...shared.notes].filter((note) => matchesOwner(note, owner)),
    [notes, shared, owner],
  );
  const filteredNotes = useMemo(
    () => filterNotesByQuery(visibleNotes, searchQuery),
    [visibleNotes, searchQuery],
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
  const continueWebsites = useMemo(() => getContinueWebsites(visibleNotes), [visibleNotes]);
  // Only a note this device stored can be pinned, so this list never has to
  // exclude a team's.
  const pinnedNotes = useMemo(() => getPinnedNotes(notes ?? []), [notes]);

  function handleLanguageChange(next: Lang) {
    setLang(next); // immediate feedback; persisted below, and re-confirmed by watch()
    void prefsRepo.setLanguage(next);
  }

  function handleAppearanceChange(next: AppearanceMode) {
    setAppearance(next); // immediate feedback; persisted below, and re-confirmed by watch()
    void prefsRepo.setAppearance(next);
  }

  /**
   * Export — everything, to a file the user chooses where to keep.
   *
   * Reads storage directly rather than the `notes` already in state: a
   * backup must be the whole truth at the moment it's taken, not whatever
   * the current view happens to be filtered to.
   */
  async function handleExportBackup(): Promise<{ notes: number; folders: number }> {
    const [allNotes, allFolders] = await Promise.all([repo.getAll(), foldersRepo.getAll()]);
    const backup = buildBackup({
      notes: allNotes,
      folders: allFolders,
      appVersion: currentVersion,
    });

    const blob = new Blob([serializeBackup(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = backupFileName();
      link.click();
    } finally {
      // Freed on the next tick — revoking synchronously can cancel the
      // download the click just started.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    return { notes: allNotes.length, folders: allFolders.length };
  }

  /**
   * Import — merge a backup file back in.
   *
   * Reads the current contents fresh, merges by the rules in
   * `domain/backup.ts` (never deletes; newer edit wins), then writes. If a
   * write fails partway the user still has everything they had before,
   * because nothing is ever removed first.
   */
  async function handleImportBackup(text: string): Promise<BackupImportOutcome> {
    const parsed = parseBackup(text);
    if (!parsed.ok) return { ok: false, reason: parsed.reason };

    const [existingNotes, existingFolders] = await Promise.all([
      repo.getAll(),
      foldersRepo.getAll(),
    ]);
    const mergedNotes = mergeNotes(existingNotes, parsed.backup.notes);
    const mergedFolders = mergeFolders(existingFolders, parsed.backup.folders);

    const noteChanges = mergedNotes.added + mergedNotes.updated;
    const folderChanges = mergedFolders.added + mergedFolders.updated;
    // Nothing new in the file: skip the writes entirely rather than
    // rewriting every page bucket for no reason.
    if (noteChanges === 0 && folderChanges === 0) {
      return { ok: true, notes: 0, folders: 0 };
    }

    // Folders first: a note carrying a `folderId` should never be visible
    // for even a moment before the folder it points at exists.
    if (folderChanges > 0) await foldersRepo.saveAll(mergedFolders.items);
    if (noteChanges > 0) await repo.saveAll(mergedNotes.items);

    setNotes(mergedNotes.items);
    return { ok: true, notes: noteChanges, folders: folderChanges };
  }

  function handleTextNotesChange(patch: Partial<TextNotePreferences>) {
    setTextNotes((prev) => ({ ...prev, ...patch })); // re-confirmed by watch()
    void prefsRepo.setTextNotes(patch);
  }

  // Opening What's New *is* reading it — the badge and the auto-open both
  // key off this, so it's recorded on arrival rather than on some "mark as
  // read" affordance nobody would click. The local `lastSeenVersion` stays
  // as it was for this visit, so entries stay marked "New" while they're
  // being read.
  useEffect(() => {
    if (view !== 'whats-new' || lastSeenVersion === undefined) return;
    const latest = getLatestReleaseVersion();
    if (lastSeenVersion === latest) return;
    void prefsRepo.setLastSeenReleaseVersion(latest);
  }, [view, lastSeenVersion]);

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

  async function handleTogglePin(noteId: string) {
    const note = notes?.find((n) => n.id === noteId);
    if (!note) return;
    const updated = await repo.setPinned(noteId, note.pageKey, !note.pinned);
    if (updated) {
      setNotes((prev) => prev?.map((n) => (n.id === noteId ? updated : n)) ?? prev);
    }
  }

  async function handleEditNote(noteId: string, content: string) {
    const note = notes?.find((n) => n.id === noteId);
    if (!note) return;
    const updated = await repo.update(noteId, note.pageKey, { content });
    if (updated) {
      setNotes((prev) => prev?.map((n) => (n.id === noteId ? updated : n)) ?? prev);
    }
  }

  async function handleDeleteNote(noteId: string) {
    const note = notes?.find((n) => n.id === noteId);
    if (!note) return;
    const deleted = await repo.delete(noteId, note.pageKey);
    if (deleted) {
      setNotes((prev) => prev?.filter((n) => n.id !== noteId) ?? prev);
    }
  }

  /**
   * How a note crosses between this device and a team. Sharing moves it: the
   * team's copy is what the page then shows, so keeping a personal one as well
   * would draw the same note twice. Unsharing moves it back.
   *
   * Only built in a build that has Teams — the constant is folded away in every
   * other one, and with it everything this reaches.
   */
  const personalNotes = useMemo<PersonalNotes>(() => {
    // The build-time constant first, so a build without Teams keeps neither
    // this nor what it reaches (the page-key helper among it).
    if (!import.meta.env.WXT_TEAMS_API_ORIGIN) return NO_SHARING;
    return {
      forget: (noteId: string) => handleDeleteNote(noteId),
      keep: async (note: TeamNote) => {
        const created = await repo.create({
          content: note.content,
          pageKey: generatePageKey(note.originalUrl),
          originalUrl: note.originalUrl,
          anchor: note.anchor,
          ...(note.pageTitle ? { pageContext: { title: note.pageTitle } } : {}),
        });
        setNotes((prev) => (prev ? [...prev, created] : prev));
      },
    };
    // `handleDeleteNote` closes over `notes`, which is exactly what it needs to
    // find the note's page; a new identity per render is the point here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  /** The "Share with team" item in a note's actions menu. */
  const shareAction = useMemo(() => {
    // A build-time constant first: with it folded away, nothing below is
    // reachable and the Teams module this reaches is dropped from the bundle.
    if (!import.meta.env.WXT_TEAMS_API_ORIGIN) return null;
    if (!teamsClient || shared.teams.length === 0) return null;
    return (note: Note, close: () => void) => (
      <ShareNoteAction
        note={note}
        lang={lang}
        client={teamsClient}
        teams={shared.teams}
        // A team note is not shared again; from here it is only opened.
        open={note.team ? () => setView('teams') : undefined}
        onDone={async () => {
          close();
          // The team's copy is read back before the local one goes, so the row
          // never blinks out of the list between the two.
          await loadShared();
          await personalNotes.forget(note.id);
        }}
      />
    );
  }, [teamsClient, shared.teams, lang, personalNotes, loadShared]);

  const loading = notes === null;
  const hasAnyNotes = !loading && visibleNotes.length > 0;
  const noNotesAtAll = !loading && !hasAnyNotes;
  const noSearchResults = !loading && isSearching && hasAnyNotes && filteredNotes.length === 0;
  const teamsStrings = getTeamsStrings(lang);
  /** Somebody named this reader since they last looked at Mentions. */
  const mentionsUnseen = newestMention !== null && newestMention !== lastSeenMention;

  return (
    <NoteShareSlot.Provider value={shareAction}>
      <div className="hm-scope hm-notes-page" dir={dir} data-hm-theme={theme}>
        <Sidebar
          view={view}
          strings={strings}
          onNavigate={setView}
          whatsNewUnseen={lastSeenVersion !== undefined && hasUnseenReleases(lastSeenVersion)}
          showTeams={teamsClient !== null}
          mentionsUnseen={mentionsUnseen}
        />

        {import.meta.env.WXT_TEAMS_API_ORIGIN && view === 'teams' && teamsClient ? (
          <TeamsView
            lang={lang}
            client={teamsClient}
            onOpenSettings={() => setView('settings')}
            onOpenLibrary={() => setView('library')}
            personal={personalNotes}
          />
        ) : import.meta.env.WXT_TEAMS_API_ORIGIN && view === 'mentions' && teamsClient ? (
          <div className="hm-notes-main">
            <div className="hm-notes-page__inner">
              <header className="hm-notes-page__header">
                <MarginMark size={20} strokeWidth={3.5} style={{ color: 'var(--hm-accent)' }} />
                <h1 className="hm-notes-page__title">{teamsStrings.mentions}</h1>
              </header>
              <MentionsInbox
                lang={lang}
                client={teamsClient}
                onRead={(commentId) => {
                  setLastSeenMention(commentId);
                  void prefsRepo.setLastSeenMention(commentId);
                }}
              />
            </div>
          </div>
        ) : view === 'whats-new' ? (
          <WhatsNewView
            strings={strings}
            lang={lang}
            currentVersion={currentVersion}
            lastSeenVersion={lastSeenVersion ?? null}
          />
        ) : view === 'settings' ? (
          <LibrarySettingsView
            strings={strings}
            lang={lang}
            appearance={appearance}
            textNotes={textNotes}
            onLanguageChange={handleLanguageChange}
            onAppearanceChange={handleAppearanceChange}
            onTextNotesChange={handleTextNotesChange}
            backup={{ onExport: handleExportBackup, onImport: handleImportBackup }}
            teams={teamsClient}
            onOpenTeam={() => setView('teams')}
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

              {import.meta.env.WXT_TEAMS_API_ORIGIN && shared.teams.length > 0 && (
                <NoteFilter lang={lang} teams={shared.teams} value={owner} onChange={setOwner} />
              )}

              {!isSearching && hasAnyNotes && (
                <ContinueSection websites={continueWebsites} strings={strings} lang={lang} />
              )}

              {!isSearching && hasAnyNotes && (
                <PinnedSection
                  notes={pinnedNotes}
                  allNotes={notes ?? []}
                  strings={strings}
                  lang={lang}
                  onTogglePin={handleTogglePin}
                  onEditNote={handleEditNote}
                  onDeleteNote={handleDeleteNote}
                />
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
                  <p className="hm-empty__body">
                    {strings.searchNoResultsBody(searchQuery.trim())}
                  </p>
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
                      onTogglePin={handleTogglePin}
                      onEditNote={handleEditNote}
                      onDeleteNote={handleDeleteNote}
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
                            onTogglePin={handleTogglePin}
                            onEditNote={handleEditNote}
                            onDeleteNote={handleDeleteNote}
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
    </NoteShareSlot.Provider>
  );
}
