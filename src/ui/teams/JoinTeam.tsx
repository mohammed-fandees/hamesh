import { useEffect, useState } from 'react';
import type { InvitationPreviewResponse } from '@hamesh/teams-contract';
import { InlineError } from '../kit/Feedback';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import { clearPendingJoin, readPendingJoin } from '@/teams/join-pending';
import { inviteTokenFrom } from './invite-link';

interface JoinTeamProps {
  strings: TeamsStrings;
  page: TeamsPage;
  /** Called once a team has been joined, with its id, so the page can open it. */
  onJoined: (teamId: string) => void;
}

/** How a waiting invitation is shown in the field: as the link it came from. */
const JOIN_LINK = 'https://hamesh.fandees.tech/join#';

/**
 * Joining a team from the link someone sent.
 *
 * Opening the link hands its token to Hamesh (`@/teams/join-page`), which
 * keeps it until this card shows it; pasting the link here does the same by
 * hand. Either way the invitation is shown before it is accepted, so nobody
 * joins something they can't see first.
 */
export function JoinTeam({ strings, page, onJoined }: JoinTeamProps) {
  const [pasted, setPasted] = useState('');
  const [preview, setPreview] = useState<InvitationPreviewResponse | null>(null);
  const [malformed, setMalformed] = useState(false);

  const token = inviteTokenFrom(pasted);

  // An invitation opened from its link is checked at once; accepting it is
  // still the reader's.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const waiting = await readPendingJoin(Date.now()).catch(() => null);
      if (cancelled || !waiting) return;
      setPasted(`${JOIN_LINK}${waiting}`);
      const result = await page.run('invites.preview', { token: waiting }, 'invites.preview');
      if (!cancelled && result) setPreview(result);
    })();
    return () => {
      cancelled = true;
    };
    // Once, when the card appears: `page` changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setPreview(null);
    if (!token) {
      setMalformed(true);
      return;
    }
    setMalformed(false);
    const result = await page.run('invites.preview', { token }, 'invites.preview');
    if (result) setPreview(result);
  }

  async function accept() {
    if (!token) return;
    const result = await page.run('invites.accept', { token }, 'invites.accept');
    if (!result) return;
    void clearPendingJoin().catch(() => {});
    setPasted('');
    setPreview(null);
    onJoined(result.team.id);
  }

  return (
    <>
      <p className="hm-section__intro">{strings.joinHint}</p>
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
            setPreview(null);
            // Another link: the one that was waiting is no longer the one wanted.
            void clearPendingJoin().catch(() => {});
          }}
        />
        <button
          type="submit"
          className="hm-btn hm-btn-ghost"
          disabled={page.working('invites.preview') || !pasted.trim()}
          aria-busy={page.working('invites.preview')}
        >
          {strings.joinCheck}
        </button>
      </form>

      {malformed && <InlineError>{strings.error('invalid_request')}</InlineError>}
      {(page.failed('invites.preview') ?? page.failed('invites.accept')) && (
        <InlineError>
          {strings.error((page.failed('invites.preview') ?? page.failed('invites.accept'))!)}
        </InlineError>
      )}

      {preview && (
        <div className="hm-invite-link" role="status">
          <p className="hm-invite-link__title">
            {strings.joinInvitedTo(preview.team.name, strings.role(preview.role))}
          </p>
          {preview.invitedBy && (
            <p className="hm-supporting">{strings.joinInvitedBy(preview.invitedBy)}</p>
          )}
          <button
            type="button"
            className="hm-btn hm-btn-primary"
            disabled={page.working('invites.accept')}
            aria-busy={page.working('invites.accept')}
            onClick={() => void accept()}
          >
            {strings.joinAccept}
          </button>
        </div>
      )}
    </>
  );
}
