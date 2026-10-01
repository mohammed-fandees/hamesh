import type { Note } from '@/domain/note';
import type { TeamsClient } from '@/teams/client';
import type { TeamsErrorCode } from '@/teams/errors';
import type { Lang } from '../i18n';
import { MenuDivider, MenuItem, MenuLabel } from '../kit/Menu';
import { getTeamsStrings } from './strings';
import { Failure, failureOf, useWork } from '../hooks/useWork';

interface ShareNoteActionProps {
  note: Note;
  lang: Lang;
  client: TeamsClient;
  /** The teams this account is in, as the server last listed them. */
  teams: readonly { id: string; name: string }[];
  /**
   * Set for a note that already lives in a team: it is not shared again, so the
   * item opens the team's own page instead, where it can be changed.
   */
  open?: (() => void) | undefined;
  /** Closes the menu this sits in, once there is nothing left to say. */
  onDone: () => void | Promise<void>;
}

/**
 * "Share with team", inside a note's own actions menu in the Notes Library.
 *
 * Sharing happens here rather than on the page: the background worker answers
 * Teams messages only from Hamesh's own pages, and a content script runs inside
 * whatever web page it is on. So the page draws shared notes, and this is where
 * one is handed over.
 *
 * The note itself is unchanged by sharing — it stays on this device exactly as
 * it was. What goes up is a copy the team now has, and the note's own id travels
 * as the idempotency key, so sharing the same note twice is the same share, not
 * a second copy of it.
 */
export function ShareNoteAction({ note, lang, client, teams, open, onDone }: ShareNoteActionProps) {
  const strings = getTeamsStrings(lang);
  const work = useWork((error) => failureOf<TeamsErrorCode>(error, 'internal'));
  const busy = work.working('share');
  const error = work.failed('share');

  // A note that is already a team's is read here and changed there.
  if (open) {
    return (
      <>
        <MenuDivider />
        <MenuItem tone="accent" onSelect={open}>
          {strings.openInTeams}
        </MenuItem>
        <MenuLabel>{strings.teamNoteHint}</MenuLabel>
      </>
    );
  }

  if (teams.length === 0) return null;

  async function share(teamId: string) {
    const shared = await work.run('share', async () => {
      const result = await client.request('notes.share', {
        teamId,
        // The note's own id: a retry of the same share returns the one team note.
        requestId: note.id,
        originalUrl: note.originalUrl,
        ...(note.pageContext?.title ? { pageTitle: note.pageContext.title } : {}),
        content: note.content,
        anchor: note.anchor,
      });
      if (!result.ok) throw new Failure(result.error);
      return true;
    });
    // Only a success closes the menu: a refusal has to stay on screen long
    // enough to be read.
    if (shared) await onDone();
  }

  return (
    <>
      <MenuDivider />
      <MenuLabel>{strings.shareWithTeam}</MenuLabel>
      {teams.map((team) => (
        <MenuItem key={team.id} disabled={busy} onSelect={() => void share(team.id)}>
          <bdi>{team.name}</bdi>
        </MenuItem>
      ))}
      {busy && <MenuLabel>{strings.sharingNote}</MenuLabel>}
      {error && <MenuLabel alert>{strings.error(error)}</MenuLabel>}
    </>
  );
}
