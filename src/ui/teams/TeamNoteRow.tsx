import { useState } from 'react';
import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import type { FlatFolder } from '@/domain/folder-grouping';
import { resolveFolderId } from '@/domain/folder-grouping';
import { extractDomain, pageLabelFrom } from '@/domain/notes-grouping';
import type { CachedTeamNote } from '@/teams/page-cache';
import type { CachedFolder } from '@/teams/sync-store';
import { FolderSelect } from '../FolderSelect';
import { relativeTime } from '../format';
import { getStrings, type Lang } from '../i18n';
import { Avatar } from '../kit/Avatar';
import { InlineError } from '../kit/Feedback';
import { InlineConfirm } from '../kit/InlineConfirm';
import { Menu, MenuDivider, MenuItem } from '../kit/Menu';
import { FolderIcon, MentionsIcon, OpenElsewhereIcon, PencilIcon, TrashIcon } from '../kit/icons';
import { NoteEditor } from '../NoteEditor';
import { noteRights } from './permissions';
import type { PersonalNotes } from './personal-notes';
import type { TeamsStrings } from './strings';
import { useSharedNote } from './useSharedNote';
import type { TeamsPage } from './useTeams';

interface TeamNoteRowProps {
  strings: TeamsStrings;
  lang: Lang;
  page: TeamsPage;
  team: TeamResponse;
  note: CachedTeamNote;
  folders: readonly FlatFolder<CachedFolder>[];
  members: TeamMember[] | null;
  myUserId: string;
  personal: PersonalNotes;
  reload: () => Promise<void>;
  onOpen: () => void;
}

/**
 * One shared note on its team's page: who left it, what it says and where, and
 * everything that can be done to it, right here. The discussion is the one thing
 * big enough to need the note's own page.
 *
 * What the "⋮" offers is what the server said this reader may do, and the server
 * checks each request again regardless.
 */
export function TeamNoteRow({
  strings,
  lang,
  page,
  team,
  note,
  folders,
  members,
  myUserId,
  personal,
  reload,
  onOpen,
}: TeamNoteRowProps) {
  const teamId = team.team.id;
  const [moving, setMoving] = useState(false);
  const actions = useSharedNote({
    page,
    teamId,
    note,
    noteId: note.id,
    personal,
    reload,
    onGone: () => void reload(),
  });
  const may = noteRights(team, note.authorId, myUserId);
  const author = members?.find((m) => m.userId === note.authorId);
  const label = pageLabelFrom(note.pageTitle, note.originalUrl);
  const folderIds = new Set(folders.map((f) => f.folder.id));
  const folderName = folders.find((f) => f.folder.id === note.folderId)?.folder.name;
  const anyAction = may.edit || may.unshare || may.delete || (may.file && folders.length > 0);

  return (
    <li className="hm-team-row" data-working={actions.working || undefined}>
      <Avatar
        name={author?.displayName ?? null}
        src={author?.avatarUrl}
        seed={note.authorId ?? undefined}
      />
      <div className="hm-team-row__main">
        {actions.editing ? (
          <NoteEditor
            strings={getStrings(lang)}
            initial={note.content}
            label={strings.edit}
            saveLabel={strings.save}
            saving={actions.working}
            onCancel={() => actions.setEditing(false)}
            onSave={(content) => void actions.saveEdit(content)}
          />
        ) : (
          <button type="button" className="hm-team-row__open" onClick={onOpen}>
            <span className="hm-team-row__content hm-prose" dir="auto">
              {note.content}
            </span>
          </button>
        )}
        <p className="hm-team-row__meta">
          <bdi>{author?.displayName ?? strings.formerMember}</bdi>
          <span aria-hidden="true"> · </span>
          <a
            className="hm-team-row__page"
            href={note.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={strings.openPage}
          >
            <bdi>{label}</bdi>
          </a>
          <span aria-hidden="true"> · </span>
          <span>{extractDomain(note.originalUrl)}</span>
          <span aria-hidden="true"> · </span>
          <span>{relativeTime(note.updatedAt, lang)}</span>
          {folderName && (
            <span className="hm-team-row__folder">
              <FolderIcon size={11} />
              <bdi>{folderName}</bdi>
            </span>
          )}
        </p>

        {moving && (
          <div className="hm-team-row__move">
            <FolderSelect
              folders={folders}
              value={resolveFolderId(note.folderId, folderIds)}
              label={strings.moveToFolder}
              noneLabel={strings.noFolderOption}
              onChange={(to) => {
                setMoving(false);
                void actions.move(to);
              }}
            />
            <button type="button" className="hm-link" onClick={() => setMoving(false)}>
              {strings.cancel}
            </button>
          </div>
        )}
        {actions.failed && <InlineError>{strings.error(actions.failed)}</InlineError>}
        {actions.asking === 'delete' && (
          <InlineConfirm
            question={strings.deleteSharedConfirm}
            confirmLabel={strings.delete}
            cancelLabel={strings.keepIt}
            working={actions.working}
            onConfirm={() => void actions.remove()}
            onCancel={() => actions.setAsking(null)}
          />
        )}
        {actions.asking === 'unshare' && (
          <InlineConfirm
            question={strings.unshareConfirm}
            confirmLabel={strings.unshareNote}
            cancelLabel={strings.keepIt}
            tone="plain"
            working={actions.working}
            onConfirm={() => void actions.unshare()}
            onCancel={() => actions.setAsking(null)}
          />
        )}
      </div>

      <div className="hm-team-row__actions">
        <button type="button" className="hm-btn hm-btn-ghost hm-btn--compact" onClick={onOpen}>
          <MentionsIcon size={12} />
          {strings.discuss}
        </button>
        {anyAction && (
          <Menu label={strings.noteActions}>
            {(close) => (
              <>
                {may.edit && (
                  <MenuItem
                    icon={<PencilIcon />}
                    onSelect={() => {
                      actions.setEditing(true);
                      close();
                    }}
                  >
                    {strings.edit}
                  </MenuItem>
                )}
                {may.file && folders.length > 0 && (
                  <MenuItem
                    icon={<FolderIcon />}
                    onSelect={() => {
                      setMoving(true);
                      close();
                    }}
                  >
                    {strings.moveToFolder}
                  </MenuItem>
                )}
                {may.unshare && (
                  <MenuItem
                    icon={<OpenElsewhereIcon />}
                    onSelect={() => {
                      actions.setAsking('unshare');
                      close();
                    }}
                  >
                    {strings.unshareNote}
                  </MenuItem>
                )}
                {may.delete && (
                  <>
                    <MenuDivider />
                    <MenuItem
                      icon={<TrashIcon />}
                      tone="danger"
                      onSelect={() => {
                        actions.setAsking('delete');
                        close();
                      }}
                    >
                      {strings.delete}
                    </MenuItem>
                  </>
                )}
              </>
            )}
          </Menu>
        )}
      </div>
    </li>
  );
}
