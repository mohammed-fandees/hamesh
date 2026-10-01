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

/**
 * Where the money goes, for one way of paying.
 *
 * Server configuration only. The extension's source is public, so it holds no
 * number of its own: a changed or forked client cannot redirect anyone's
 * payment, because what it shows is what the private server sent.
 */
export const PayeeAccount = z.strictObject({
  method: PaymentMethod,
  /** The number or address to pay to, shown verbatim. */
  account: z.string().min(1).max(100),
});
export type PayeeAccount = z.infer<typeof PayeeAccount>;

/** How to pay, and how to have a payment confirmed. */
export const PaymentInstructions = z.strictObject({
  /** One per method on offer; a method with no account is not offered. */
  accounts: z.array(PayeeAccount),
  /** Where to send the payment's screenshot, when the operator takes one. */
  confirm: z.strictObject({ whatsapp: z.string().min(1).max(40) }).nullable(),
});
export type PaymentInstructions = z.infer<typeof PaymentInstructions>;

/**
 * The terms a payment is made under. Paying means agreeing to them, so the
 * client echoes `version` with the payment and the server records it.
 */
export const LegalTerms = z.strictObject({
  version: z.string().min(1).max(40),
  termsUrl: z.string().url(),
  privacyUrl: z.string().url(),
});
export type LegalTerms = z.infer<typeof LegalTerms>;

/** GET /v1/plans — public, so the extension can show a price before sign-in. */
export const PlansResponse = z.strictObject({
  plans: z.array(PlanOffer),
  payment: PaymentInstructions,
  terms: LegalTerms,
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
  /** The `terms.version` the payer was shown; refused unless it is current. */
  termsVersion: z.string().min(1).max(40),
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

/** POST /v1/billing/payments — the payment as the server recorded it. */
export const SubmitPaymentResponse = z.strictObject({ payment: PaymentView });
export type SubmitPaymentResponse = z.infer<typeof SubmitPaymentResponse>;

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
