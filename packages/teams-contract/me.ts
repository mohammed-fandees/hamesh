import { z } from 'zod';
import { SubscriptionSummary } from './billing';

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

/** GET /v1/me */
export const MeResponse = z.strictObject({
  user: z.strictObject({
    id: z.string(),
    email: z.string(),
    displayName: z.string(),
  }),
  entitlement: EntitlementSummary,
  subscription: SubscriptionSummary,
  teams: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      role: TeamRole,
    }),
  ),
  serverTime: z.number().int(),
});
export type MeResponse = z.infer<typeof MeResponse>;
