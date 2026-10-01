import { z } from 'zod';
import { TeamRole, TeamState } from './me';

/**
 * Actions a caller may be allowed to perform on a team. The server returns the
 * subset the caller holds as `capabilities`, so the UI can hide controls
 * without guessing; the server still checks every request.
 */
export const TEAM_ACTIONS = [
  'team.view',
  'team.rename',
  'team.delete',
  'team.transfer',
  'team.leave',
  'team.audit.view',
  'members.view_emails',
  'members.remove_member',
  'members.remove_admin',
  'members.promote',
  'members.demote',
  'invites.create_member',
  'invites.create_admin',
  'invites.manage',
  'invites.manage_admin',
  'notes.create',
  'notes.edit_own',
  'notes.edit_any',
  'notes.delete_own',
  'notes.delete_any',
  'notes.unshare_own',
  'notes.file_own',
  'notes.file_any',
  'folders.manage',
  'comments.create',
  'comments.edit_own',
  'comments.delete_own',
  'comments.delete_any',
  'realtime.connect',
  'billing.view_state',
  'billing.view_end_date',
] as const;
export const TeamAction = z.enum(TEAM_ACTIONS);
export type TeamAction = z.infer<typeof TeamAction>;

/** GET /v1/teams/:teamId */
export const TeamResponse = z.strictObject({
  team: z.strictObject({
    id: z.string(),
    name: z.string(),
    role: TeamRole,
    state: TeamState,
    /** When the team leaves read-only grace and locks; null unless read_only. */
    readOnlyUntil: z.number().int().nullable(),
  }),
  capabilities: z.array(TeamAction),
  serverTime: z.number().int(),
});
export type TeamResponse = z.infer<typeof TeamResponse>;

const TeamName = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1).max(80));

/** Client-generated idempotency key: a retried create returns the original team. */
const RequestId = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

const Ulid = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);

/** POST /v1/teams — the caller becomes the owner; no owner or role field exists. */
export const CreateTeamRequest = z.strictObject({ name: TeamName, requestId: RequestId });
export type CreateTeamRequest = z.infer<typeof CreateTeamRequest>;

/** PATCH /v1/teams/:teamId */
export const RenameTeamRequest = z.strictObject({ name: TeamName });

/** POST /v1/teams/:teamId/transfer — the new owner must already be an admin of the team. */
export const TransferTeamRequest = z.strictObject({ userId: Ulid });

/** PATCH /v1/teams/:teamId/members/:userId — ownership moves only through transfer. */
export const ChangeRoleRequest = z.strictObject({ role: z.enum(['admin', 'member']) });

export const TeamMember = z.strictObject({
  userId: z.string(),
  displayName: z.string(),
  /** Only for callers holding `members.view_emails` (owner, admin). */
  email: z.string().optional(),
  role: TeamRole,
  joinedAt: z.number().int(),
  /** Their Google profile picture, if they have one. Optional so a client and
   *  a server a release apart still understand each other. */
  avatarUrl: z.string().url().nullable().optional(),
});
export type TeamMember = z.infer<typeof TeamMember>;

/** GET /v1/teams/:teamId/members */
export const MembersResponse = z.strictObject({ members: z.array(TeamMember) });
export type MembersResponse = z.infer<typeof MembersResponse>;

/** POST /v1/teams/:teamId/invitations */
export const CreateInvitationRequest = z.strictObject({
  email: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.email().max(320)),
  role: z.enum(['admin', 'member']),
});
export type CreateInvitationRequest = z.infer<typeof CreateInvitationRequest>;

export const Invitation = z.strictObject({
  id: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'member']),
  createdAt: z.number().int(),
  expiresAt: z.number().int(),
  expired: z.boolean(),
});
export type Invitation = z.infer<typeof Invitation>;

/**
 * The link is returned exactly once. The token sits in the URL fragment, so it
 * never reaches a server log or a Referer header. Hamesh sends no email: the
 * inviter shares the link.
 */
export const InvitationCreatedResponse = z.strictObject({
  invitation: Invitation,
  link: z.string(),
});
export type InvitationCreatedResponse = z.infer<typeof InvitationCreatedResponse>;

/** GET /v1/teams/:teamId/invitations (open invitations; tokens are never returned). */
export const InvitationsResponse = z.strictObject({ invitations: z.array(Invitation) });
export type InvitationsResponse = z.infer<typeof InvitationsResponse>;

/** POST /v1/invitations/preview and /v1/invitations/accept — token in the body, never the URL. */
export const InvitationTokenRequest = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

export const InvitationPreviewResponse = z.strictObject({
  team: z.strictObject({ id: z.string(), name: z.string() }),
  invitedBy: z.string().nullable(),
  role: z.enum(['admin', 'member']),
  expiresAt: z.number().int(),
});
export type InvitationPreviewResponse = z.infer<typeof InvitationPreviewResponse>;
