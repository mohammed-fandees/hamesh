import { useCallback, useEffect, useState } from 'react';
import type { Invitation, TeamResponse } from '@hamesh/teams-contract';
import type { Lang } from '../i18n';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import { formatDate } from './format';

interface TeamInvitationsProps {
  strings: TeamsStrings;
  lang: Lang;
  page: TeamsPage;
  team: TeamResponse;
}

/**
 * Invitations to this team: make a link, see the open ones, revoke one.
 *
 * Hamesh sends no email — the server hands back a link exactly once and the
 * inviter passes it on themselves. The token lives in the link's fragment, so
 * it never reaches a server log or a Referer header; this page therefore holds
 * a new link in memory until the user is done with it, and never stores it.
 */
export function TeamInvitations({ strings, lang, page, team }: TeamInvitationsProps) {
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const teamId = team.team.id;
  const canInviteMember = team.capabilities.includes('invites.create_member');
  const canInviteAdmin = team.capabilities.includes('invites.create_admin');
  const canManage = team.capabilities.includes('invites.manage');

  const load = useCallback(async () => {
    const result = await page.run('invites.list', { teamId });
    if (result) setInvitations(result.invitations);
  }, [page, teamId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await page.run('invites.list', { teamId });
      if (cancelled) return;
      setInvitations(result?.invitations ?? null);
      // A link belongs to the team it was made for, and is never kept.
      setLink(null);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const result = await page.run('invites.create', { teamId, email, role });
    if (!result) return;
    setLink(result.link);
    setCopied(false);
    setEmail('');
    await load();
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the link is on screen to copy by hand.
      setCopied(false);
    }
  }

  const revoke = async (id: string) => {
    await page.run('invites.revoke', { teamId, invitationId: id });
    await load();
  };

  return (
    <>
      {(canInviteMember || canInviteAdmin) && (
        <form className="hm-team-invite" onSubmit={create}>
          <input
            type="email"
            required
            className="hm-input"
            placeholder={strings.inviteEmailPlaceholder}
            aria-label={strings.inviteSomeone}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {canInviteAdmin && (
            <select
              className="hm-input hm-input--select"
              aria-label={strings.inviteSomeone}
              value={role}
              onChange={(e) => setRole(e.target.value === 'admin' ? 'admin' : 'member')}
            >
              <option value="member">{strings.inviteAsMember}</option>
              <option value="admin">{strings.inviteAsAdmin}</option>
            </select>
          )}
          <button type="submit" className="hm-btn hm-btn-primary" disabled={page.busy}>
            {strings.sendInvite}
          </button>
        </form>
      )}

      {link && (
        <div className="hm-invite-link" role="status">
          <p className="hm-invite-link__title">{strings.inviteLinkReady}</p>
          {/* Selectable, so it can be copied by hand if the clipboard is refused. */}
          <code className="hm-invite-link__value">{link}</code>
          <p className="hm-setting-row__hint">{strings.inviteLinkHint}</p>
          <button type="button" className="hm-btn hm-btn-ghost" onClick={() => void copy()}>
            {copied ? strings.copied : strings.copyLink}
          </button>
        </div>
      )}

      {invitations && invitations.length === 0 && (
        <p className="hm-setting-row__hint">{strings.noInvitations}</p>
      )}

      {invitations && invitations.length > 0 && (
        <ul className="hm-team-invitations">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="hm-team-invitation">
              <span className="hm-team-invitation__who">
                <bdi>{invitation.email}</bdi>
                <span className="hm-team-member__meta">
                  {strings.role(invitation.role)} ·{' '}
                  {invitation.expired
                    ? strings.inviteExpired
                    : strings.inviteExpires(formatDate(invitation.expiresAt, lang))}
                </span>
              </span>
              {canManage && (
                <button
                  type="button"
                  className="hm-btn hm-btn-ghost"
                  disabled={page.busy}
                  onClick={() => void revoke(invitation.id)}
                >
                  {strings.revokeInvite}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
