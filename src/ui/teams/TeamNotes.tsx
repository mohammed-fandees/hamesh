import { useCallback, useEffect, useState } from 'react';
import type { TeamAction, TeamResponse } from '@hamesh/teams-contract';
import type { CachedTeamNote } from '@/teams/page-cache';
import type { TeamCacheSnapshot } from '@/teams/messages';
import type { CachedFolder } from '@/teams/sync-store';
import { extractDomain } from '@/domain/notes-grouping';
import type { Lang } from '../i18n';
import { relativeTime } from '../i18n';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import type { PersonalNotes } from './personal-notes';

interface TeamNotesProps {
  strings: TeamsStrings;
  lang: Lang;
  page: TeamsPage;
  team: TeamResponse;
  myUserId: string;
  personal: PersonalNotes;
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

/**
 * What this team has shared, and the folders it files them in.
 *
 * Everything shown here comes from the copy this device already holds — the
 * background worker pulls a team's changes and keeps them (see
 * `teams/sync.ts`), so opening this page asks the server for the team's changes,
 * never for a page or a URL. Which controls appear is decided by the
 * capabilities the server sent with the team, and the server checks each
 * request again regardless.
 *
 * Notes themselves are read on the pages they belong to. This is where they are
 * organised, taken back, or removed for everyone.
 */
export function TeamNotes({ strings, lang, page, team, myUserId, personal }: TeamNotesProps) {
  const [snapshot, setSnapshot] = useState<TeamCacheSnapshot | null>(null);
  const [newFolder, setNewFolder] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const teamId = team.team.id;
  const can = (action: TeamAction) => team.capabilities.includes(action);

  /** Pulls first, then reads: after a change, what is shown is what the server has. */
  const reload = useCallback(async () => {
    const next = await page.cache(teamId, 'sync');
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
      const next = await page.cache(teamId, 'sync');
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
    const created = await page.run('folders.create', { teamId, name });
    if (!created) return;
    setNewFolder('');
    setAddingFolder(false);
    await reload();
  }

  async function renameFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    const done = await page.run('folders.rename', {
      teamId,
      folderId: renaming.id,
      name: renaming.name,
    });
    setRenaming(null);
    if (done) await reload();
  }

  async function deleteFolder(folder: CachedFolder) {
    if (!confirm(strings.deleteFolderConfirm(folder.name))) return;
    const done = await page.run('folders.delete', { teamId, folderId: folder.id });
    if (done !== null) await reload();
  }

  async function move(note: CachedTeamNote, folderId: string | null) {
    const done = await page.run('notes.update', {
      teamId,
      noteId: note.id,
      version: note.version,
      folderId,
    });
    // A refused edit (someone else got there first) is reported by the page
    // itself; either way what is shown afterwards is the server's version.
    void done;
    await reload();
  }

  async function saveEdit(note: CachedTeamNote) {
    if (!editing) return;
    const content = editing.content.trim();
    setEditing(null);
    if (!content || content === note.content) return;
    await page.run('notes.update', {
      teamId,
      noteId: note.id,
      version: note.version,
      content,
    });
    await reload();
  }

  async function unshare(note: CachedTeamNote) {
    if (!confirm(strings.unshareConfirm)) return;
    const result = await page.run('notes.unshare', { teamId, noteId: note.id });
    if (!result) return;
    // Handed back, so it is kept: the note becomes a personal one again rather
    // than disappearing along with the team's copy.
    await personal.keep(result.note);
    await reload();
  }

  async function remove(note: CachedTeamNote) {
    if (!confirm(strings.deleteSharedConfirm)) return;
    const gone = await page.run('notes.delete', { teamId, noteId: note.id });
    if (gone !== null) await reload();
  }

  const folders = flatten(snapshot?.folders ?? []);
  const notes = snapshot?.notes ?? [];
  const folderIds = new Set(folders.map((f) => f.folder.id));
  const inFolder = (folderId: string | null) =>
    notes.filter((note) =>
      folderId === null
        ? !note.folderId || !folderIds.has(note.folderId)
        : note.folderId === folderId,
    );

  function noteRow(note: CachedTeamNote) {
    const isEditing = editing?.id === note.id;
    return (
      <li key={note.id} className="hm-team-member">
        <div className="hm-team-member__who">
          <a
            className="hm-link hm-team-note__page"
            href={note.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={strings.openPage}
          >
            <bdi>{note.pageTitle || extractDomain(note.originalUrl)}</bdi>
          </a>
          {isEditing ? (
            <textarea
              className="hm-textarea"
              dir="auto"
              autoFocus
              aria-label={strings.sharedNotes}
              value={editing.content}
              onChange={(e) => setEditing({ id: note.id, content: e.target.value })}
            />
          ) : (
            <p className="hm-team-note__body" dir="auto">
              {note.content}
            </p>
          )}
          <span className="hm-team-member__meta">
            {strings.noteEdited(relativeTime(new Date(note.updatedAt).toISOString(), lang))}
          </span>
        </div>
        <div className="hm-team-member__actions">
          {isEditing ? (
            <>
              <button
                type="button"
                className="hm-btn hm-btn-ghost"
                onClick={() => setEditing(null)}
              >
                {strings.cancel}
              </button>
              <button
                type="button"
                className="hm-btn hm-btn-primary"
                disabled={page.busy}
                onClick={() => void saveEdit(note)}
              >
                {strings.saveNote}
              </button>
            </>
          ) : (
            <>
              {mayEdit(note) && (
                <button
                  type="button"
                  className="hm-link"
                  onClick={() => setEditing({ id: note.id, content: note.content })}
                >
                  {strings.editNote}
                </button>
              )}
              {mayFile(note) && folders.length > 0 && (
                <label className="hm-team-member__meta">
                  {strings.moveToFolder}{' '}
                  <select
                    className="hm-input"
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
              {mayUnshare(note) && (
                <button type="button" className="hm-link" onClick={() => void unshare(note)}>
                  {strings.unshareNote}
                </button>
              )}
              {mayDelete(note) && (
                <button
                  type="button"
                  className="hm-link hm-link--danger"
                  onClick={() => void remove(note)}
                >
                  {strings.deleteSharedNote}
                </button>
              )}
            </>
          )}
        </div>
      </li>
    );
  }

  return (
    <section>
      <p className="hm-settings__intro">{strings.sharedNotesHint}</p>
      <p className="hm-team-member__meta">
        {snapshot?.syncedAt
          ? strings.syncedAgo(relativeTime(new Date(snapshot.syncedAt).toISOString(), lang))
          : strings.neverSynced}{' '}
        <button
          type="button"
          className="hm-link"
          disabled={page.busy}
          onClick={() => void reload()}
        >
          {strings.refreshNotes}
        </button>
      </p>

      <h3 className="hm-settings__subheading">{strings.teamFolders}</h3>
      {folders.length === 0 && <p className="hm-setting-row__hint">{strings.noTeamFolders}</p>}
      {folders.length > 0 && (
        <ul className="hm-team-members">
          {folders.map(({ folder, depth }) => (
            <li
              key={folder.id}
              className="hm-team-member"
              style={{ paddingInlineStart: depth * 16 }}
            >
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
                  <button type="submit" className="hm-btn hm-btn-ghost" disabled={page.busy}>
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
              ) : (
                <>
                  <span className="hm-team-member__name">
                    <bdi>{folder.name}</bdi>
                    <span className="hm-team-member__meta">{inFolder(folder.id).length}</span>
                  </span>
                  {can('folders.manage') && (
                    <div className="hm-team-member__actions">
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
                        onClick={() => void deleteFolder(folder)}
                      >
                        {strings.deleteFolder}
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
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
            <button type="submit" className="hm-btn hm-btn-primary" disabled={page.busy}>
              {strings.create}
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
          <button type="button" className="hm-link" onClick={() => setAddingFolder(true)}>
            {strings.newTeamFolder}
          </button>
        ))}

      <h3 className="hm-settings__subheading">{strings.sharedNotes}</h3>
      {notes.length === 0 ? (
        <p className="hm-setting-row__hint">{strings.noSharedNotes}</p>
      ) : (
        <>
          {folders.map(({ folder }) => {
            const filed = inFolder(folder.id);
            if (filed.length === 0) return null;
            return (
              <div key={folder.id}>
                <p className="hm-folder-menu__section-label">
                  <bdi>{folder.name}</bdi>
                </p>
                <ul className="hm-team-members">{filed.map(noteRow)}</ul>
              </div>
            );
          })}
          {inFolder(null).length > 0 && (
            <div>
              {folders.length > 0 && (
                <p className="hm-folder-menu__section-label">{strings.unfiled}</p>
              )}
              <ul className="hm-team-members">{inFolder(null).map(noteRow)}</ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
