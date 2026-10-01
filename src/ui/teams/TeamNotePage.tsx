import { useCallback, useEffect, useState } from 'react';
import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import { flattenFolderTree, resolveFolderId } from '@/domain/folder-grouping';
import { extractDomain, pageLabelFrom } from '@/domain/notes-grouping';
import type { TeamCacheSnapshot } from '@/teams/messages';
import type { CachedTeamNote } from '@/teams/page-cache';
import { FolderSelect } from '../FolderSelect';
import { relativeTime } from '../format';
import { getStrings, type Lang } from '../i18n';
import { Breadcrumb } from '../kit/Breadcrumb';
import { EmptyState } from '../kit/EmptyState';
import { Busy, InlineError } from '../kit/Feedback';
import { InlineConfirm } from '../kit/InlineConfirm';
import { Skeleton } from '../kit/Skeleton';
import { NoteEditor } from '../NoteEditor';
import { CommentThread } from './CommentThread';
import { noteRights } from './permissions';
import type { PersonalNotes } from './personal-notes';
import type { TeamsRoute } from './route';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';

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
 * capabilities the server sent with the team (`noteRights`), and the server
 * checks each request again regardless.
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
  const [snapshot, setSnapshot] = useState<TeamCacheSnapshot | null>(null);
  const [editing, setEditing] = useState(false);
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
    void (async () => {
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
  const may = noteRights(team, note?.authorId ?? null, myUserId);

  async function move(to: string | null) {
    if (!note) return;
    await page.run('notes.update', { teamId, noteId, version: note.version, folderId: to }, key);
    // A refused edit (someone else got there first) is reported beside the
    // note; either way what is shown afterwards is the server's version.
    await reload();
  }

  async function saveEdit(content: string) {
    if (!note) return;
    setEditing(false);
    if (content === note.content) return;
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
    <Breadcrumb
      label={strings.breadcrumb}
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
        <Skeleton rows={2} />
      </>
    );
  }

  if (!note) {
    return (
      <>
        {trail(strings.sharedNotes)}
        <EmptyState
          title={strings.noteGoneTitle}
          body={strings.noteGoneBody}
          action={{ label: strings.backToTeam(team.team.name), onClick: onGone }}
        />
      </>
    );
  }

  const label = pageLabelFrom(note.pageTitle, note.originalUrl);
  const folders = flattenFolderTree(snapshot.folders);
  const folderIds = new Set(folders.map((f) => f.folder.id));

  return (
    <>
      {trail(label)}
      <article className="hm-section hm-team-note" data-working={working || undefined}>
        <div className="hm-team-note__head">
          <a
            className="hm-link hm-link--accent hm-team-note__page"
            href={note.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={strings.openPage}
          >
            <bdi>{label}</bdi>
          </a>
          <span className="hm-team-note__domain">{extractDomain(note.originalUrl)}</span>
          <span className="hm-team-note__meta">
            {strings.editedAgo(relativeTime(note.updatedAt, lang))}
          </span>
        </div>

        {editing ? (
          <NoteEditor
            strings={getStrings(lang)}
            initial={note.content}
            label={strings.edit}
            saveLabel={strings.save}
            saving={working}
            onCancel={() => setEditing(false)}
            onSave={(content) => void saveEdit(content)}
          />
        ) : (
          <p className="hm-team-note__body hm-prose" dir="auto">
            {note.content}
          </p>
        )}

        {failed && <InlineError>{strings.error(failed)}</InlineError>}

        {asking === 'delete' ? (
          <InlineConfirm
            question={strings.deleteSharedConfirm}
            confirmLabel={strings.delete}
            cancelLabel={strings.keepIt}
            working={working}
            onConfirm={() => void remove()}
            onCancel={() => setAsking(null)}
          />
        ) : asking === 'unshare' ? (
          <InlineConfirm
            question={strings.unshareConfirm}
            confirmLabel={strings.unshareNote}
            cancelLabel={strings.keepIt}
            tone="plain"
            working={working}
            onConfirm={() => void unshare()}
            onCancel={() => setAsking(null)}
          />
        ) : editing ? null : working ? (
          <Busy label={strings.working} />
        ) : (
          <div className="hm-team-note__actions">
            {may.file && folders.length > 0 && (
              <FolderSelect
                folders={folders}
                value={resolveFolderId(note.folderId, folderIds)}
                label={strings.moveToFolder}
                noneLabel={strings.noFolderOption}
                className="hm-team-note__move"
                onChange={(to) => void move(to)}
              />
            )}
            <span className="hm-team-note__spacer" />
            {may.edit && (
              <button type="button" className="hm-link" onClick={() => setEditing(true)}>
                {strings.edit}
              </button>
            )}
            {may.unshare && (
              <button type="button" className="hm-link" onClick={() => setAsking('unshare')}>
                {strings.unshareNote}
              </button>
            )}
            {may.delete && (
              <button
                type="button"
                className="hm-link hm-link--danger"
                onClick={() => setAsking('delete')}
              >
                {strings.delete}
              </button>
            )}
          </div>
        )}
      </article>

      <h2 className="hm-overline hm-team-note__comments-title">{strings.comments}</h2>
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
