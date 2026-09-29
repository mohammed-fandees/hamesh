import { z } from 'zod';
import type { TeamsOpName } from './operation-names';
import {
  ChangeRoleRequest,
  ChangesResponse,
  CommentResponse,
  CommentsResponse,
  CreateCommentFields,
  CreateFolderRequest,
  CreateInvitationRequest,
  CreateNoteRequest,
  InvitationCreatedResponse,
  InvitationPreviewResponse,
  InvitationTokenRequest,
  InvitationsResponse,
  FolderResponse,
  MembersResponse,
  MentionsResponse,
  NoteResponse,
  PaymentsResponse,
  PlansResponse,
  RealtimeTicketRequest,
  RealtimeTicketResponse,
  RenameFolderRequest,
  RepliesResponse,
  SubmitPaymentRequest,
  SubmitPaymentResponse,
  SyncCursor,
  TeamResponse,
  UnshareResponse,
  UpdateCommentFields,
  UpdateNoteFields,
  changesSomething,
  mentionsMatchBody,
} from '@hamesh/teams-contract';

/**
 * Every Teams operation a Hamesh page may ask the background worker to
 * perform, in one table: what it accepts, the request it becomes, and the
 * shape its answer must have.
 *
 * One table rather than a method per endpoint, because the background worker
 * validates what a page sent it *before* touching the network, and the page's
 * own types come from the same entry. An operation that is not listed here
 * cannot be asked for at all.
 *
 * Ids reach the URL only after passing the ULID pattern below, so a path is
 * always built from values the server itself issued — a page cannot steer a
 * request somewhere else by putting a path in an id.
 */
const Ulid = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
const TeamId = z.strictObject({ teamId: Ulid });

/** What a body says it mentions and what it declares must be the same set. */
const MENTIONS_MATCH = {
  message: 'mentions must match the <@id> tokens in the body',
  path: ['mentions'] as PropertyKey[],
};

export interface HttpRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
}

interface Operation<P extends z.ZodType, R extends z.ZodType | null> {
  params: P;
  /** The answer's shape, or null for an endpoint that returns no content. */
  result: R;
  request: (params: z.infer<P>) => HttpRequest;
}

const op = <P extends z.ZodType, R extends z.ZodType | null>(o: Operation<P, R>) => o;

/**
 * Built on first use, never while this module loads.
 *
 * Every schema below is a function call, which a bundler must assume does
 * something — so a table built at module scope would be kept in every build,
 * dragging zod and the whole contract into one that has no Teams at all.
 * Behind a function, this module is declarations only, and a build without
 * Teams drops it.
 */
function buildOperations() {
  return {
    'team.get': op({
      params: TeamId,
      result: TeamResponse,
      request: (p) => ({ method: 'GET', path: `/v1/teams/${p.teamId}` }),
    }),
    'team.create': op({
      params: z.strictObject({ name: z.string(), requestId: z.string() }),
      result: TeamResponse,
      request: (p) => ({ method: 'POST', path: '/v1/teams', body: p }),
    }),
    'team.rename': op({
      params: TeamId.extend({ name: z.string() }),
      result: TeamResponse,
      request: (p) => ({ method: 'PATCH', path: `/v1/teams/${p.teamId}`, body: { name: p.name } }),
    }),
    'team.delete': op({
      params: TeamId,
      result: null,
      request: (p) => ({ method: 'DELETE', path: `/v1/teams/${p.teamId}` }),
    }),
    'team.transfer': op({
      params: TeamId.extend({ userId: Ulid }),
      result: TeamResponse,
      request: (p) => ({
        method: 'POST',
        path: `/v1/teams/${p.teamId}/transfer`,
        body: { userId: p.userId },
      }),
    }),

    'members.list': op({
      params: TeamId,
      result: MembersResponse,
      request: (p) => ({ method: 'GET', path: `/v1/teams/${p.teamId}/members` }),
    }),
    'members.setRole': op({
      params: TeamId.extend({ userId: Ulid, role: ChangeRoleRequest.shape.role }),
      result: null,
      request: (p) => ({
        method: 'PATCH',
        path: `/v1/teams/${p.teamId}/members/${p.userId}`,
        body: { role: p.role },
      }),
    }),
    /** Also how someone leaves: the caller's own user id. */
    'members.remove': op({
      params: TeamId.extend({ userId: Ulid }),
      result: null,
      request: (p) => ({ method: 'DELETE', path: `/v1/teams/${p.teamId}/members/${p.userId}` }),
    }),

    'invites.list': op({
      params: TeamId,
      result: InvitationsResponse,
      request: (p) => ({ method: 'GET', path: `/v1/teams/${p.teamId}/invitations` }),
    }),
    /** The link comes back exactly once, so the page must show it there and then. */
    'invites.create': op({
      params: TeamId.extend(CreateInvitationRequest.shape),
      result: InvitationCreatedResponse,
      request: (p) => ({
        method: 'POST',
        path: `/v1/teams/${p.teamId}/invitations`,
        body: { email: p.email, role: p.role },
      }),
    }),
    'invites.revoke': op({
      params: TeamId.extend({ invitationId: Ulid }),
      result: null,
      request: (p) => ({
        method: 'DELETE',
        path: `/v1/teams/${p.teamId}/invitations/${p.invitationId}`,
      }),
    }),
    /** The token travels in the body, never in a URL. */
    'invites.preview': op({
      params: InvitationTokenRequest,
      result: InvitationPreviewResponse,
      request: (p) => ({ method: 'POST', path: '/v1/invitations/preview', body: p }),
    }),
    'invites.accept': op({
      params: InvitationTokenRequest,
      result: TeamResponse,
      request: (p) => ({ method: 'POST', path: '/v1/invitations/accept', body: p }),
    }),

    /**
     * Everything that changed in the team since `since` — the only way team
     * notes are read. The page the reader is on is never named to the server:
     * the whole team's notes are pulled once and matched to a page locally.
     *
     * No `limit`: the server picks the page size, and the client keeps calling
     * with the cursor it was given while `hasMore`.
     */
    'notes.changes': op({
      params: TeamId.extend({ since: SyncCursor.optional() }),
      result: ChangesResponse,
      request: (p) => ({
        method: 'GET',
        path:
          `/v1/teams/${p.teamId}/changes` +
          (p.since ? `?since=${encodeURIComponent(p.since)}` : ''),
      }),
    }),
    /**
     * Shares a note with the team. `requestId` is the personal note's own id,
     * so sharing the same note twice returns the one team note rather than a
     * second copy of it.
     */
    'notes.share': op({
      params: TeamId.extend(CreateNoteRequest.shape),
      result: NoteResponse,
      request: (p) => ({
        method: 'POST',
        path: `/v1/teams/${p.teamId}/notes`,
        body: {
          requestId: p.requestId,
          originalUrl: p.originalUrl,
          ...(p.pageTitle === undefined ? {} : { pageTitle: p.pageTitle }),
          content: p.content,
          anchor: p.anchor,
          ...(p.folderId === undefined ? {} : { folderId: p.folderId }),
        },
      }),
    }),
    /** `version` is the one this client last saw: a stale edit is refused, not merged. */
    'notes.update': op({
      params: TeamId.extend({ noteId: Ulid })
        .extend(UpdateNoteFields.shape)
        .refine(changesSomething, 'nothing to change'),
      result: NoteResponse,
      request: (p) => ({
        method: 'PATCH',
        path: `/v1/teams/${p.teamId}/notes/${p.noteId}`,
        body: {
          version: p.version,
          ...(p.content === undefined ? {} : { content: p.content }),
          ...(p.folderId === undefined ? {} : { folderId: p.folderId }),
        },
      }),
    }),
    'notes.delete': op({
      params: TeamId.extend({ noteId: Ulid }),
      result: null,
      request: (p) => ({ method: 'DELETE', path: `/v1/teams/${p.teamId}/notes/${p.noteId}` }),
    }),
    /** Takes a note back out of the team; the answer is the note as it was shared. */
    'notes.unshare': op({
      params: TeamId.extend({ noteId: Ulid }),
      result: UnshareResponse,
      request: (p) => ({
        method: 'POST',
        path: `/v1/teams/${p.teamId}/notes/${p.noteId}/unshare`,
      }),
    }),

    'folders.create': op({
      params: TeamId.extend(CreateFolderRequest.shape),
      result: FolderResponse,
      request: (p) => ({
        method: 'POST',
        path: `/v1/teams/${p.teamId}/folders`,
        body: { name: p.name, ...(p.parentId === undefined ? {} : { parentId: p.parentId }) },
      }),
    }),
    'folders.rename': op({
      params: TeamId.extend({ folderId: Ulid }).extend(RenameFolderRequest.shape),
      result: FolderResponse,
      request: (p) => ({
        method: 'PATCH',
        path: `/v1/teams/${p.teamId}/folders/${p.folderId}`,
        body: { name: p.name },
      }),
    }),
    'folders.delete': op({
      params: TeamId.extend({ folderId: Ulid }),
      result: null,
      request: (p) => ({
        method: 'DELETE',
        path: `/v1/teams/${p.teamId}/folders/${p.folderId}`,
      }),
    }),

    /**
     * One note's discussion: top-level comments oldest first, each carrying its
     * newest few replies. `after` is the last comment this client already has —
     * a comment id, so it is checked like any other id before reaching a path.
     */
    'comments.list': op({
      params: TeamId.extend({ noteId: Ulid, after: Ulid.optional() }),
      result: CommentsResponse,
      request: (p) => ({
        method: 'GET',
        path:
          `/v1/teams/${p.teamId}/notes/${p.noteId}/comments` + (p.after ? `?after=${p.after}` : ''),
      }),
    }),
    /** The rest of one comment's replies, for a thread with more than fits inline. */
    'comments.replies': op({
      params: TeamId.extend({ commentId: Ulid, after: Ulid.optional() }),
      result: RepliesResponse,
      request: (p) => ({
        method: 'GET',
        path:
          `/v1/teams/${p.teamId}/comments/${p.commentId}/replies` +
          (p.after ? `?after=${p.after}` : ''),
      }),
    }),
    /**
     * A comment, or a reply when `parentId` is given. `mentions` must be exactly
     * the ids the body's `<@id>` tokens name — checked here as well as by the
     * server, so a page cannot quietly notify someone the text never mentioned.
     */
    'comments.create': op({
      params: TeamId.extend({ noteId: Ulid })
        .extend(CreateCommentFields.shape)
        .refine(mentionsMatchBody, MENTIONS_MATCH),
      result: CommentResponse,
      request: (p) => ({
        method: 'POST',
        path: `/v1/teams/${p.teamId}/notes/${p.noteId}/comments`,
        body: {
          requestId: p.requestId,
          body: p.body,
          ...(p.parentId === undefined ? {} : { parentId: p.parentId }),
          ...(p.mentions === undefined ? {} : { mentions: p.mentions }),
        },
      }),
    }),
    /** Editing your own comment. The server refuses anyone else's, whatever the role. */
    'comments.update': op({
      params: TeamId.extend({ commentId: Ulid })
        .extend(UpdateCommentFields.shape)
        .refine(mentionsMatchBody, MENTIONS_MATCH),
      result: CommentResponse,
      request: (p) => ({
        method: 'PATCH',
        path: `/v1/teams/${p.teamId}/comments/${p.commentId}`,
        body: {
          body: p.body,
          ...(p.mentions === undefined ? {} : { mentions: p.mentions }),
        },
      }),
    }),
    'comments.delete': op({
      params: TeamId.extend({ commentId: Ulid }),
      result: null,
      request: (p) => ({
        method: 'DELETE',
        path: `/v1/teams/${p.teamId}/comments/${p.commentId}`,
      }),
    }),
    /**
     * Where this account has been mentioned, newest first, across every team.
     * `before` is the oldest entry already held.
     */
    'mentions.list': op({
      params: z.strictObject({ before: Ulid.optional() }),
      result: MentionsResponse,
      request: (p) => ({
        method: 'GET',
        path: '/v1/me/mentions' + (p.before ? `?before=${p.before}` : ''),
      }),
    }),

    /**
     * A single-use, short-lived ticket for one team's socket. The answer's URL
     * is still checked against this build's own API origin before anything
     * connects to it (see ./realtime.ts) — the server says where, but not
     * somewhere else.
     */
    'realtime.ticket': op({
      params: RealtimeTicketRequest,
      result: RealtimeTicketResponse,
      request: (p) => ({ method: 'POST', path: '/v1/realtime/tickets', body: p }),
    }),

    'billing.plans': op({
      params: z.strictObject({}),
      result: PlansResponse,
      request: () => ({ method: 'GET', path: '/v1/plans' }),
    }),
    'billing.payments': op({
      params: z.strictObject({}),
      result: PaymentsResponse,
      request: () => ({ method: 'GET', path: '/v1/billing/payments' }),
    }),
    'billing.submit': op({
      params: SubmitPaymentRequest,
      result: SubmitPaymentResponse,
      request: (p) => ({ method: 'POST', path: '/v1/billing/payments', body: p }),
    }),
  } as const;
}

let table: ReturnType<typeof buildOperations> | null = null;

/** The operation table, built once. */
export function operations(): ReturnType<typeof buildOperations> {
  return (table ??= buildOperations());
}

export type TeamsOperations = ReturnType<typeof buildOperations>;

export type ParamsOf<K extends TeamsOpName> = z.infer<TeamsOperations[K]['params']>;
export type ResultOf<K extends TeamsOpName> = TeamsOperations[K]['result'] extends z.ZodType
  ? z.infer<TeamsOperations[K]['result']>
  : undefined;
