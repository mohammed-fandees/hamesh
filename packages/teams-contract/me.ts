import { z } from 'zod';
import { SubscriptionSummary } from './billing';

/** A team's change counter, as `/changes` and the realtime pokes count it. */
const Seq = z.number().int().min(0);

export const TeamRole = z.enum(['owner', 'admin', 'member']);
export type TeamRole = z.infer<typeof TeamRole>;

/** What the server derives from a team's owner entitlement at `serverTime`. */
export const TeamState = z.enum(['active', 'read_only', 'locked']);
export type TeamState = z.infer<typeof TeamState>;

export const EntitlementSummary = z.strictObject({
  state: z.enum(['active', 'none']),
  plan: z.string().nullable(),
  /** End of the continuous run of access covering now; null when none. */
  until: z.number().int().nullable(),
  limits: z
    .strictObject({
      ownedTeams: z.number().int(),
      membersPerTeam: z.number().int(),
      notesPerTeam: z.number().int(),
    })
    .nullable(),
  sources: z.array(z.enum(['subscription', 'complimentary'])),
});
export type EntitlementSummary = z.infer<typeof EntitlementSummary>;

/** One of the caller's teams, as `/v1/me` lists it. */
const TeamSummary = z.strictObject({
  id: z.string(),
  name: z.string(),
  role: TeamRole,
});

/** GET /v1/me */
export const MeResponse = z.strictObject({
  user: z.strictObject({
    id: z.string(),
    email: z.string(),
    displayName: z.string(),
    /** Their Google profile picture, if they have one (see `TeamMember`). */
    avatarUrl: z.string().url().nullable().optional(),
  }),
  entitlement: EntitlementSummary,
  subscription: SubscriptionSummary,
  teams: z.array(TeamSummary),
  serverTime: z.number().int(),
});
export type MeResponse = z.infer<typeof MeResponse>;

/**
 * `GET /v1/me?v=2`. The same answer, with each team's current change counter.
 *
 * It is what lets a device that woke with no socket — the five-minute alarm,
 * which runs exactly when there is none — tell whether a team moved at all
 * without asking `/changes` for each of them.
 *
 * Only a client that asks this way is told: every shipped build parses this
 * answer with a schema that refuses a field it does not know, so the counter
 * can only travel to one that asked for it. See "Extending a response" in
 * docs/ENGINEERING-RULES.md.
 */
export const MeResponseV2 = MeResponse.extend({
  teams: z.array(TeamSummary.extend({ changeSeq: Seq })),
});
export type MeResponseV2 = z.infer<typeof MeResponseV2>;
