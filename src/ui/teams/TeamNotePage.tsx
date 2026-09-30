import { useCallback, useEffect, useState } from 'react';
import type { TeamAction, TeamMember, TeamResponse } from '@hamesh/teams-contract';
import type { CachedTeamNote } from '@/teams/page-cache';
import type { TeamCacheSnapshot } from '@/teams/messages';
import { extractDomain } from '@/domain/notes-grouping';
import type { Lang } from '../i18n';
import { relativeTime } from '../i18n';
import { MarginMark } from '../MarginMark';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import type { PersonalNotes } from './personal-notes';
import { InlineConfirm } from './InlineConfirm';
import { CommentThread } from './CommentThread';
import { flattenFolders } from './folders';
import type { TeamsRoute } from './route';
import { TeamsBreadcrumb } from './TeamsBreadcrumb';

interface TeamNotePageProps {
  strings: TeamsStrings;
  lang: Lang;
  page: TeamsPage;
  team: TeamResponse;
  myUserId: string;
  /** Who is in the team — what turns the ids in a comment into names. */
  members: TeamMember[] | null;
  noteId: string;
  personal: PersonalNotes;
  /** Back to the team's overview, once the note is no longer here to show. */
  onGone: () => void;
  onRoute: (route: TeamsRoute) => void;
}

/** What is waiting to be confirmed for this note. */
type Asking = 'delete' | 'unshare';

/**
 * One shared note: what it says, what can be done to it, and what has been said
 * about it.
 *
 * The Library lists a team's notes, and this is the only other place one is
 * looked at — because this is where a note is discussed, edited, filed, taken
 * back or deleted for everyone. Which of those appear is decided by the
 * capabilities the server sent with the team, and the server checks each
 * request again regardless.
 *
 * The note comes from the copy this device already holds; opening the page asks
 * the server for the team's changes, never for a page or a URL.
 */
export function TeamNotePage({
  strings,
  lang,
  page,
  team,
  myUserId,
  members,
  noteId,
  personal,
  onGone,
  onRoute,
}: TeamNotePageProps) {
  const teamId = team.team.id;
  const can = (action: TeamAction) => team.capabilities.includes(action);
  const [snapshot, setSnapshot] = useState<TeamCacheSnapshot | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);

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

  const note: CachedTeamNote | undefined = snapshot?.notes.find((n) => n.id === noteId);
  const key = `note:${noteId}`;
  const working = page.working(key);
  const failed = page.failed(key);

  const mine = note?.authorId === myUserId;
  const mayEdit = can('notes.edit_any') || (mine && can('notes.edit_own'));
  const mayFile = can('notes.file_any') || (mine && can('notes.file_own'));
  const mayDelete = can('notes.delete_any') || (mine && can('notes.delete_own'));
  const mayUnshare = mine && can('notes.unshare_own');

  async function move(to: string | null) {
    if (!note) return;
    await page.run('notes.update', { teamId, noteId, version: note.version, folderId: to }, key);
    // A refused edit (someone else got there first) is reported beside the
    // note; either way what is shown afterwards is the server's version.
    await reload();
  }

  async function saveEdit() {
    if (!note || editing === null) return;
    const content = editing.trim();
    setEditing(null);
    if (!content || content === note.content) return;
    await page.run('notes.update', { teamId, noteId, version: note.version, content }, key);
    await reload();
  }

  async function unshare() {
    const result = await page.run('notes.unshare', { teamId, noteId }, key);
    setAsking(null);
    if (!result) return;
    // Handed back, so it is kept: the note becomes a personal one again rather
    // than disappearing along with the team's copy.
    await personal.keep(result.note);
    onGone();
  }

  async function remove() {
    const gone = await page.run('notes.delete', { teamId, noteId }, key);
    setAsking(null);
    if (gone !== null) onGone();
  }

  /** The trail back. What the last step says is the note itself once it is known. */
  const trail = (last: string) => (
    <TeamsBreadcrumb
      strings={strings}
      items={[
        { label: strings.teams, onClick: () => onRoute({ page: 'overview', teamId: null }) },
        { label: team.team.name, onClick: () => onRoute({ page: 'overview', teamId }) },
        { label: last },
      ]}
    />
  );

  if (!snapshot) {
    return (
      <>
        {trail(strings.sharedNotes)}
        <div className="hm-skeleton" aria-hidden="true">
          <div className="hm-skeleton__row" />
          <div className="hm-skeleton__row" />
        </div>
      </>
    );
  }

  if (!note) {
    return (
      <>
        {trail(strings.sharedNotes)}
        <div className="hm-empty hm-fade-in">
          <MarginMark size={28} strokeWidth={3} />
          <p className="hm-empty__title">{strings.noteGoneTitle}</p>
          <p className="hm-empty__body">{strings.noteGoneBody}</p>
          <button type="button" className="hm-btn hm-btn-primary hm-empty__action" onClick={onGone}>
            {strings.backToTeam(team.team.name)}
          </button>
        </div>
      </>
    );
  }

  const folders = flattenFolders(snapshot.folders);
  const folderIds = new Set(folders.map((f) => f.folder.id));

  return (
    <>
      {trail(note.pageTitle || extractDomain(note.originalUrl))}
      <article className="hm-section hm-team-note" data-working={working || undefined}>
        <div className="hm-team-note__head">
          <a
            className="hm-link hm-team-note__page"
            href={note.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={strings.openPage}
          >
            <bdi>{note.pageTitle || extractDomain(note.originalUrl)}</bdi>
          </a>
          <span className="hm-team-note__domain">{extractDomain(note.originalUrl)}</span>
          <span className="hm-section__spacer" />
          <span className="hm-section__meta">
            {strings.noteEdited(relativeTime(new Date(note.updatedAt).toISOString(), lang))}
          </span>
        </div>

        {editing !== null ? (
          <textarea
            className="hm-textarea"
            dir="auto"
            autoFocus
            aria-label={strings.editNote}
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
          />
        ) : (
          <p className="hm-team-note__body" dir="auto">
            {note.content}
          </p>
        )}

        {failed && (
          <p className="hm-field-error" role="alert">
            {strings.error(failed)}
          </p>
        )}

        {asking === 'delete' ? (
          <InlineConfirm
            strings={strings}
            question={strings.deleteSharedConfirm}
            confirmLabel={strings.deleteSharedNote}
            working={working}
            onConfirm={() => void remove()}
            onCancel={() => setAsking(null)}
          />
        ) : asking === 'unshare' ? (
          <InlineConfirm
            strings={strings}
            question={strings.unshareConfirm}
            confirmLabel={strings.unshareNote}
            tone="plain"
            working={working}
            onConfirm={() => void unshare()}
            onCancel={() => setAsking(null)}
          />
        ) : editing !== null ? (
          <div className="hm-team-note__actions">
            <button type="button" className="hm-btn hm-btn-ghost" onClick={() => setEditing(null)}>
              {strings.cancel}
            </button>
            <button
              type="button"
              className="hm-btn hm-btn-primary"
              disabled={working}
              onClick={() => void saveEdit()}
              aria-busy={working}
            >
              {strings.saveNote}
            </button>
          </div>
        ) : working ? (
          <span className="hm-spinner" role="status" aria-label={strings.working} />
        ) : (
          <div className="hm-team-note__actions">
            {mayFile && folders.length > 0 && (
              <label className="hm-team-note__move">
                <span className="hm-visually-hidden">{strings.moveToFolder}</span>
                <select
                  className="hm-input hm-input--select"
                  value={note.folderId && folderIds.has(note.folderId) ? note.folderId : ''}
                  onChange={(e) => void move(e.target.value || null)}
                >
                  <option value="">{strings.noFolderOption}</option>
                  {folders.map(({ folder, depth }) => (
                    <option key={folder.id} value={folder.id}>
                      {' '.repeat(depth * 2)}
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span className="hm-section__spacer" />
            {mayEdit && (
              <button type="button" className="hm-link" onClick={() => setEditing(note.content)}>
                {strings.editNote}
              </button>
            )}
            {mayUnshare && (
              <button type="button" className="hm-link" onClick={() => setAsking('unshare')}>
                {strings.unshareNote}
              </button>
            )}
            {mayDelete && (
              <button
                type="button"
                className="hm-link hm-link--danger"
                onClick={() => setAsking('delete')}
              >
                {strings.deleteSharedNote}
              </button>
            )}
          </div>
        )}
      </article>

      <h2 className="hm-subheading">{strings.comments}</h2>
      <CommentThread
        strings={strings}
        lang={lang}
        page={page}
        team={team}
        noteId={noteId}
        myUserId={myUserId}
        members={members}
      />
    </>
  );
}
