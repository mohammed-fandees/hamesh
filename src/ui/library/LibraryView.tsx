import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { revealElement } from '@/utils/dom';
import type { Folder, FolderLike } from '@/domain/folder';
import { buildFolderTree } from '@/domain/folder-grouping';
import { isSharedNote, type Note } from '@/domain/note';
import {
  filterNotesByQuery,
  getContinueWebsites,
  getPinnedNotes,
  groupNotesByDomain,
  sortWebsiteGroups,
  type GroupSortMode,
} from '@/domain/notes-grouping';
import type { LibraryPreferences } from '@/domain/preferences';
import { EmptyState } from '../kit/EmptyState';
import { stagger } from '../kit/motion';
import { Page, PageHeader } from '../kit/Page';
import { SegmentedControl } from '../kit/SegmentedControl';
import { Skeleton } from '../kit/Skeleton';
import type { Lang, Strings } from '../i18n';
import { matchesOwner, type NoteOwner } from '@/domain/note-owner';
import { NoteFilter } from '../teams/NoteFilter';
import { getTeamsStrings } from '../teams/strings';
import type { CachedTeam } from '@/teams/page-cache';
import { ContinueSection } from './ContinueSection';
import { FolderTree, PERSONAL_SPACE } from './FolderTree';
import { SpaceCard } from './SpaceCard';
import { DeviceIcon } from '../kit/icons';
import { TeamSpace, type TeamLibraryActions } from '../teams/TeamSpace';
import { PinnedSection } from './PinnedSection';
import { WebsiteGroup } from './WebsiteGroup';
import { LostNotesContext } from './LostNotes';
import { countUse } from '@/usage/count';
import type { UsageEvent } from '@/domain/usage';

const NO_LOST: ReadonlySet<string> = new Set();

type LibraryMode = 'domain' | 'folder';

interface LibraryViewProps {
  /** A note to find and show once the notes are in, from a link to it. */
  focusNoteId?: string | null;
  strings: Strings;
  lang: Lang;
  /** This device's notes; `null` while they load. */
  notes: Note[] | null;
  /** The notes this device holds from the reader's teams, and those teams. */
  teamNotes: Note[];
  teams: readonly CachedTeam[];
  /** Each team's folders, by team id. */
  teamFolders: ReadonlyMap<string, readonly FolderLike[]>;
  /** What the folder view may do to teams' notes and folders; absent without Teams. */
  teamActions?: TeamLibraryActions | null;
  folders: Folder[] | null;
  /** Whose notes are shown — everyone's, only the reader's, or one team's. */
  owner: NoteOwner;
  onOwnerChange: (owner: NoteOwner) => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<unknown>;
  onRenameFolder: (folderId: string, name: string) => Promise<unknown>;
  onDeleteFolder: (folderId: string) => Promise<unknown>;
  onMoveNote: (noteId: string, folderId: string | undefined) => void;
  /** How to leave a first note. */
  onOpenGuide: () => void;
  /** The shortcut for a new note, or null when it has none. */
  addShortcut?: string | null;
  /** How the reader last left the list, and how to remember a change. */
  listView?: LibraryPreferences;
  onListViewChange?: (patch: Partial<LibraryPreferences>) => void;
  /** Notes that lost their place on their page: marked on their rows, and a filter of their own. */
  lostIds?: ReadonlySet<string>;
  /** Counts one use of a feature, with the reader's consent. Tests pass their own. */
  count?: (event: UsageEvent) => void;
}

/**
 * The Notes Library: every note the reader can see — their own and their
 * teams' — in one list, because that is how a person thinks of their notes.
 *
 * Found by searching, narrowed by whose they are, and read either by site (a
 * card per site) or by folder (one card of folders). Continue and Pinned sit
 * above both, and step aside while searching — neither is a search result.
 */
export function LibraryView({
  strings,
  lang,
  focusNoteId = null,
  notes,
  teamNotes,
  teams,
  teamFolders,
  teamActions = null,
  folders,
  owner,
  onOwnerChange,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveNote,
  onOpenGuide,
  addShortcut = 'Alt+H',
  listView,
  onListViewChange,
  lostIds = NO_LOST,
  count = countUse,
}: LibraryViewProps) {
  const [query, setQuery] = useState('');
  const [lostOnly, setLostOnly] = useState(false);
  // Held here as well, so a page with nowhere to remember them still works, and a
  // click shows before storage has answered.
  const [ownSort, setOwnSort] = useState<GroupSortMode>('alphabetical');
  const [ownMode, setOwnMode] = useState<LibraryMode>('domain');
  const sortMode = listView?.sort ?? ownSort;
  const mode = listView?.mode ?? ownMode;
  const setSortMode = (sort: GroupSortMode) => {
    setOwnSort(sort);
    onListViewChange?.({ sort });
  };
  const setMode = useCallback(
    (next: LibraryMode) => {
      setOwnMode(next);
      onListViewChange?.({ mode: next });
    },
    [onListViewChange],
  );
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" finds the search from anywhere on the page — unless the reader is
  // already typing somewhere, where it is just a "/".
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const searching = query.trim() !== '';
  const owned = useMemo(
    () => [...(notes ?? []), ...teamNotes].filter((note) => matchesOwner(note, owner)),
    [notes, teamNotes, owner],
  );
  const lostCount = useMemo(() => owned.filter((n) => lostIds.has(n.id)).length, [owned, lostIds]);
  // The filter goes away with the last lost note, rather than leaving an empty list behind it.
  if (lostOnly && lostCount === 0) setLostOnly(false);
  const visible = useMemo(
    () => (lostOnly ? owned.filter((n) => lostIds.has(n.id)) : owned),
    [owned, lostOnly, lostIds],
  );
  const found = useMemo(() => filterNotesByQuery(visible, query), [visible, query]);
  const groups = useMemo(
    () => sortWebsiteGroups(groupNotesByDomain(found), sortMode),
    [found, sortMode],
  );
  // The reader's own notes are filed in their own folders; each team's, in that
  // team's. So the folder view is one tree per space, never one tree of both.
  const personalFound = useMemo(() => found.filter((note) => !isSharedNote(note)), [found]);
  const folderTree = useMemo(
    () => buildFolderTree(folders ?? [], personalFound),
    [folders, personalFound],
  );
  const continueSites = useMemo(() => getContinueWebsites(visible), [visible]);

  // Opened on one note (from its menu on a page): by site, its site's card
  // open, and the note brought into view and marked a moment — once.
  const [focusing, setFocusing] = useState(focusNoteId);
  const focusGroup = useMemo(
    () => (focusing ? groups.find((g) => g.notes.some((note) => note.id === focusing)) : undefined),
    [focusing, groups],
  );
  useEffect(() => {
    if (!focusing || !focusGroup) return;
    // Its card opened on one frame, the note found in it on the next.
    let next = 0;
    const first = requestAnimationFrame(() => {
      setMode('domain');
      setExpanded((prev) => new Set(prev).add(focusGroup.domain));
      next = requestAnimationFrame(() => {
        const row = document.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(focusing)}"]`);
        if (row) {
          revealElement(row);
          row.dataset.focus = 'true';
          window.setTimeout(() => delete row.dataset.focus, 2400);
        }
        setFocusing(null);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(next);
    };
  }, [focusing, focusGroup, setMode]);
  // Only this device's notes can be pinned, so a team's never appear here.
  const pinned = useMemo(() => getPinnedNotes(notes ?? []), [notes]);

  const loading = notes === null;
  const anyVisible = !loading && visible.length > 0;
  // "Nothing here" means nothing at all, not nothing in this filter: a team, or
  // one of its folders, with no notes yet is a different thing to say, with a
  // different way out.
  const nothingAtAll = !loading && (notes?.length ?? 0) + teamNotes.length === 0;
  const filteredOut = !loading && !nothingAtAll && !anyVisible;
  const noMatches = !loading && searching && anyVisible && found.length === 0;

  function body() {
    if (loading) return <Skeleton />;
    if (nothingAtAll) {
      return (
        <EmptyState
          title={strings.notesLibraryEmptyTitle}
          body={strings.notesLibraryEmptyBody(addShortcut)}
          action={{ label: strings.guideSeeHow, onClick: onOpenGuide }}
        />
      );
    }
    if (import.meta.env.WXT_TEAMS_API_ORIGIN && filteredOut) {
      const t = getTeamsStrings(lang);
      return (
        <EmptyState
          title={t.filterEmptyTitle}
          body={t.filterEmptyBody}
          action={{ label: t.filterShowAll, onClick: () => onOwnerChange('all'), tone: 'ghost' }}
        />
      );
    }
    if (noMatches) {
      return (
        <EmptyState
          title={strings.searchNoResultsTitle}
          body={strings.searchNoResultsBody(query.trim())}
        />
      );
    }
    if (mode === 'folder') {
      const personal = (bare: boolean) => (
        <FolderTree
          space={PERSONAL_SPACE}
          tree={folderTree.tree}
          unfiledNotes={folderTree.unfiledNotes}
          strings={strings}
          lang={lang}
          bare={bare}
          onCreateFolder={onCreateFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onDropNote={(noteId, folderId) => onMoveNote(noteId, folderId)}
        />
      );
      // Without teams there is one space, and nothing to tell it apart from.
      if (!import.meta.env.WXT_TEAMS_API_ORIGIN || !teamActions || teams.length === 0) {
        return personal(false);
      }
      const showsMine = owner === 'all' || owner === 'mine';
      const shownTeams = teams.filter(
        (team) => owner === 'all' || (typeof owner === 'object' && owner.teamId === team.id),
      );
      return (
        <div className="hm-spaces">
          {showsMine && (
            <SpaceCard
              icon={<DeviceIcon size={16} />}
              title={strings.mySpace}
              meta={strings.mySpaceMeta(personalFound.length)}
            >
              {personal(true)}
            </SpaceCard>
          )}
          {shownTeams.map((team) => (
            <TeamSpace
              key={team.id}
              team={team}
              notes={found.filter((note) => note.team?.id === team.id)}
              folders={teamFolders.get(team.id) ?? []}
              strings={strings}
              lang={lang}
              actions={teamActions}
            />
          ))}
        </div>
      );
    }
    return (
      <ul className="hm-groups">
        {groups.map((group, i) => (
          <li key={group.domain}>
            <WebsiteGroup
              group={group}
              expanded={searching || lostOnly || expanded.has(group.domain)}
              onToggle={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (!next.delete(group.domain)) next.add(group.domain);
                  return next;
                })
              }
              strings={strings}
              lang={lang}
              style={stagger(i)}
            />
          </li>
        ))}
      </ul>
    );
  }

  const showTeamsFilter = import.meta.env.WXT_TEAMS_API_ORIGIN && teams.length > 0;

  return (
    <Page wide>
      <PageHeader title={strings.notesLibrary} />

      <span className="hm-visually-hidden" role="status">
        {loading ? strings.loadingNotes : ''}
      </span>

      {anyVisible && (
        <div className="hm-search-wrap">
          <input
            ref={searchRef}
            type="search"
            className="hm-search"
            placeholder={strings.searchPlaceholder}
            aria-label={strings.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Escape' || !query) return;
              e.preventDefault();
              e.stopPropagation();
              setQuery('');
            }}
          />
          {!searching && (
            <kbd className="hm-search__hint" aria-hidden="true">
              /
            </kbd>
          )}
        </div>
      )}

      {(showTeamsFilter || lostCount > 0 || (anyVisible && !searching)) && (
        <div className="hm-library-toolbar">
          {showTeamsFilter && (
            <NoteFilter lang={lang} teams={teams} value={owner} onChange={onOwnerChange} />
          )}
          {lostCount > 0 && (
            <button
              type="button"
              className="hm-lost-filter"
              aria-pressed={lostOnly}
              onClick={() => {
                if (!lostOnly) count('lost.filtered');
                setLostOnly(!lostOnly);
              }}
            >
              <span className="hm-dot" aria-hidden="true" />
              {strings.lostNotes.filter(lostCount)}
            </button>
          )}
          {anyVisible && !searching && (
            <div className="hm-library-toolbar__view">
              {mode === 'domain' && groups.length > 0 && (
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
              )}
              <SegmentedControl<LibraryMode>
                value={mode}
                name="hm-library-mode"
                groupLabel={strings.libraryModeLabel}
                options={[
                  { value: 'domain', label: strings.modeDomain },
                  { value: 'folder', label: strings.modeFolder },
                ]}
                onChange={setMode}
              />
            </div>
          )}
        </div>
      )}

      {/* Like a search, the lost-notes filter is a short list to act on: its cards open, and
          Continue and Pinned step aside. */}
      {!searching && !lostOnly && anyVisible && (
        <ContinueSection websites={continueSites} strings={strings} lang={lang} />
      )}
      {!searching && !lostOnly && anyVisible && (
        <PinnedSection notes={pinned} strings={strings} lang={lang} />
      )}

      <LostNotesContext.Provider value={lostIds}>{body()}</LostNotesContext.Provider>
    </Page>
  );
}
