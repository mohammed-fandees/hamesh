import { describe, it, expect } from 'vitest';
import type { TeamAction, TeamMember } from '@hamesh/teams-contract';
import {
  commentRights,
  inviteRights,
  memberRights,
  noteRights,
  teamCan,
} from '@/ui/teams/permissions';

const team = (...capabilities: TeamAction[]) => ({ capabilities });
const member = (userId: string, role: TeamMember['role']): TeamMember =>
  ({ userId, role, displayName: userId, joinedAt: 0 }) as TeamMember;

describe('teamCan', () => {
  it('is exactly what the server listed', () => {
    expect(teamCan(team('team.rename'), 'team.rename')).toBe(true);
    expect(teamCan(team('team.rename'), 'team.delete')).toBe(false);
  });
});

describe('noteRights', () => {
  it('lets an "own" right reach only the reader’s own note', () => {
    const t = team('notes.edit_own', 'notes.delete_own', 'notes.file_own', 'notes.unshare_own');
    expect(noteRights(t, 'me', 'me')).toEqual({
      edit: true,
      file: true,
      delete: true,
      unshare: true,
    });
    expect(noteRights(t, 'sara', 'me')).toEqual({
      edit: false,
      file: false,
      delete: false,
      unshare: false,
    });
  });

  it('lets an "any" right reach every note — but never taking someone else’s back', () => {
    const t = team('notes.edit_any', 'notes.delete_any', 'notes.file_any', 'notes.unshare_own');
    expect(noteRights(t, 'sara', 'me')).toEqual({
      edit: true,
      file: true,
      delete: true,
      unshare: false,
    });
  });
});

describe('commentRights', () => {
  it('edits only one’s own, deletes by either right', () => {
    const t = team('comments.edit_own', 'comments.delete_own');
    expect(commentRights(t, 'me', 'me')).toEqual({ edit: true, delete: true });
    expect(commentRights(t, 'sara', 'me')).toEqual({ edit: false, delete: false });
    expect(commentRights(team('comments.delete_any'), 'sara', 'me').delete).toBe(true);
  });
});

describe('memberRights', () => {
  const owner = team(
    'members.promote',
    'members.demote',
    'members.remove_member',
    'members.remove_admin',
    'team.transfer',
  );

  it('offers what fits the member’s role', () => {
    expect(memberRights(owner, member('omar', 'member'), 'me')).toEqual({
      promote: true,
      demote: false,
      transfer: false,
      remove: true,
    });
    expect(memberRights(owner, member('sara', 'admin'), 'me')).toEqual({
      promote: false,
      demote: true,
      transfer: true,
      remove: true,
    });
  });

  it('never offers anything on the reader’s own row or the owner’s', () => {
    const none = { promote: false, demote: false, transfer: false, remove: false };
    expect(memberRights(owner, member('me', 'admin'), 'me')).toEqual(none);
    expect(memberRights(owner, member('boss', 'owner'), 'me')).toEqual(none);
  });

  it('needs the stronger right to remove an admin', () => {
    const admin = team('members.remove_member');
    expect(memberRights(admin, member('omar', 'member'), 'me').remove).toBe(true);
    expect(memberRights(admin, member('sara', 'admin'), 'me').remove).toBe(false);
  });
});

describe('inviteRights', () => {
  it('reports each role separately', () => {
    expect(inviteRights(team('invites.create_member'))).toEqual({
      any: true,
      member: true,
      admin: false,
      manage: false,
    });
    expect(inviteRights(team()).any).toBe(false);
  });
});
