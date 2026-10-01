import { useCallback, useEffect, useState } from 'react';
import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import { FOLDER_NAME_MAX } from '@/domain/folder';
import { countInFolder, flattenFolderTree } from '@/domain/folder-grouping';
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
import { FolderIcon, PlusIcon } from '../kit/icons';
import { inviteRights, teamCan } from './permissions';
import type { TeamsRoute } from './route';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';

interface TeamOverviewProps {
  strings: TeamsStrings;
  lang: Lang;
  page: TeamsPage;
  team: TeamResponse;
  myUserId: string;
  /** Who is in the team, or null while that is still being asked. */
  members: TeamMember[] | null;
  /** Sends the reader to the Library, narrowed to this team or one of its folders. */
  onOpenLibrary: (owner: NoteOwner) => void;
  onRoute: (route: TeamsRoute) => void;
}

/**
 * A team at a glance: how its notes are divided, and who is in it.
 *
 * Deliberately not a list of notes. The Library already lists a team's notes
 * beside the reader's own, with a filter for each team, so this page only says
 * how many there are and where they are filed, and sends the reader there to
 * read them. A second list here was a second thing to keep in step.
 *
 * Folders are tiles, because a folder is a place to go, not a row to read; what
 * can be done to one is in its "⋮" — the same menu a folder in the Library has.
 */
export function TeamOverview({
  strings,
  lang,
  page,
  team,
  myUserId,
  members,
  onOpenLibrary,
  onRoute,
}: TeamOverviewProps) {
  const teamId = team.team.id;
  const [snapshot, setSnapshot] = useState<TeamCacheSnapshot | null>(null);
  const [adding, setAdding] = useState(false);

  // Switching teams starts the tiles over. Adjusted during render rather than
  // in an effect: there is no async work in it, and an effect would cascade a
  // second render for something this is.
  const [shownTeam, setShownTeam] = useState(teamId);
  if (shownTeam !== teamId) {
    setShownTeam(teamId);
    setSnapshot(null);
    setAdding(false);
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
    return () => {
      cancelled = true;
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
    if (done !== null) await reload();
  }

  const folders = flattenFolderTree(snapshot?.folders ?? []);
  const notes = snapshot?.notes ?? [];
  const knownIds = new Set(folders.map((f) => f.folder.id));
  const filedIn = notes.map((n) => n.folderId);
  const nothingYet = snapshot !== null && notes.length === 0 && folders.length === 0;
  const manage = teamCan(team, 'folders.manage');

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
            <button
              type="button"
              className="hm-link"
              disabled={page.working('notes.reload')}
              onClick={() => void reload()}
              aria-busy={page.working('notes.reload')}
            >
              {strings.refreshNotes}
            </button>
            <button
              type="button"
              className="hm-link hm-link--accent"
              onClick={() => onOpenLibrary({ teamId })}
            >
              {strings.openInLibrary}
            </button>
          </>
        }
      >
        {!snapshot ? (
          <Skeleton shape="tiles" />
        ) : nothingYet ? (
          <EmptyState
            size="inline"
            title={strings.emptyNotesTitle(team.team.name)}
            body={strings.emptyNotesBody(team.team.name)}
            action={{ label: strings.goToLibrary, onClick: () => onOpenLibrary({ teamId }) }}
          />
        ) : (
          <ul className="hm-tiles" aria-label={strings.teamFolders}>
            {folders.map(({ folder, parent }) => {
              const key = `folder:${folder.id}`;
              const failed = page.failed(key);
              return (
                <li key={folder.id} className="hm-tile" data-busy={page.working(key) || undefined}>
                  <button
                    type="button"
                    className="hm-tile__open"
                    onClick={() =>
                      onOpenLibrary({ teamId, folder: { id: folder.id, name: folder.name } })
                    }
                  >
                    <span className="hm-tile__name">
                      <FolderIcon size={14} className="hm-tile__glyph" />
                      <bdi>{folder.name}</bdi>
                    </span>
                    <span className="hm-tile__count">
                      {strings.notesShared(countInFolder(filedIn, knownIds, folder.id))}
                      {parent && <> · {strings.folderIn(parent.name)}</>}
                    </span>
                  </button>
                  {manage && (
                    <FolderMenu
                      name={folder.name}
                      strings={strings}
                      deleteQuestion={strings.deleteTeamFolderConfirm(folder.name)}
                      working={page.working(key)}
                      onRename={(name) => renameFolder(folder.id, name)}
                      onDelete={() => deleteFolder(folder.id)}
                    />
                  )}
                  {failed && <InlineError>{strings.error(failed)}</InlineError>}
                </li>
              );
            })}

            {folders.length > 0 && (
              <li className="hm-tile">
                <button
                  type="button"
                  className="hm-tile__open"
                  onClick={() =>
                    onOpenLibrary({ teamId, folder: { id: null, name: strings.unfiledSection } })
                  }
                >
                  <span className="hm-tile__name hm-tile__name--quiet">
                    {strings.unfiledSection}
                  </span>
                  <span className="hm-tile__count">
                    {strings.notesShared(countInFolder(filedIn, knownIds, null))}
                  </span>
                </button>
              </li>
            )}

            {manage && (
              <li className="hm-tile hm-tile--add">
                {adding ? (
                  <div className="hm-tile__form">
                    <NameField
                      label={strings.newFolder}
                      placeholder={strings.folderNamePlaceholder}
                      maxLength={FOLDER_NAME_MAX}
                      submitLabel={strings.create}
                      cancelLabel={strings.cancel}
                      busy={page.working('folders.create')}
                      onCancel={() => setAdding(false)}
                      onSubmit={(name) => void createFolder(name)}
                    />
                  </div>
                ) : (
                  <button type="button" className="hm-tile__add" onClick={() => setAdding(true)}>
                    <PlusIcon size={11} />
                    {strings.newFolder}
                  </button>
                )}
              </li>
            )}
          </ul>
        )}
        {page.failed('folders.create') && (
          <InlineError>{strings.error(page.failed('folders.create')!)}</InlineError>
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
            {inviteRights(team).any && (
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
