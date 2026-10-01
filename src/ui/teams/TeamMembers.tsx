import { useState } from 'react';
import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import { formatDate } from '../format';
import type { Lang } from '../i18n';
import { Avatar } from '../kit/Avatar';
import { Busy, InlineError } from '../kit/Feedback';
import { InlineConfirm } from '../kit/InlineConfirm';
import { Skeleton } from '../kit/Skeleton';
import { memberRights } from './permissions';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';

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
 * Who is in this team, and the few things that can be done about each of them.
 *
 * One row per person: who they are, their role, and — where the server says the
 * reader may — what can be done. Removing someone, or handing the team to them,
 * is asked on their own row, and that row alone says it is working while it
 * happens, and why it failed if it did; the rest of the page stays usable.
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

  if (!members) return <Skeleton rows={2} />;

  return (
    <ul className="hm-team-members">
      {members.map((member) => {
        const key = `member:${member.userId}`;
        const working = page.working(key);
        const failed = page.failed(key);
        const may = memberRights(team, member, myUserId);
        const asking = confirming?.userId === member.userId ? confirming.act : null;
        return (
          <li key={member.userId} className="hm-team-member" data-asking={asking ?? undefined}>
            <Avatar name={member.displayName} src={member.avatarUrl} seed={member.userId} />
            <span className="hm-team-member__who">
              <span className="hm-team-member__name">
                <bdi>{member.displayName}</bdi>
                {member.userId === myUserId && (
                  <span className="hm-team-member__you"> · {strings.youMarker}</span>
                )}
              </span>
              {/* Only callers the server trusts with emails ever receive them. */}
              {member.email && (
                <span className="hm-team-member__email">
                  <bdi>{member.email}</bdi>
                </span>
              )}
              <span className="hm-team-member__meta">
                {strings.memberSince(formatDate(member.joinedAt, lang))}
              </span>
            </span>
            <span className="hm-team-member__role">{strings.role(member.role)}</span>

            <span className="hm-team-member__actions">
              {asking ? (
                <InlineConfirm
                  question={
                    asking === 'remove'
                      ? strings.removeMemberConfirm(member.displayName)
                      : strings.transferConfirm(member.displayName)
                  }
                  confirmLabel={
                    asking === 'remove' ? strings.removeMember : strings.transferOwnership
                  }
                  cancelLabel={strings.keepIt}
                  tone={asking === 'remove' ? 'danger' : 'plain'}
                  working={working}
                  onConfirm={() => void (asking === 'remove' ? remove(member) : transfer(member))}
                  onCancel={() => setConfirming(null)}
                />
              ) : working ? (
                // Where its controls were: an arc, and what is happening.
                <Busy label={strings.working} />
              ) : (
                <>
                  {may.promote && (
                    <button
                      type="button"
                      className="hm-btn hm-btn-ghost hm-btn--compact"
                      onClick={() => void setRole(member.userId, 'admin')}
                    >
                      {strings.makeAdmin}
                    </button>
                  )}
                  {may.demote && (
                    <button
                      type="button"
                      className="hm-btn hm-btn-ghost hm-btn--compact"
                      onClick={() => void setRole(member.userId, 'member')}
                    >
                      {strings.makeMember}
                    </button>
                  )}
                  {may.transfer && (
                    <button
                      type="button"
                      className="hm-btn hm-btn-ghost hm-btn--compact"
                      onClick={() => setConfirming({ userId: member.userId, act: 'transfer' })}
                    >
                      {strings.transferOwnership}
                    </button>
                  )}
                  {may.remove && (
                    <button
                      type="button"
                      className="hm-btn hm-btn-ghost hm-btn--compact hm-btn--danger-text"
                      onClick={() => setConfirming({ userId: member.userId, act: 'remove' })}
                    >
                      {strings.removeMember}
                    </button>
                  )}
                </>
              )}
            </span>

            {failed && (
              <span className="hm-team-member__alert">
                <InlineError>{strings.error(failed)}</InlineError>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
