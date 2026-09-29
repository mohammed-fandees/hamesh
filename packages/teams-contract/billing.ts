import { z } from 'zod';

/**
 * Plans, prices and manual payments.
 *
 * The client never sends money amounts, plan limits, dates or statuses: it
 * submits a reference for a payment it made elsewhere, and the server fills in
 * the price, the amount and everything else from its own records.
 */

export const PAYMENT_METHODS = ['instapay', 'vodafone_cash'] as const;
export const PaymentMethod = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const PAYMENT_STATUSES = ['pending', 'approved', 'rejected', 'refunded'] as const;
export const PaymentStatus = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

/** What a plan costs and allows. Everything here is server data, never client input. */
export const PlanOffer = z.strictObject({
  code: z.string(),
  price: z.strictObject({
    /** Minor units (450 EGP = 45000). */
    amountMinor: z.number().int(),
    currency: z.string(),
    periodDays: z.number().int(),
  }),
  limits: z.strictObject({
    ownedTeams: z.number().int(),
    membersPerTeam: z.number().int(),
    notesPerTeam: z.number().int(),
  }),
});
export type PlanOffer = z.infer<typeof PlanOffer>;

/** GET /v1/plans — public, so the extension can show a price before sign-in. */
export const PlansResponse = z.strictObject({
  plans: z.array(PlanOffer),
  /** How to pay, as configured server-side; shown verbatim by the client. */
  methods: z.array(PaymentMethod),
});
export type PlansResponse = z.infer<typeof PlansResponse>;

/**
 * POST /v1/billing/payments — "I paid this much, here is the reference."
 * `periods` is how many periods were paid for; the server computes the amount
 * it expects, and an admin confirms the money actually arrived.
 */
export const SubmitPaymentRequest = z.strictObject({
  planCode: z.string().min(1).max(40),
  method: PaymentMethod,
  /** The transaction reference from the bank or wallet app. */
  reference: z
    .string()
    .transform((s) => s.trim().toUpperCase().replace(/\s+/g, ''))
    .pipe(z.string().min(3).max(100)),
  periods: z.number().int().min(1).max(12),
});
export type SubmitPaymentRequest = z.infer<typeof SubmitPaymentRequest>;

export const PaymentView = z.strictObject({
  id: z.string(),
  method: PaymentMethod,
  reference: z.string(),
  periods: z.number().int(),
  amountMinor: z.number().int(),
  currency: z.string(),
  status: PaymentStatus,
  submittedAt: z.number().int(),
  decidedAt: z.number().int().nullable(),
  /** The admin's note on a rejection, when there is one. */
  note: z.string().nullable(),
});
export type PaymentView = z.infer<typeof PaymentView>;

/** GET /v1/billing/payments — the caller's own payments, newest first. */
export const PaymentsResponse = z.strictObject({ payments: z.array(PaymentView) });
export type PaymentsResponse = z.infer<typeof PaymentsResponse>;

/**
 * The commercial state of the caller's subscription, derived at read time
 * — never stored, so it cannot go stale.
 */
export const SUBSCRIPTION_STATES = [
  'none',
  'pending',
  'scheduled',
  'active',
  'expired',
  'revoked',
] as const;
export const SubscriptionState = z.enum(SUBSCRIPTION_STATES);
export type SubscriptionState = z.infer<typeof SubscriptionState>;

export const SubscriptionSummary = z.strictObject({
  state: SubscriptionState,
  /** Set once cancelled: the current period is still honoured, nothing renews. */
  canceled: z.boolean(),
  /** A payment awaiting a decision, if any. */
  pendingPayment: PaymentView.nullable(),
});
export type SubscriptionSummary = z.infer<typeof SubscriptionSummary>;
