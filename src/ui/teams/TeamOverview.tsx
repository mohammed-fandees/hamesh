import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import { FOLDER_NAME_MAX } from '@/domain/folder';
import { countInFolder, flattenFolderTree, resolveFolderId } from '@/domain/folder-grouping';
import type { Note } from '@/domain/note';
import type { NoteOwner } from '@/domain/note-owner';
import type { TeamCacheSnapshot } from '@/teams/messages';
import { FolderMenu } from '../FolderMenu';
import { relativeTime } from '../format';
import type { Lang } from '../i18n';
import { Avatar } from '../kit/Avatar';
import { EmptyState } from '../kit/EmptyState';
import { InlineError } from '../kit/Feedback';
import { NameField } from '../kit/NameField';
import { Section } from '../kit/Section';
import { Skeleton } from '../kit/Skeleton';
import { PlusIcon } from '../kit/icons';
import { folderNameConflict } from '../folder-name-conflict';
import { inviteRights, teamCan } from './permissions';
import type { PersonalNotes } from './personal-notes';
import type { TeamsRoute } from './route';
import { ShareFromDevice } from './ShareFromDevice';
import type { TeamsStrings } from './strings';
import { TeamNoteRow } from './TeamNoteRow';
import type { TeamsPage } from './useTeams';

/** Which of the team's notes are showing: all, one folder, or those in none. */
type Shelf = { kind: 'all' } | { kind: 'folder'; id: string } | { kind: 'unfiled' };
const ALL: Shelf = { kind: 'all' };

interface TeamOverviewProps {
  strings: TeamsStrings;
  lang: Lang;
  page: TeamsPage;
  team: TeamResponse;
  myUserId: string;
  /** Who is in the team, or null while that is still being asked. */
  members: TeamMember[] | null;
  /** This device's notes, to share from without leaving the team. */
  myNotes: readonly Note[];
  /** Shares one into this team, asking for consent first; `false` if declined. */
  onShare: (note: Note, teamId: string, folderId: string | null) => Promise<boolean>;
  personal: PersonalNotes;
  /** The shortcut for a new note, or null when it has none. */
  addShortcut: string | null;
  /** Sends the reader to the Library, narrowed to this team. */
  onOpenLibrary: (owner: NoteOwner) => void;
  onRoute: (route: TeamsRoute) => void;
}

/**
 * A team's page: its notes, and everything that can be done to them, right here.
 *
 * The notes are this page's whole point. Filed in folders, found by searching,
 * edited, moved or taken back from the row itself; discussed on the note's own
 * page, one click in. A note of one's own can be shared from here too, which is
 * the question a team with nothing in it is actually asking.
 *
 * Nothing needs refreshing. The worker says when a pull brought anything in
 * (`TEAMS_EVENT`), and this reads its cache again; that read is local, so it
 * costs no request and can't flash the list away.
 */
export function TeamOverview({
  strings,
  lang,
  page,
  team,
  myUserId,
  members,
  myNotes,
  onShare,
  personal,
  addShortcut,
  onOpenLibrary,
  onRoute,
}: TeamOverviewProps) {
  const teamId = team.team.id;
  const [snapshot, setSnapshot] = useState<TeamCacheSnapshot | null>(null);
  const [adding, setAdding] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shelf, setShelf] = useState<Shelf>(ALL);
  const [query, setQuery] = useState('');

  // Switching teams starts the page over. Adjusted during render rather than in
  // an effect: there is no async work in it, and an effect would cascade a second
  // render for something this is.
  const [shownTeam, setShownTeam] = useState(teamId);
  if (shownTeam !== teamId) {
    setShownTeam(teamId);
    setSnapshot(null);
    setAdding(false);
    setSharing(false);
    setShelf(ALL);
    setQuery('');
  }

  /** Pulls first, then reads: after a change, what is shown is what the server has. */
  const reload = useCallback(async () => {
    const next = await page.cache(teamId, 'sync', 'notes.reload');
    if (next) setSnapshot(next);
    // `page` is rebuilt on every render of the page above; the team is what
    // decides whose notes these are.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  // The await is inlined rather than calling `reload()`: state set on an
  // effect's synchronous path cascades a render (see `useTeams`).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await page.cache(teamId, 'sync', 'notes.reload');
      if (!cancelled && next) setSnapshot(next);
    })();
    const unsubscribe = page.onEvent((event) => {
      if (event.event !== 'notes' || event.teamId !== teamId) return;
      void page.cache(teamId, 'notes', 'notes.reload').then((next) => {
        if (!cancelled && next) setSnapshot(next);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function createFolder(name: string) {
    const created = await page.run('folders.create', { teamId, name }, 'folders.create');
    if (!created) return;
    setAdding(false);
    await reload();
  }

  async function renameFolder(folderId: string, name: string) {
    if (await page.run('folders.rename', { teamId, folderId, name }, `folder:${folderId}`)) {
      await reload();
    }
  }

  async function deleteFolder(folderId: string) {
    const done = await page.run('folders.delete', { teamId, folderId }, `folder:${folderId}`);
    if (done === null) return;
    setShelf(ALL);
    await reload();
  }

  const folders = useMemo(() => flattenFolderTree(snapshot?.folders ?? []), [snapshot]);
  const knownIds = useMemo(() => new Set(folders.map((f) => f.folder.id)), [folders]);
  const notes = useMemo(() => snapshot?.notes ?? [], [snapshot]);
  const filedIn = notes.map((n) => n.folderId);

  // A folder deleted by someone else while the reader was on it leaves them on
  // everything rather than on a shelf that no longer exists.
  const onShelf: Shelf = shelf.kind === 'folder' && !knownIds.has(shelf.id) ? ALL : shelf;
  const shown = useMemo(() => {
    const wanted = query.trim().toLocaleLowerCase();
    return notes
      .filter((note) => {
        const folder = resolveFolderId(note.folderId, knownIds);
        if (onShelf.kind === 'folder') return folder === onShelf.id;
        if (onShelf.kind === 'unfiled') return folder === null;
        return true;
      })
      .filter(
        (note) =>
          !wanted ||
          note.content.toLocaleLowerCase().includes(wanted) ||
          (note.pageTitle ?? '').toLocaleLowerCase().includes(wanted) ||
          note.originalUrl.toLocaleLowerCase().includes(wanted),
      );
  }, [notes, onShelf, query, knownIds]);

  const nothingYet = snapshot !== null && notes.length === 0;
  const manage = teamCan(team, 'folders.manage');
  const canShare = teamCan(team, 'notes.create');
  const folderOf = onShelf.kind === 'folder' ? onShelf.id : null;
  const chosenFolder = folders.find((f) => f.folder.id === folderOf)?.folder;
  const alone = members !== null && members.length === 1;
  const invite = inviteRights(team).any;

  return (
    <>
      <Section
        title={strings.sharedNotes}
        meta={
          snapshot && (
            <>
              {strings.notesShared(notes.length)} ·{' '}
              {snapshot.syncedAt
                ? strings.syncedAgo(relativeTime(snapshot.syncedAt, lang))
                : strings.neverSynced}
            </>
          )
        }
        actions={
          <>
            <button type="button" className="hm-link" onClick={() => onOpenLibrary({ teamId })}>
              {strings.openInLibrary}
            </button>
            {canShare && !nothingYet && !sharing && (
              <button
                type="button"
                className="hm-btn hm-btn-primary hm-btn--compact"
                onClick={() => setSharing(true)}
              >
                <PlusIcon size={11} />
                {strings.sharePickOpen}
              </button>
            )}
          </>
        }
      >
        {sharing && (
          <ShareFromDevice
            strings={strings}
            addShortcut={addShortcut}
            notes={myNotes}
            onShare={async (note) => {
              const shared = await onShare(note, teamId, folderOf);
              if (shared) await reload();
              return shared;
            }}
            onClose={() => setSharing(false)}
          />
        )}

        {!snapshot ? (
          <Skeleton rows={3} />
        ) : nothingYet && !sharing ? (
          <EmptyState
            size="inline"
            title={strings.emptyNotesTitle(team.team.name)}
            body={
              canShare
                ? strings.emptyNotesBody(team.team.name, addShortcut)
                : strings.emptyNotesReadOnly
            }
            action={
              canShare
                ? { label: strings.sharePickOpen, onClick: () => setSharing(true) }
                : undefined
            }
          />
        ) : nothingYet ? null : (
          <>
            {notes.length > 3 && (
              <input
                type="search"
                className="hm-input hm-team-notes__search"
                placeholder={strings.teamNotesSearch}
                aria-label={strings.teamNotesSearch}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}

            <div className="hm-shelves" role="group" aria-label={strings.teamFolders}>
              <button
                type="button"
                className="hm-owner-filter__pill"
                aria-pressed={onShelf.kind === 'all'}
                onClick={() => setShelf(ALL)}
              >
                {strings.shelfAll(notes.length)}
              </button>
              {folders.map(({ folder }) => (
                <button
                  key={folder.id}
                  type="button"
                  className="hm-owner-filter__pill"
                  aria-pressed={folderOf === folder.id}
                  onClick={() => setShelf({ kind: 'folder', id: folder.id })}
                >
                  <bdi>{folder.name}</bdi> {countInFolder(filedIn, knownIds, folder.id)}
                </button>
              ))}
              {folders.length > 0 && (
                <button
                  type="button"
                  className="hm-owner-filter__pill"
                  aria-pressed={onShelf.kind === 'unfiled'}
                  onClick={() => setShelf({ kind: 'unfiled' })}
                >
                  {strings.unfiledSection} {countInFolder(filedIn, knownIds, null)}
                </button>
              )}
              {chosenFolder && manage && (
                <FolderMenu
                  name={chosenFolder.name}
                  strings={strings}
                  deleteQuestion={strings.deleteTeamFolderConfirm(chosenFolder.name)}
                  working={page.working(`folder:${chosenFolder.id}`)}
                  renameTaken={folders
                    .filter(
                      (f) =>
                        f.folder.parentId === chosenFolder.parentId &&
                        f.folder.id !== chosenFolder.id,
                    )
                    .map((f) => f.folder.name)}
                  onRename={(name) => renameFolder(chosenFolder.id, name)}
                  onDelete={() => deleteFolder(chosenFolder.id)}
                />
              )}
              {manage &&
                (adding ? (
                  <div className="hm-shelves__form">
                    <NameField
                      label={strings.newFolder}
                      placeholder={strings.folderNamePlaceholder}
                      maxLength={FOLDER_NAME_MAX}
                      submitLabel={strings.create}
                      cancelLabel={strings.cancel}
                      busy={page.working('folders.create')}
                      conflict={folderNameConflict(
                        strings,
                        folders.filter((f) => !f.folder.parentId).map((f) => f.folder.name),
                      )}
                      onCancel={() => setAdding(false)}
                      onSubmit={(name) => void createFolder(name)}
                    />
                  </div>
                ) : (
                  <button type="button" className="hm-add" onClick={() => setAdding(true)}>
                    <PlusIcon size={11} />
                    {strings.newFolder}
                  </button>
                ))}
            </div>
            {folderOf && page.failed(`folder:${folderOf}`) && (
              <InlineError>{strings.error(page.failed(`folder:${folderOf}`)!)}</InlineError>
            )}
            {page.failed('folders.create') && (
              <InlineError>{strings.error(page.failed('folders.create')!)}</InlineError>
            )}

            {shown.length === 0 ? (
              <p className="hm-supporting hm-team-notes__none">
                {query.trim()
                  ? strings.teamNotesNoMatches(query.trim())
                  : strings.teamNotesEmptyShelf}
              </p>
            ) : (
              <ul className="hm-team-rows" aria-label={strings.sharedNotes}>
                {shown.map((note) => (
                  <TeamNoteRow
                    key={note.id}
                    strings={strings}
                    lang={lang}
                    page={page}
                    team={team}
                    note={note}
                    folders={folders}
                    members={members}
                    myUserId={myUserId}
                    personal={personal}
                    reload={reload}
                    onOpen={() => onRoute({ page: 'note', teamId, noteId: note.id })}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </Section>

      <Section
        title={strings.whoIsIn(team.team.name)}
        actions={
          <button
            type="button"
            className="hm-link hm-link--accent"
            onClick={() => onRoute({ page: 'members', teamId })}
          >
            {strings.manage}
          </button>
        }
      >
        {alone && invite && <p className="hm-section__intro">{strings.aloneHint}</p>}
        {!members ? (
          <Skeleton rows={1} shape="chips" />
        ) : (
          <ul className="hm-chips">
            {members.map((member) => (
              <li key={member.userId} className="hm-chip">
                <Avatar name={member.displayName} src={member.avatarUrl} seed={member.userId} />
                <span className="hm-chip__name">
                  <bdi>{member.displayName}</bdi>
                  {member.userId === myUserId ? (
                    <span className="hm-chip__meta"> · {strings.youMarker}</span>
                  ) : member.role !== 'member' ? (
                    <span className="hm-chip__meta"> · {strings.role(member.role)}</span>
                  ) : null}
                </span>
              </li>
            ))}
            {invite && (
              <li>
                <button
                  type="button"
                  className="hm-add"
                  onClick={() => onRoute({ page: 'members', teamId })}
                >
                  <PlusIcon size={11} />
                  {strings.inviteSomeone}
                </button>
              </li>
            )}
          </ul>
        )}
      </Section>
    </>
  );
}
