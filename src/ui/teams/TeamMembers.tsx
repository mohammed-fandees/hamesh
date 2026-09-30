import { useState } from 'react';
import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import type { Lang } from '../i18n';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import { formatDate } from './format';
import { InlineConfirm } from './InlineConfirm';

interface TeamMembersProps {
  strings: TeamsStrings;
  lang: Lang;
  page: TeamsPage;
  team: TeamResponse;
  myUserId: string;
  /** Who is in the team, or null while that is still being asked. Fetched once
   *  by the page above, because the notes and their comments need the same
   *  names — a comment names people by id, and this is what turns one into a
   *  name. */
  members: TeamMember[] | null;
  /** Called after anything that changes who is in the team, or my own role. */
  onChanged: () => void;
}

/**
 * Who is in this team, and the few things that can be done about it.
 *
 * Every control is shown only when the server said this caller holds the
 * matching capability — and the server checks again on the request itself.
 * Hiding a button here is tidiness, never the thing that stops anyone.
 *
 * Removing someone, or handing the team to them, is confirmed on their own row:
 * the question names them, and that row alone says it is working while it
 * happens, so the rest of the page stays usable.
 */
export function TeamMembers({
  strings,
  lang,
  page,
  team,
  myUserId,
  members,
  onChanged,
}: TeamMembersProps) {
  const teamId = team.team.id;
  const can = (action: string) => team.capabilities.includes(action as never);
  /** The one row waiting for an answer, and which question it asked. */
  const [confirming, setConfirming] = useState<{
    userId: string;
    act: 'remove' | 'transfer';
  } | null>(null);

  async function act(work: Promise<unknown>) {
    await work;
    setConfirming(null);
    onChanged();
  }

  const setRole = (userId: string, role: 'admin' | 'member') =>
    act(page.run('members.setRole', { teamId, userId, role }, `member:${userId}`));

  const remove = (member: TeamMember) =>
    act(page.run('members.remove', { teamId, userId: member.userId }, `member:${member.userId}`));

  const transfer = (member: TeamMember) =>
    act(page.run('team.transfer', { teamId, userId: member.userId }, `member:${member.userId}`));

  /** Whether this caller may change `member`'s role or remove them. */
  function mayManage(member: TeamMember): boolean {
    if (member.userId === myUserId || member.role === 'owner') return false;
    return member.role === 'admin' ? can('members.remove_admin') : can('members.remove_member');
  }

  if (!members) {
    return (
      <div className="hm-skeleton" aria-hidden="true">
        <div className="hm-skeleton__row" />
        <div className="hm-skeleton__row" />
      </div>
    );
  }

  return (
    <ul className="hm-team-members">
      {members.map((member) => {
        const key = `member:${member.userId}`;
        const working = page.working(key);
        const failed = page.failed(key);
        return (
          <li key={member.userId} className="hm-team-member">
            <span className="hm-team-member__who">
              <span className="hm-team-member__name">
                <span className="hm-avatar" aria-hidden="true">
                  {member.displayName.slice(0, 1).toUpperCase()}
                </span>
                <bdi>{member.displayName}</bdi>
                {member.userId === myUserId && (
                  <span className="hm-team-member__you">({strings.youMarker})</span>
                )}
              </span>
              {/* Only callers the server trusts with emails ever receive them. */}
              {member.email && (
                <span className="hm-team-member__email">
                  <bdi>{member.email}</bdi>
                </span>
              )}
              <span className="hm-team-member__meta">
                {strings.role(member.role)} ·{' '}
                {strings.memberSince(formatDate(member.joinedAt, lang))}
              </span>
              {failed && (
                <span className="hm-field-error" role="alert">
                  {strings.error(failed)}
                </span>
              )}
            </span>

            {confirming?.userId === member.userId ? (
              <InlineConfirm
                strings={strings}
                question={
                  confirming.act === 'remove'
                    ? strings.removeMemberConfirm(member.displayName)
                    : strings.transferConfirm(member.displayName)
                }
                confirmLabel={
                  confirming.act === 'remove' ? strings.removeMember : strings.transferOwnership
                }
                tone={confirming.act === 'remove' ? 'danger' : 'plain'}
                working={working}
                onConfirm={() =>
                  void (confirming.act === 'remove' ? remove(member) : transfer(member))
                }
                onCancel={() => setConfirming(null)}
              />
            ) : working ? (
              <span className="hm-team-member__meta" role="status">
                <span className="hm-spinner" aria-hidden="true" />
                {strings.working}
              </span>
            ) : (
              <span className="hm-team-member__actions">
                {member.role === 'member' && can('members.promote') && (
                  <button
                    type="button"
                    className="hm-btn hm-btn-ghost"
                    onClick={() => void setRole(member.userId, 'admin')}
                  >
                    {strings.makeAdmin}
                  </button>
                )}
                {member.role === 'admin' && can('members.demote') && (
                  <button
                    type="button"
                    className="hm-btn hm-btn-ghost"
                    onClick={() => void setRole(member.userId, 'member')}
                  >
                    {strings.makeMember}
                  </button>
                )}
                {member.role === 'admin' && can('team.transfer') && (
                  <button
                    type="button"
                    className="hm-btn hm-btn-ghost"
                    onClick={() => setConfirming({ userId: member.userId, act: 'transfer' })}
                  >
                    {strings.transferOwnership}
                  </button>
                )}
                {mayManage(member) && (
                  <button
                    type="button"
                    className="hm-btn hm-btn-ghost"
                    onClick={() => setConfirming({ userId: member.userId, act: 'remove' })}
                  >
                    {strings.removeMember}
                  </button>
                )}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
