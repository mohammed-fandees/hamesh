import { z } from 'zod';

/**
 * Realtime. Poke-and-pull: the socket
 * carries only sequence numbers and ids, never note or comment text, names,
 * emails or URLs. Clients fetch content through the authorized REST API, so a
 * socket that lingers for a moment after access is revoked leaks nothing.
 */

const Ulid = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);

/** POST /v1/realtime/tickets — a single-use, 60-second ticket for one team. */
export const RealtimeTicketRequest = z.strictObject({ teamId: Ulid });
export type RealtimeTicketRequest = z.infer<typeof RealtimeTicketRequest>;

export const RealtimeTicketResponse = z.strictObject({
  ticket: z.string(),
  /** Absolute wss:// URL to open, ticket already included. */
  url: z.string(),
  expiresAt: z.number().int(),
});
export type RealtimeTicketResponse = z.infer<typeof RealtimeTicketResponse>;

/** Why the server ended a connection's authorization. */
export const REVOKE_REASONS = [
  'removed',
  'team_deleted',
  'not_entitled',
  'expired',
  'signed_out',
] as const;
export type RevokeReason = (typeof REVOKE_REASONS)[number];

/** Close codes the client sees. 4003 = authorization ended; reconnect only after a new ticket. */
export const CLOSE_REVOKED = 4003;
export const CLOSE_PROTOCOL = 1008;

const Seq = z.number().int().min(0);

/**
 * Every frame the server may send, as a schema rather than a bare type: a
 * socket frame is server input like any other, so a client parses it strictly
 * and ignores anything that does not match, instead of trusting the shape.
 */
export const ServerMessage = z.discriminatedUnion('t', [
  /** Sent once on connect: the team's current sequence, so the client knows whether to pull. */
  z.strictObject({ t: z.literal('hello'), teamId: Ulid, seq: Seq }),
  /** Notes or folders changed; pull `/changes?since=<cursor>`. */
  z.strictObject({ t: z.literal('changed'), seq: Seq }),
  /** Membership or roles changed; refetch the member list. */
  z.strictObject({ t: z.literal('members') }),
  /** Comment activity on one note; refetch that note's comments if it is open. */
  z.strictObject({ t: z.literal('comments'), noteId: Ulid }),
  /** Access ended; the socket closes with 4003 right after. */
  z.strictObject({ t: z.literal('revoked'), reason: z.enum(REVOKE_REASONS) }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

/** The only frame a client may send. The server auto-responds "pong". */
export const CLIENT_PING = 'ping';
