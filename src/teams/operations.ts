import { z } from 'zod';
import type { TeamsOpName } from './operation-names';
import {
  ChangeRoleRequest,
  CreateInvitationRequest,
  InvitationCreatedResponse,
  InvitationPreviewResponse,
  InvitationTokenRequest,
  InvitationsResponse,
  MembersResponse,
  PaymentsResponse,
  PlansResponse,
  SubmitPaymentRequest,
  SubmitPaymentResponse,
  TeamResponse,
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
