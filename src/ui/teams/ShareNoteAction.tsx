import type { TeamsErrorCode } from '@/teams/errors';
import type { Lang } from '../i18n';
import { MenuDivider, MenuItem, MenuLabel } from '../kit/Menu';
import { getTeamsStrings } from './strings';
import { failureOf, useWork } from '../hooks/useWork';

interface ShareNoteActionProps {
  lang: Lang;
  /** The teams this account is in, as the server last listed them. */
  teams: readonly { id: string; name: string }[];
  /**
   * Set for a note that already lives in a team: it is not shared again, so the
   * item opens the team's own page instead, where it can be changed.
   */
  open?: (() => void) | undefined;
  /**
   * Shares the note with a team — the page's one way of sharing, which asks the
   * reader's consent first. `false` if they declined; fails with a refusal.
   */
  share: (teamId: string) => Promise<boolean>;
  /** Closes the menu this sits in, once there is nothing left to say. */
  onDone: () => void;
}

/**
 * "Share with team", inside a note's own actions menu in the Notes Library.
 *
 * Sharing happens here rather than on the page: the background worker answers
 * Teams messages only from Hamesh's own pages, and a content script runs inside
 * whatever web page it is on. So the page draws shared notes, and this is where
 * one is handed over.
 *
 * What sharing means — consent, the upload, the note moving to the team — is
 * the page's (`share`), the same as dropping the note on a team's folder.
 */
export function ShareNoteAction({ lang, teams, open, share, onDone }: ShareNoteActionProps) {
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

  async function shareWith(teamId: string) {
    const shared = await work.run('share', () => share(teamId));
    // Only a success closes the menu: a refusal has to stay on screen long
    // enough to be read, and a declined consent leaves the reader where they were.
    if (shared) onDone();
  }

  return (
    <>
      <MenuDivider />
      <MenuLabel>{strings.shareWithTeam}</MenuLabel>
      {teams.map((team) => (
        <MenuItem key={team.id} disabled={busy} onSelect={() => void shareWith(team.id)}>
          <bdi>{team.name}</bdi>
        </MenuItem>
      ))}
      {busy && <MenuLabel>{strings.sharingNote}</MenuLabel>}
      {error && <MenuLabel alert>{strings.error(error)}</MenuLabel>}
    </>
  );
}
