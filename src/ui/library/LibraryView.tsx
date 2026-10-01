import { useEffect, useMemo, useRef, useState } from 'react';
import type { Folder } from '@/domain/folder';
import { buildFolderTree } from '@/domain/folder-grouping';
import type { Note } from '@/domain/note';
import {
  filterNotesByQuery,
  getContinueWebsites,
  getPinnedNotes,
  groupNotesByDomain,
  sortWebsiteGroups,
  type GroupSortMode,
} from '@/domain/notes-grouping';
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
import { FolderTree } from './FolderTree';
import { PinnedSection } from './PinnedSection';
import { WebsiteGroup } from './WebsiteGroup';

type LibraryMode = 'domain' | 'folder';

interface LibraryViewProps {
  strings: Strings;
  lang: Lang;
  /** This device's notes; `null` while they load. */
  notes: Note[] | null;
  /** The notes this device holds from the reader's teams, and those teams. */
  teamNotes: Note[];
  teams: readonly CachedTeam[];
  folders: Folder[] | null;
  /** Whose notes are shown — everyone's, only the reader's, or one team's. */
  owner: NoteOwner;
  onOwnerChange: (owner: NoteOwner) => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<unknown>;
  onRenameFolder: (folderId: string, name: string) => Promise<unknown>;
  onDeleteFolder: (folderId: string) => Promise<unknown>;
  onMoveNote: (noteId: string, folderId: string | undefined) => void;
  /** Where the shortcuts that make a first note are. */
  onOpenSettings: () => void;
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
  notes,
  teamNotes,
  teams,
  folders,
  owner,
  onOwnerChange,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveNote,
  onOpenSettings,
}: LibraryViewProps) {
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<GroupSortMode>('alphabetical');
  const [mode, setMode] = useState<LibraryMode>('domain');
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
  const visible = useMemo(
    () => [...(notes ?? []), ...teamNotes].filter((note) => matchesOwner(note, owner)),
    [notes, teamNotes, owner],
  );
  const found = useMemo(() => filterNotesByQuery(visible, query), [visible, query]);
  const groups = useMemo(
    () => sortWebsiteGroups(groupNotesByDomain(found), sortMode),
    [found, sortMode],
  );
  const folderTree = useMemo(() => buildFolderTree(folders ?? [], found), [folders, found]);
  const continueSites = useMemo(() => getContinueWebsites(visible), [visible]);
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
          body={strings.notesLibraryEmptyBody}
          action={{ label: strings.settingsShortcuts, onClick: onOpenSettings }}
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
      return (
        <FolderTree
          tree={folderTree.tree}
          unfiledNotes={folderTree.unfiledNotes}
          strings={strings}
          lang={lang}
          onCreateFolder={onCreateFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onMoveNote={onMoveNote}
        />
      );
    }
    return (
      <ul className="hm-groups">
        {groups.map((group, i) => (
          <li key={group.domain}>
            <WebsiteGroup
              group={group}
              expanded={searching || expanded.has(group.domain)}
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

      {(showTeamsFilter || (anyVisible && !searching)) && (
        <div className="hm-library-toolbar">
          {showTeamsFilter && (
            <NoteFilter lang={lang} teams={teams} value={owner} onChange={onOwnerChange} />
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

      {!searching && anyVisible && (
        <ContinueSection websites={continueSites} strings={strings} lang={lang} />
      )}
      {!searching && anyVisible && <PinnedSection notes={pinned} strings={strings} lang={lang} />}

      {body()}
    </Page>
  );
}
