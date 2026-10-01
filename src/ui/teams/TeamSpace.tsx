import { useMemo } from 'react';
import type { FolderLike } from '@/domain/folder';
import { buildFolderTree } from '@/domain/folder-grouping';
import type { Note } from '@/domain/note';
import type { TeamsErrorCode } from '@/teams/errors';
import type { Lang, Strings } from '../i18n';
import { InlineError } from '../kit/Feedback';
import { TeamIcon } from '../kit/icons';
import { failureOf, useWork } from '../hooks/useWork';
import { FolderTree, PERSONAL_SPACE, teamSpace } from '../library/FolderTree';
import { SpaceCard } from '../library/SpaceCard';
import { getTeamsStrings } from './strings';
import './styles';

/**
 * What the Library can do to a team's notes and folders. Each fails with the
 * server's refusal; the page above carries it out and re-reads the team.
 */
export interface TeamLibraryActions {
  /** One of this device's notes, into this team (consent asked first). */
  share: (noteId: string, teamId: string, folderId: string | null) => Promise<void>;
  /** One of this team's notes, into another of its folders. */
  file: (noteId: string, teamId: string, folderId: string | null) => Promise<void>;
  createFolder: (teamId: string, name: string, parentId: string | null) => Promise<void>;
  renameFolder: (teamId: string, folderId: string, name: string) => Promise<void>;
  deleteFolder: (teamId: string, folderId: string) => Promise<void>;
}

interface TeamSpaceProps {
  team: { id: string; name: string };
  /** This team's notes, as the Library currently shows them (searched, filtered). */
  notes: Note[];
  folders: readonly FolderLike[];
  strings: Strings;
  lang: Lang;
  actions: TeamLibraryActions;
}

/** Which of this team's folders a team note is filed in. */
const teamFolderOf = (note: Note) => note.team?.folderId ?? null;

/**
 * One team's space in the Library's folder view: its folders and notes, the
 * same tree as the reader's own, under a header that says they are shared.
 *
 * A note dragged here from this device is shared into the folder it lands on;
 * one dragged within the team is moved. Notes of another team, or a team's
 * note dragged back to this device, are not taken — those are different acts
 * (unsharing belongs to the note's author, on the team's own page).
 */
export function TeamSpace({ team, notes, folders, strings, lang, actions }: TeamSpaceProps) {
  const teamStrings = getTeamsStrings(lang);
  const work = useWork((error) => failureOf<TeamsErrorCode>(error, 'internal'));
  const space = teamSpace(team.id);
  const { tree, unfiledNotes } = useMemo(
    () => buildFolderTree(folders, notes, teamFolderOf),
    [folders, notes],
  );
  const run = (task: () => Promise<void>) => work.run('space', task);
  const failure = work.failed('space');

  return (
    <SpaceCard
      icon={<TeamIcon size={16} />}
      title={team.name}
      meta={teamStrings.teamSpaceMeta(notes.length)}
      shared
      alert={failure && <InlineError>{teamStrings.error(failure)}</InlineError>}
    >
      <FolderTree
        space={space}
        tree={tree}
        unfiledNotes={unfiledNotes}
        strings={strings}
        lang={lang}
        bare
        accepts={(from) => from === PERSONAL_SPACE || from === space}
        crossSpaceHint={teamStrings.dropToShare}
        onCreateFolder={(name, parentId) =>
          run(() => actions.createFolder(team.id, name, parentId))
        }
        onRenameFolder={(folderId, name) =>
          run(() => actions.renameFolder(team.id, folderId, name))
        }
        onDeleteFolder={(folderId) => run(() => actions.deleteFolder(team.id, folderId))}
        onDropNote={(noteId, folderId, from) =>
          void run(() =>
            from === PERSONAL_SPACE
              ? actions.share(noteId, team.id, folderId ?? null)
              : actions.file(noteId, team.id, folderId ?? null),
          )
        }
      />
    </SpaceCard>
  );
}
