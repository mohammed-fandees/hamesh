import { useCallback, useEffect, useState } from 'react';
import type { TeamAction, TeamMember, TeamResponse } from '@hamesh/teams-contract';
import type { CachedTeamNote } from '@/teams/page-cache';
import type { TeamCacheSnapshot } from '@/teams/messages';
import type { CachedFolder } from '@/teams/sync-store';
import { extractDomain } from '@/domain/notes-grouping';
import type { Lang } from '../i18n';
import { relativeTime } from '../i18n';
import { MarginMark } from '../MarginMark';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import type { PersonalNotes } from './personal-notes';
import { InlineConfirm } from './InlineConfirm';
import { CommentThread } from './CommentThread';

interface TeamNotesProps {
  strings: TeamsStrings;
  lang: Lang;
  page: TeamsPage;
  team: TeamResponse;
  myUserId: string;
  /** Who is in the team — what turns the ids in a comment into names. */
  members: TeamMember[] | null;
  personal: PersonalNotes;
  /** Sends the reader to the Library, which is where a note is shared from. */
  onOpenLibrary: () => void;
}

/** A folder and how deep it sits, for a flat list that reads as a tree. */
function flatten(folders: readonly CachedFolder[]): { folder: CachedFolder; depth: number }[] {
  const byParent = new Map<string | null, CachedFolder[]>();
  for (const folder of folders) {
    const bucket = byParent.get(folder.parentId);
    if (bucket) bucket.push(folder);
    else byParent.set(folder.parentId, [folder]);
  }
  const out: { folder: CachedFolder; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    const children = [...(byParent.get(parentId) ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const folder of children) {
      // Never trust a parent chain: a cycle would otherwise recurse forever.
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      out.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  // A folder whose parent is missing (or part of a cycle) would be lost above,
  // so anything left over is shown at the top rather than hidden.
  for (const folder of folders) {
    if (!seen.has(folder.id)) out.push({ folder, depth: 0 });
  }
  return out;
}

/** What is waiting to be confirmed, and on which row. */
type Pending =
  { kind: 'note'; id: string } | { kind: 'unshare'; id: string } | { kind: 'folder'; id: string };

/** The rail's selection: everything, one folder, or the notes in none. */
const UNFILED = '\u0000unfiled';

/**
 * What this team has shared, and the folders it files them in.
 *
 * Everything shown here comes from the copy this device already holds — the
 * background worker pulls a team's changes and keeps them (see
 * `teams/sync.ts`), so opening this page asks the server for the team's
 * changes, never for a page or a URL. Which controls appear is decided by the
 * capabilities the server sent with the team, and the server checks each
 * request again regardless.
 *
 * Notes are read on the pages they belong to, and in the Library beside the
 * reader's own. This is where they are organised, taken back, or removed for
 * everyone — and where a note's discussion opens.
 */
export function TeamNotes({
  strings,
  lang,
  page,
  team,
  myUserId,
  members,
  personal,
  onOpenLibrary,
}: TeamNotesProps) {
  const [snapshot, setSnapshot] = useState<TeamCacheSnapshot | null>(null);
  const [newFolder, setNewFolder] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [confirming, setConfirming] = useState<Pending | null>(null);
  /** The one note whose discussion is open, if any. */
  const [discussing, setDiscussing] = useState<string | null>(null);
  /** Which folder the list is showing; null is everything. */
  const [folderId, setFolderId] = useState<string | null>(null);
  const teamId = team.team.id;
  const can = (action: TeamAction) => team.capabilities.includes(action);

  // Switching teams starts the rail and any open discussion over. Adjusted
  // during render rather than in an effect (React's own "adjusting state when a
  // prop changes"): there is no async work here, and an effect would cascade a
  // second render for something this is.
  const [shownTeam, setShownTeam] = useState(teamId);
  if (shownTeam !== teamId) {
    setShownTeam(teamId);
    setFolderId(null);
    setDiscussing(null);
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

  const mine = (note: CachedTeamNote) => note.authorId === myUserId;
  const mayEdit = (note: CachedTeamNote) =>
    can('notes.edit_any') || (mine(note) && can('notes.edit_own'));
  const mayFile = (note: CachedTeamNote) =>
    can('notes.file_any') || (mine(note) && can('notes.file_own'));
  const mayDelete = (note: CachedTeamNote) =>
    can('notes.delete_any') || (mine(note) && can('notes.delete_own'));
  const mayUnshare = (note: CachedTeamNote) => mine(note) && can('notes.unshare_own');

  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    const name = newFolder.trim();
    if (!name) return;
    const created = await page.run('folders.create', { teamId, name }, 'folders.create');
    if (!created) return;
    setNewFolder('');
    setAddingFolder(false);
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

  async function deleteFolder(folder: CachedFolder) {
    const done = await page.run(
      'folders.delete',
      { teamId, folderId: folder.id },
      `folder:${folder.id}`,
    );
    setConfirming(null);
    if (done !== null) {
      if (folderId === folder.id) setFolderId(null);
      await reload();
    }
  }

  async function move(note: CachedTeamNote, to: string | null) {
    await page.run(
      'notes.update',
      { teamId, noteId: note.id, version: note.version, folderId: to },
      `note:${note.id}`,
    );
    // A refused edit (someone else got there first) is reported on the row
    // itself; either way what is shown afterwards is the server's version.
    await reload();
  }

  async function saveEdit(note: CachedTeamNote) {
    if (!editing) return;
    const content = editing.content.trim();
    setEditing(null);
    if (!content || content === note.content) return;
    await page.run(
      'notes.update',
      { teamId, noteId: note.id, version: note.version, content },
      `note:${note.id}`,
    );
    await reload();
  }

  async function unshare(note: CachedTeamNote) {
    const result = await page.run('notes.unshare', { teamId, noteId: note.id }, `note:${note.id}`);
    setConfirming(null);
    if (!result) return;
    // Handed back, so it is kept: the note becomes a personal one again rather
    // than disappearing along with the team's copy.
    await personal.keep(result.note);
    await reload();
  }

  async function remove(note: CachedTeamNote) {
    const gone = await page.run('notes.delete', { teamId, noteId: note.id }, `note:${note.id}`);
    setConfirming(null);
    if (gone !== null) await reload();
  }

  const folders = flatten(snapshot?.folders ?? []);
  const notes = snapshot?.notes ?? [];
  const folderIds = new Set(folders.map((f) => f.folder.id));
  const unfiled = (note: CachedTeamNote) => !note.folderId || !folderIds.has(note.folderId);
  const countIn = (id: string | null) =>
    notes.filter((n) => (id === null ? unfiled(n) : n.folderId === id)).length;
  const shown =
    folderId === null
      ? notes
      : notes.filter((n) => (folderId === UNFILED ? unfiled(n) : n.folderId === folderId));

  function noteRow(note: CachedTeamNote) {
    const key = `note:${note.id}`;
    const working = page.working(key);
    const failed = page.failed(key);
    const isEditing = editing?.id === note.id;
    return (
      <li key={note.id} className="hm-team-note">
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
          <span className="hm-team-note__spacer" />
          <span className="hm-team-member__meta">
            {strings.noteEdited(relativeTime(new Date(note.updatedAt).toISOString(), lang))}
          </span>
        </div>

        {isEditing ? (
          <textarea
            className="hm-textarea"
            dir="auto"
            autoFocus
            aria-label={strings.editNote}
            value={editing.content}
            onChange={(e) => setEditing({ id: note.id, content: e.target.value })}
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

        {confirming?.kind === 'note' && confirming.id === note.id ? (
          <InlineConfirm
            strings={strings}
            question={strings.deleteSharedConfirm}
            confirmLabel={strings.deleteSharedNote}
            working={working}
            onConfirm={() => void remove(note)}
            onCancel={() => setConfirming(null)}
          />
        ) : confirming?.kind === 'unshare' && confirming.id === note.id ? (
          <InlineConfirm
            strings={strings}
            question={strings.unshareConfirm}
            confirmLabel={strings.unshareNote}
            tone="plain"
            working={working}
            onConfirm={() => void unshare(note)}
            onCancel={() => setConfirming(null)}
          />
        ) : isEditing ? (
          <div className="hm-team-note__actions">
            <button type="button" className="hm-btn hm-btn-ghost" onClick={() => setEditing(null)}>
              {strings.cancel}
            </button>
            <button
              type="button"
              className="hm-btn hm-btn-primary"
              disabled={working}
              onClick={() => void saveEdit(note)}
            >
              {working ? strings.working : strings.saveNote}
            </button>
          </div>
        ) : working ? (
          <p className="hm-team-member__meta" role="status">
            {strings.working}
          </p>
        ) : (
          <div className="hm-team-note__actions">
            <button
              type="button"
              className="hm-link"
              aria-expanded={discussing === note.id}
              onClick={() => setDiscussing(discussing === note.id ? null : note.id)}
            >
              {discussing === note.id ? strings.hideComments : strings.discuss}
            </button>
            <span className="hm-team-note__spacer" />
            {mayFile(note) && folders.length > 0 && (
              <label className="hm-team-note__move">
                <span className="hm-visually-hidden">{strings.moveToFolder}</span>
                <select
                  className="hm-input hm-input--select"
                  value={note.folderId && folderIds.has(note.folderId) ? note.folderId : ''}
                  onChange={(e) => void move(note, e.target.value || null)}
                >
                  <option value="">{strings.noFolderOption}</option>
                  {folders.map(({ folder, depth }) => (
                    <option key={folder.id} value={folder.id}>
                      {' '.repeat(depth * 2)}
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {mayEdit(note) && (
              <button
                type="button"
                className="hm-link"
                onClick={() => setEditing({ id: note.id, content: note.content })}
              >
                {strings.editNote}
              </button>
            )}
            {mayUnshare(note) && (
              <button
                type="button"
                className="hm-link"
                onClick={() => setConfirming({ kind: 'unshare', id: note.id })}
              >
                {strings.unshareNote}
              </button>
            )}
            {mayDelete(note) && (
              <button
                type="button"
                className="hm-link hm-link--danger"
                onClick={() => setConfirming({ kind: 'note', id: note.id })}
              >
                {strings.deleteSharedNote}
              </button>
            )}
          </div>
        )}

        {discussing === note.id && (
          <div className="hm-team-note__discussion">
            <CommentThread
              strings={strings}
              lang={lang}
              page={page}
              team={team}
              noteId={note.id}
              myUserId={myUserId}
              members={members}
            />
          </div>
        )}
      </li>
    );
  }

  if (!snapshot) {
    return (
      <div className="hm-skeleton" aria-hidden="true">
        <div className="hm-skeleton__row" />
        <div className="hm-skeleton__row" />
        <div className="hm-skeleton__row" />
      </div>
    );
  }

  return (
    <section className="hm-workspace">
      <header className="hm-workspace__head">
        <h2 className="hm-workspace__title">{strings.sharedNotes}</h2>
        <span className="hm-team-member__meta">
          {strings.notesShared(notes.length)} ·{' '}
          {snapshot.syncedAt
            ? strings.syncedAgo(relativeTime(new Date(snapshot.syncedAt).toISOString(), lang))
            : strings.neverSynced}
        </span>
        <span className="hm-team-note__spacer" />
        <button
          type="button"
          className="hm-link"
          disabled={page.working('notes.reload')}
          onClick={() => void reload()}
        >
          {page.working('notes.reload') ? strings.working : strings.refreshNotes}
        </button>
      </header>

      {notes.length === 0 && folders.length === 0 ? (
        <div className="hm-empty hm-fade-in">
          <MarginMark size={28} strokeWidth={3} />
          <p className="hm-empty__title">{strings.emptyNotesTitle(team.team.name)}</p>
          <p className="hm-empty__body">{strings.emptyNotesBody(team.team.name)}</p>
          <button
            type="button"
            className="hm-btn hm-btn-primary hm-empty__action"
            onClick={onOpenLibrary}
          >
            {strings.goToLibrary}
          </button>
        </div>
      ) : (
        <div className="hm-workspace__split">
          <aside className="hm-folder-rail" aria-label={strings.teamFolders}>
            <button
              type="button"
              className="hm-folder-rail__item"
              aria-current={folderId === null ? 'true' : undefined}
              onClick={() => setFolderId(null)}
            >
              <span>{strings.filterEverything}</span>
              <span className="hm-folder-rail__count">{notes.length}</span>
            </button>

            {folders.map(({ folder, depth }) => {
              const failed = page.failed(`folder:${folder.id}`);
              return (
                <div key={folder.id} className="hm-folder-rail__row">
                  {renaming?.id === folder.id ? (
                    <form className="hm-team-invite" onSubmit={renameFolder}>
                      <input
                        type="text"
                        required
                        autoFocus
                        className="hm-input"
                        aria-label={strings.renameFolder}
                        value={renaming.name}
                        onChange={(e) => setRenaming({ id: folder.id, name: e.target.value })}
                      />
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
                    </form>
                  ) : confirming?.kind === 'folder' && confirming.id === folder.id ? (
                    <InlineConfirm
                      strings={strings}
                      question={strings.deleteFolderConfirm(folder.name)}
                      confirmLabel={strings.deleteFolder}
                      working={page.working(`folder:${folder.id}`)}
                      onConfirm={() => void deleteFolder(folder)}
                      onCancel={() => setConfirming(null)}
                    />
                  ) : (
                    // The folder and its controls share one line, so the rail
                    // keeps a steady rhythm whether or not a row is hovered.
                    <div className="hm-folder-rail__line">
                      <button
                        type="button"
                        className="hm-folder-rail__item"
                        style={{ paddingInlineStart: 10 + depth * 14 }}
                        aria-current={folderId === folder.id ? 'true' : undefined}
                        onClick={() => setFolderId(folder.id)}
                      >
                        <bdi>{folder.name}</bdi>
                        <span className="hm-folder-rail__count">{countIn(folder.id)}</span>
                      </button>
                      {can('folders.manage') && (
                        <span className="hm-folder-rail__actions">
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
                            onClick={() => setConfirming({ kind: 'folder', id: folder.id })}
                          >
                            {strings.deleteFolder}
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                  {failed && (
                    <p className="hm-field-error" role="alert">
                      {strings.error(failed)}
                    </p>
                  )}
                </div>
              );
            })}

            {folders.length > 0 && (
              <button
                type="button"
                className="hm-folder-rail__item"
                aria-current={folderId === UNFILED ? 'true' : undefined}
                onClick={() => setFolderId(UNFILED)}
              >
                <span>{strings.unfiled}</span>
                <span className="hm-folder-rail__count">{countIn(null)}</span>
              </button>
            )}

            {can('folders.manage') &&
              (addingFolder ? (
                <form className="hm-team-invite" onSubmit={createFolder}>
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
                  <button
                    type="submit"
                    className="hm-btn hm-btn-primary"
                    disabled={page.working('folders.create')}
                  >
                    {page.working('folders.create') ? strings.working : strings.create}
                  </button>
                  <button
                    type="button"
                    className="hm-btn hm-btn-ghost"
                    onClick={() => setAddingFolder(false)}
                  >
                    {strings.cancel}
                  </button>
                </form>
              ) : (
                <button type="button" className="hm-chip-add" onClick={() => setAddingFolder(true)}>
                  + {strings.newTeamFolder}
                </button>
              ))}
            {page.failed('folders.create') && (
              <p className="hm-field-error" role="alert">
                {strings.error(page.failed('folders.create')!)}
              </p>
            )}
          </aside>

          <div className="hm-workspace__notes">
            {shown.length === 0 ? (
              <p className="hm-setting-row__hint">{strings.noSharedNotes}</p>
            ) : (
              <ul className="hm-team-notes">{shown.map(noteRow)}</ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
