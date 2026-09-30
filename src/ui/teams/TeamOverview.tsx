import { useCallback, useEffect, useState } from 'react';
import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import type { TeamCacheSnapshot } from '@/teams/messages';
import type { Lang } from '../i18n';
import { relativeTime } from '../i18n';
import { MarginMark } from '../MarginMark';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import type { NoteOwner } from './NoteFilter';
import type { TeamsRoute } from './route';
import { InlineConfirm } from './InlineConfirm';
import { countInFolder, flattenFolders } from './folders';

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

/** What is waiting to be confirmed, and on which folder. */
type Asking = { kind: 'delete'; id: string };

/**
 * A team at a glance: how its notes are divided, and who is in it.
 *
 * Deliberately not a list of notes. The Library already lists a team's notes
 * beside the reader's own, with a filter for each team, so this page only says
 * how many there are and where they are filed, and sends the reader there to
 * read them. A second list here was a second thing to keep in step.
 *
 * Folders are tiles, because a folder is a place to go, not a row to read; what
 * can be done to one (rename, delete) waits until the tile is reached for.
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
  const can = (action: string) => team.capabilities.includes(action as never);
  const [snapshot, setSnapshot] = useState<TeamCacheSnapshot | null>(null);
  const [adding, setAdding] = useState(false);
  const [newFolder, setNewFolder] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);

  // Switching teams starts the tiles over. Adjusted during render rather than
  // in an effect: there is no async work in it, and an effect would cascade a
  // second render for something this is.
  const [shownTeam, setShownTeam] = useState(teamId);
  if (shownTeam !== teamId) {
    setShownTeam(teamId);
    setSnapshot(null);
    setAdding(false);
    setRenaming(null);
    setAsking(null);
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
    (async () => {
      const next = await page.cache(teamId, 'sync', 'notes.reload');
      if (!cancelled && next) setSnapshot(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    const name = newFolder.trim();
    if (!name) return;
    const created = await page.run('folders.create', { teamId, name }, 'folders.create');
    if (!created) return;
    setNewFolder('');
    setAdding(false);
    await reload();
  }

  async function renameFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    const done = await page.run(
      'folders.rename',
      { teamId, folderId: renaming.id, name: renaming.name },
      `folder:${renaming.id}`,
    );
    setRenaming(null);
    if (done) await reload();
  }

  async function deleteFolder(id: string) {
    const done = await page.run('folders.delete', { teamId, folderId: id }, `folder:${id}`);
    setAsking(null);
    if (done !== null) await reload();
  }

  const folders = flattenFolders(snapshot?.folders ?? []);
  const notes = snapshot?.notes ?? [];
  const nothingYet = snapshot !== null && notes.length === 0 && folders.length === 0;
  const canInvite = can('invites.create_member') || can('invites.create_admin');

  return (
    <>
      <section className="hm-section" aria-labelledby="hm-team-notes-title">
        <header className="hm-section__head">
          <h2 className="hm-section__title" id="hm-team-notes-title">
            {strings.sharedNotes}
          </h2>
          {snapshot && (
            <span className="hm-section__meta">
              {strings.notesShared(notes.length)} ·{' '}
              {snapshot.syncedAt
                ? strings.syncedAgo(relativeTime(new Date(snapshot.syncedAt).toISOString(), lang))
                : strings.neverSynced}
            </span>
          )}
          <span className="hm-section__spacer" />
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
        </header>

        {!snapshot ? (
          <div className="hm-skeleton hm-skeleton--tiles" aria-hidden="true">
            <div className="hm-skeleton__row" />
            <div className="hm-skeleton__row" />
            <div className="hm-skeleton__row" />
          </div>
        ) : nothingYet ? (
          <div className="hm-empty hm-empty--inline hm-fade-in">
            <MarginMark size={28} strokeWidth={3} />
            <p className="hm-empty__title">{strings.emptyNotesTitle(team.team.name)}</p>
            <p className="hm-empty__body">{strings.emptyNotesBody(team.team.name)}</p>
            <button
              type="button"
              className="hm-btn hm-btn-primary hm-empty__action"
              onClick={() => onOpenLibrary({ teamId })}
            >
              {strings.goToLibrary}
            </button>
          </div>
        ) : (
          <ul className="hm-tiles" aria-label={strings.teamFolders}>
            {folders.map(({ folder, parent }) => {
              const key = `folder:${folder.id}`;
              const failed = page.failed(key);
              const count = countInFolder(notes, folders, folder.id);
              return (
                <li key={folder.id} className="hm-tile" data-busy={page.working(key) || undefined}>
                  {renaming?.id === folder.id ? (
                    <form className="hm-tile__form" onSubmit={renameFolder}>
                      <input
                        type="text"
                        required
                        autoFocus
                        className="hm-input"
                        aria-label={strings.renameFolder}
                        value={renaming.name}
                        onChange={(e) => setRenaming({ id: folder.id, name: e.target.value })}
                      />
                      <span className="hm-tile__form-actions">
                        <button type="submit" className="hm-btn hm-btn-ghost">
                          {strings.rename}
                        </button>
                        <button
                          type="button"
                          className="hm-btn hm-btn-ghost"
                          onClick={() => setRenaming(null)}
                        >
                          {strings.cancel}
                        </button>
                      </span>
                    </form>
                  ) : asking?.kind === 'delete' && asking.id === folder.id ? (
                    <InlineConfirm
                      strings={strings}
                      question={strings.deleteFolderConfirm(folder.name)}
                      confirmLabel={strings.deleteFolder}
                      working={page.working(key)}
                      onConfirm={() => void deleteFolder(folder.id)}
                      onCancel={() => setAsking(null)}
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        className="hm-tile__open"
                        onClick={() =>
                          onOpenLibrary({ teamId, folder: { id: folder.id, name: folder.name } })
                        }
                      >
                        <span className="hm-tile__name">
                          <FolderGlyph />
                          <bdi>{folder.name}</bdi>
                        </span>
                        <span className="hm-tile__count">
                          {strings.notesShared(count)}
                          {parent && <> · {strings.folderIn(parent.name)}</>}
                        </span>
                      </button>
                      {can('folders.manage') && (
                        <span className="hm-tile__actions">
                          <button
                            type="button"
                            className="hm-link"
                            onClick={() => setRenaming({ id: folder.id, name: folder.name })}
                          >
                            {strings.renameFolder}
                          </button>
                          <button
                            type="button"
                            className="hm-link hm-link--danger"
                            onClick={() => setAsking({ kind: 'delete', id: folder.id })}
                          >
                            {strings.deleteFolder}
                          </button>
                        </span>
                      )}
                    </>
                  )}
                  {failed && (
                    <p className="hm-field-error" role="alert">
                      {strings.error(failed)}
                    </p>
                  )}
                </li>
              );
            })}

            {folders.length > 0 && (
              <li className="hm-tile">
                <button
                  type="button"
                  className="hm-tile__open"
                  onClick={() =>
                    onOpenLibrary({ teamId, folder: { id: null, name: strings.unfiled } })
                  }
                >
                  <span className="hm-tile__name hm-tile__name--quiet">{strings.unfiled}</span>
                  <span className="hm-tile__count">
                    {strings.notesShared(countInFolder(notes, folders, null))}
                  </span>
                </button>
              </li>
            )}

            {can('folders.manage') && (
              <li className="hm-tile hm-tile--add">
                {adding ? (
                  <form className="hm-tile__form" onSubmit={createFolder}>
                    <input
                      type="text"
                      required
                      autoFocus
                      className="hm-input"
                      placeholder={strings.folderNamePlaceholder}
                      aria-label={strings.newTeamFolder}
                      value={newFolder}
                      onChange={(e) => setNewFolder(e.target.value)}
                    />
                    <span className="hm-tile__form-actions">
                      <button
                        type="submit"
                        className="hm-btn hm-btn-primary"
                        disabled={page.working('folders.create')}
                        aria-busy={page.working('folders.create')}
                      >
                        {strings.create}
                      </button>
                      <button
                        type="button"
                        className="hm-btn hm-btn-ghost"
                        onClick={() => setAdding(false)}
                      >
                        {strings.cancel}
                      </button>
                    </span>
                  </form>
                ) : (
                  <button type="button" className="hm-tile__add" onClick={() => setAdding(true)}>
                    + {strings.newTeamFolder}
                  </button>
                )}
              </li>
            )}
          </ul>
        )}
        {page.failed('folders.create') && (
          <p className="hm-field-error" role="alert">
            {strings.error(page.failed('folders.create')!)}
          </p>
        )}
      </section>

      <section className="hm-section" aria-labelledby="hm-team-people-title">
        <header className="hm-section__head">
          <h2 className="hm-section__title" id="hm-team-people-title">
            {strings.whoIsIn(team.team.name)}
          </h2>
          <span className="hm-section__spacer" />
          <button
            type="button"
            className="hm-link hm-link--accent"
            onClick={() => onRoute({ page: 'members', teamId })}
          >
            {strings.manage}
          </button>
        </header>
        {!members ? (
          <div className="hm-skeleton hm-skeleton--chips" aria-hidden="true">
            <div className="hm-skeleton__row" />
          </div>
        ) : (
          <ul className="hm-chips">
            {members.map((member) => (
              <li key={member.userId} className="hm-chip">
                <span className="hm-avatar" aria-hidden="true">
                  {member.displayName.slice(0, 1).toUpperCase()}
                </span>
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
            {canInvite && (
              <li>
                <button
                  type="button"
                  className="hm-chip hm-chip--add"
                  onClick={() => onRoute({ page: 'members', teamId })}
                >
                  + {strings.inviteSomeone}
                </button>
              </li>
            )}
          </ul>
        )}
      </section>
    </>
  );
}

/** A folder outline, the same one the Library's folder view draws. */
function FolderGlyph() {
  return (
    <svg
      className="hm-tile__glyph"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <path d="M1.8 4.2c0-.7.6-1.2 1.2-1.2h2.6l1.3 1.6h5.1c.7 0 1.2.5 1.2 1.2v6c0 .7-.5 1.2-1.2 1.2H3c-.6 0-1.2-.5-1.2-1.2z" />
    </svg>
  );
}
