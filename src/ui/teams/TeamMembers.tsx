import { useCallback, useEffect, useState } from 'react';
import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import type { Lang } from '../i18n';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import { formatDate } from './format';

interface TeamMembersProps {
  strings: TeamsStrings;
  lang: Lang;
  page: TeamsPage;
  team: TeamResponse;
  myUserId: string;
  /** Called after anything that changes who is in the team, or my own role. */
  onChanged: () => void;
}

/**
 * Who is in this team, and the few things that can be done about it.
 *
 * Every control is shown only when the server said this caller holds the
 * matching capability — and the server checks again on the request itself.
 * Hiding a button here is tidiness, never the thing that stops anyone.
 */
export function TeamMembers({ strings, lang, page, team, myUserId, onChanged }: TeamMembersProps) {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const teamId = team.team.id;
  const can = (action: string) => team.capabilities.includes(action as never);

  const load = useCallback(async () => {
    const result = await page.run('members.list', { teamId });
    if (result) setMembers(result.members);
  }, [page, teamId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await page.run('members.list', { teamId });
      if (!cancelled) setMembers(result?.members ?? null);
    })();
    return () => {
      cancelled = true;
    };
    // `page` is rebuilt on every render of the page above; the team is what
    // actually decides who to fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function act(work: Promise<unknown>) {
    await work;
    await load();
    onChanged();
  }

  const setRole = (userId: string, role: 'admin' | 'member') =>
    act(page.run('members.setRole', { teamId, userId, role }));

  function remove(member: TeamMember) {
    if (!confirm(strings.removeMemberConfirm(member.displayName))) return;
    void act(page.run('members.remove', { teamId, userId: member.userId }));
  }

  function transfer(member: TeamMember) {
    if (!confirm(strings.transferConfirm(member.displayName))) return;
    void act(page.run('team.transfer', { teamId, userId: member.userId }));
  }

  /** Whether this caller may change `member`'s role or remove them. */
  function mayManage(member: TeamMember): boolean {
    if (member.userId === myUserId || member.role === 'owner') return false;
    return member.role === 'admin' ? can('members.remove_admin') : can('members.remove_member');
  }

  if (!members) return <p className="hm-setting-row__hint">{strings.working}</p>;

  return (
    <ul className="hm-team-members">
      {members.map((member) => (
        <li key={member.userId} className="hm-team-member">
          <span className="hm-team-member__who">
            <span className="hm-team-member__name">
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
              {strings.role(member.role)} · {strings.memberSince(formatDate(member.joinedAt, lang))}
            </span>
          </span>

          <span className="hm-team-member__actions">
            {member.role === 'member' && can('members.promote') && (
              <button
                type="button"
                className="hm-btn hm-btn-ghost"
                disabled={page.busy}
                onClick={() => void setRole(member.userId, 'admin')}
              >
                {strings.makeAdmin}
              </button>
            )}
            {member.role === 'admin' && can('members.demote') && (
              <button
                type="button"
                className="hm-btn hm-btn-ghost"
                disabled={page.busy}
                onClick={() => void setRole(member.userId, 'member')}
              >
                {strings.makeMember}
              </button>
            )}
            {member.role === 'admin' && can('team.transfer') && (
              <button
                type="button"
                className="hm-btn hm-btn-ghost"
                disabled={page.busy}
                onClick={() => transfer(member)}
              >
                {strings.transferOwnership}
              </button>
            )}
            {mayManage(member) && (
              <button
                type="button"
                className="hm-btn hm-btn-ghost"
                disabled={page.busy}
                onClick={() => remove(member)}
              >
                {strings.removeMember}
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
