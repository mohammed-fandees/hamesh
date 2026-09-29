import { useState } from 'react';
import type { InvitationPreviewResponse } from '@hamesh/teams-contract';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import { inviteTokenFrom } from './format';

interface JoinTeamProps {
  strings: TeamsStrings;
  page: TeamsPage;
  /** Called once a team has been joined, with its id, so the page can open it. */
  onJoined: (teamId: string) => void;
}

/**
 * Joining a team from the link someone sent.
 *
 * The link is pasted here rather than opened: its token lives in the URL
 * fragment, and pasting it keeps the token inside the extension instead of
 * handing it to a web page. The invitation is shown before it is accepted, so
 * nobody joins something they can't see first.
 */
export function JoinTeam({ strings, page, onJoined }: JoinTeamProps) {
  const [pasted, setPasted] = useState('');
  const [preview, setPreview] = useState<InvitationPreviewResponse | null>(null);
  const [malformed, setMalformed] = useState(false);

  const token = inviteTokenFrom(pasted);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setPreview(null);
    if (!token) {
      setMalformed(true);
      return;
    }
    setMalformed(false);
    const result = await page.run('invites.preview', { token });
    if (result) setPreview(result);
  }

  async function accept() {
    if (!token) return;
    const result = await page.run('invites.accept', { token });
    if (!result) return;
    setPasted('');
    setPreview(null);
    onJoined(result.team.id);
  }

  return (
    <>
      <p className="hm-settings__intro">{strings.joinHint}</p>
      <form className="hm-team-invite" onSubmit={check}>
        <input
          type="text"
          className="hm-input"
          placeholder={strings.joinPlaceholder}
          aria-label={strings.joinTeam}
          value={pasted}
          onChange={(e) => {
            setPasted(e.target.value);
            setMalformed(false);
          }}
        />
        <button
          type="submit"
          className="hm-btn hm-btn-ghost"
          disabled={page.busy || !pasted.trim()}
        >
          {strings.joinCheck}
        </button>
      </form>

      {malformed && (
        <p className="hm-status hm-status--warning" role="status">
          <span className="hm-dot" />
          {strings.error('invalid_request')}
        </p>
      )}

      {preview && (
        <div className="hm-invite-link" role="status">
          <p className="hm-invite-link__title">
            {strings.joinInvitedTo(preview.team.name, strings.role(preview.role))}
          </p>
          {preview.invitedBy && (
            <p className="hm-setting-row__hint">{strings.joinInvitedBy(preview.invitedBy)}</p>
          )}
          <button
            type="button"
            className="hm-btn hm-btn-primary"
            disabled={page.busy}
            onClick={() => void accept()}
          >
            {strings.joinAccept}
          </button>
        </div>
      )}
    </>
  );
}
