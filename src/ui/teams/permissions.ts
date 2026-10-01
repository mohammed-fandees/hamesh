import type { TeamAction, TeamMember, TeamResponse } from '@hamesh/teams-contract';

/**
 * What the reader may do in a team, read from the capabilities the server sent
 * with it — in one place, so each page asks the same question the same way.
 *
 * Hiding a control is tidiness, never the thing that stops anyone: the server
 * checks every request again. The "own" and "any" pairs are why these are
 * functions rather than a lookup — a note the reader shared is theirs, and some
 * rights reach only that far.
 */
export function teamCan(team: Pick<TeamResponse, 'capabilities'>, action: TeamAction): boolean {
  return team.capabilities.includes(action);
}

type Team = Pick<TeamResponse, 'capabilities'>;

/** What the reader may do to one shared note. Taking a note back is its author's alone. */
export function noteRights(team: Team, authorId: string | null, myUserId: string) {
  const mine = authorId === myUserId;
  const either = (any: TeamAction, own: TeamAction) =>
    teamCan(team, any) || (mine && teamCan(team, own));
  return {
    edit: either('notes.edit_any', 'notes.edit_own'),
    file: either('notes.file_any', 'notes.file_own'),
    delete: either('notes.delete_any', 'notes.delete_own'),
    unshare: mine && teamCan(team, 'notes.unshare_own'),
  };
}

/** What the reader may do to one comment. Only its author edits it. */
export function commentRights(team: Team, authorId: string | null, myUserId: string) {
  const mine = authorId === myUserId;
  return {
    edit: mine && teamCan(team, 'comments.edit_own'),
    delete: teamCan(team, 'comments.delete_any') || (mine && teamCan(team, 'comments.delete_own')),
  };
}

/**
 * What the reader may do to one member. Nobody manages themselves or the
 * owner; removing an admin is a stronger right than removing a member.
 */
export function memberRights(team: Team, member: TeamMember, myUserId: string) {
  const other = member.userId !== myUserId && member.role !== 'owner';
  return {
    promote: other && member.role === 'member' && teamCan(team, 'members.promote'),
    demote: other && member.role === 'admin' && teamCan(team, 'members.demote'),
    transfer: other && member.role === 'admin' && teamCan(team, 'team.transfer'),
    remove:
      other &&
      teamCan(team, member.role === 'admin' ? 'members.remove_admin' : 'members.remove_member'),
  };
}

/** Whether the reader may invite anyone, and in which roles. */
export function inviteRights(team: Team) {
  const member = teamCan(team, 'invites.create_member');
  const admin = teamCan(team, 'invites.create_admin');
  return { any: member || admin, member, admin, manage: teamCan(team, 'invites.manage') };
}
