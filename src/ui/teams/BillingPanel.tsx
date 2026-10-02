import { useCallback, useEffect, useState } from 'react';
import type {
  MeResponse,
  PaymentMethod,
  PaymentView,
  PlanDiscount,
  PlanOfferV2,
  PlansResponseV2,
} from '@hamesh/teams-contract';
import type { Lang } from '../i18n';
import { InlineError, StatusLine } from '../kit/Feedback';
import { SegmentedControl } from '../kit/SegmentedControl';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import { formatDate, formatMoney } from '../format';

interface BillingPanelProps {
  strings: TeamsStrings;
  lang: Lang;
  page: TeamsPage;
  me: MeResponse;
}

/** The most periods one payment may cover — the contract's own bound. */
const MAX_PERIODS = 12;

/** A WhatsApp link for a number the server sent, digits only. */
const whatsappLink = (number: string) => `https://wa.me/${number.replace(/\D/g, '')}`;

/**
 * The plans on offer, and how to pay for the one chosen.
 *
 * Every number here — price, currency, period, limits, dates, status, and where
 * the money goes — comes from the server. The extension's source is public and
 * holds no price and no account number of its own, so a changed copy of it
 * cannot send anyone's money elsewhere: it shows what `/v1/plans` says and
 * submits a reference for money the user moved themselves. Whether that payment
 * counts is decided by a person on the server's side, never here.
 *
 * Paying is agreeing to the terms. A first payment asks for that agreement
 * outright; later ones say what they are made under. Either way the version the
 * payer saw travels with the payment, and the server refuses a stale one.
 *
 * A discount is the server's too: the price it sends is already the one a
 * payment costs, and the price before it is only shown, struck through.
 */
export function BillingPanel({ strings, lang, page, me }: BillingPanelProps) {
  const [plans, setPlans] = useState<PlansResponseV2 | null>(null);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentView[] | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [reference, setReference] = useState('');
  const [periods, setPeriods] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const adopt = useCallback(
    (offered: PlansResponseV2 | null, history: { payments: PaymentView[] } | null) => {
      if (offered) {
        setPlans(offered);
        // Keep a choice still on offer; otherwise start from the plan this
        // account is on, or the first one offered.
        setPlanCode((current) => {
          const has = (code: string | null) => offered.plans.some((p) => p.code === code);
          if (has(current)) return current;
          if (has(me.entitlement.plan)) return me.entitlement.plan;
          return offered.plans[0]?.code ?? null;
        });
        setMethod((current) =>
          current && offered.payment.accounts.some((a) => a.method === current)
            ? current
            : (offered.payment.accounts[0]?.method ?? null),
        );
      }
      if (history) setPayments(history.payments);
    },
    // `me` only seeds the first choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const load = useCallback(async () => {
    const [offered, history] = await Promise.all([
      page.run('billing.plans', {}),
      page.run('billing.payments', {}),
    ]);
    adopt(offered, history);
    // `page` is rebuilt on every render; what it does is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adopt]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [offered, history] = await Promise.all([
        page.run('billing.plans', {}),
        page.run('billing.payments', {}),
      ]);
      if (!cancelled) adopt(offered, history);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = plans?.plans.find((p) => p.code === planCode) ?? null;
  const account = plans?.payment.accounts.find((a) => a.method === method) ?? null;
  /** No payment yet: this one is where the terms are agreed to. */
  const first = payments !== null && payments.length === 0;

  const methodLabel = (m: PaymentMethod) =>
    // `vodafone_cash` is the wire's name for any mobile wallet.
    m === 'vodafone_cash' ? strings.methodWallet : strings.methodInstapay;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || !method || !plans || (first && !agreed)) return;
    const result = await page.run(
      'billing.submit',
      { planCode: plan.code, method, reference, periods, termsVersion: plans.terms.version },
      'billing.submit',
    );
    if (!result) {
      // The terms may have changed since the page loaded; show the current ones.
      await load();
      return;
    }
    setSubmitted(true);
    setReference('');
    await load();
  }

  async function copyAccount() {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account.account);
      setCopied(true);
    } catch {
      // The number is on screen to copy by hand.
    }
  }

  /** What the server says about this account's access, in one line. */
  function planLine(): string {
    const { entitlement, subscription } = me;
    if (entitlement.state === 'active' && entitlement.until) {
      return subscription.canceled
        ? strings.planCanceled
        : strings.planActive(formatDate(entitlement.until, lang));
    }
    if (subscription.pendingPayment) return strings.planPending;
    if (subscription.state === 'expired') return strings.planExpired;
    return strings.planNone;
  }

  function discountLine(discount: PlanDiscount): string {
    const name =
      discount.label?.[lang] ||
      (discount.percent !== null
        ? strings.discountPercent(discount.percent)
        : strings.discountSale);
    return `${name} · ${strings.discountUntil(formatDate(discount.endsAt, lang))}`;
  }

  function planCard(offer: PlanOfferV2, choosable: boolean) {
    const current = me.entitlement.state === 'active' && me.entitlement.plan === offer.code;
    const money = (minor: number) => formatMoney(minor, offer.price.currency, lang);
    const body = (
      <>
        <span className="hm-plan__head">
          <span className="hm-plan__name">{offer.details.name[lang]}</span>
          {current && <span className="hm-plan__badge">{strings.yourPlan}</span>}
        </span>
        {offer.details.description && (
          <span className="hm-plan__description">{offer.details.description[lang]}</span>
        )}
        <span className="hm-plan__price">
          {offer.discount && (
            <s className="hm-plan__was">
              <span className="hm-visually-hidden">{strings.wasPrice} </span>
              {money(offer.discount.listAmountMinor)}
            </s>
          )}
          {strings.price(money(offer.price.amountMinor), offer.price.periodDays)}
        </span>
        {offer.discount && (
          <span className="hm-plan__discount">{discountLine(offer.discount)}</span>
        )}
        <span className="hm-plan__limits">
          {strings.planLimits(
            offer.limits.ownedTeams,
            offer.limits.membersPerTeam,
            offer.limits.notesPerTeam,
          )}
        </span>
      </>
    );
    if (!choosable) return <div className="hm-plan">{body}</div>;
    return (
      <label key={offer.code} className="hm-plan hm-plan--choice">
        <input
          type="radio"
          name="hm-plan"
          className="hm-plan__radio"
          checked={offer.code === planCode}
          onChange={() => setPlanCode(offer.code)}
        />
        <span className="hm-plan__body">{body}</span>
      </label>
    );
  }

  const days = plan?.price.periodDays ?? 30;
  const totalAmount = plan
    ? formatMoney(plan.price.amountMinor * periods, plan.price.currency, lang)
    : '';
  const termsLinks = plans && (
    <>
      {' '}
      <a
        href={plans.terms.termsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hm-link hm-link--accent"
      >
        {strings.termsOfUse}
      </a>{' '}
      {strings.termsAnd}{' '}
      <a
        href={plans.terms.privacyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hm-link hm-link--accent"
      >
        {strings.privacyPolicy}
      </a>
      .
    </>
  );

  return (
    <>
      <p className="hm-section__intro">{planLine()}</p>

      {plan && plans && (
        <form className="hm-billing" onSubmit={submit}>
          {plans.plans.length > 1 ? (
            <fieldset className="hm-plans">
              <legend className="hm-overline">{strings.choosePlan}</legend>
              {plans.plans.map((offer) => planCard(offer, true))}
            </fieldset>
          ) : (
            planCard(plan, false)
          )}

          {plans.payment.accounts.length === 0 || !method || !account ? (
            <p className="hm-supporting">{strings.paymentsClosed}</p>
          ) : (
            <>
              <div className="hm-billing__choices">
                {plans.payment.accounts.length > 1 && (
                  <SegmentedControl<PaymentMethod>
                    value={method}
                    name="hm-pay-with"
                    groupLabel={strings.payWith}
                    options={plans.payment.accounts.map((a) => ({
                      value: a.method,
                      label: methodLabel(a.method),
                    }))}
                    onChange={(next) => {
                      setMethod(next);
                      setCopied(false);
                    }}
                  />
                )}
                <div className="hm-stepper" role="group" aria-label={strings.periodsLabel(days)}>
                  <span className="hm-stepper__label">{strings.periodsLabel(days)}</span>
                  <button
                    type="button"
                    className="hm-icon-btn"
                    aria-label={strings.fewerPeriods}
                    disabled={periods <= 1}
                    onClick={() => setPeriods((n) => Math.max(1, n - 1))}
                  >
                    −
                  </button>
                  <output className="hm-stepper__value" aria-live="polite">
                    {periods}
                  </output>
                  <button
                    type="button"
                    className="hm-icon-btn"
                    aria-label={strings.morePeriods}
                    disabled={periods >= MAX_PERIODS}
                    onClick={() => setPeriods((n) => Math.min(MAX_PERIODS, n + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              <p className="hm-billing__total">
                {strings.total(totalAmount, strings.periodsCount(periods, days))}
              </p>

              <h3 className="hm-overline">{strings.howToPay}</h3>
              <ol className="hm-pay-steps">
                <li>
                  {strings.payStepSend(totalAmount, methodLabel(method))}{' '}
                  <bdi className="hm-pay-steps__number" dir="ltr">
                    {account.account}
                  </bdi>{' '}
                  <button
                    type="button"
                    className="hm-btn hm-btn-ghost hm-btn--compact"
                    onClick={() => void copyAccount()}
                  >
                    {copied ? strings.copied : strings.copyNumber}
                  </button>
                  {method === 'vodafone_cash' && (
                    <span className="hm-pay-steps__hint">{strings.walletHint}</span>
                  )}
                </li>
                {plans.payment.confirm && (
                  <li>
                    {strings.payStepConfirm}{' '}
                    <a
                      className="hm-link hm-link--accent hm-pay-steps__number"
                      href={whatsappLink(plans.payment.confirm.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                    >
                      {plans.payment.confirm.whatsapp}
                    </a>
                  </li>
                )}
                <li>{strings.payStepReference}</li>
              </ol>

              <label className="hm-billing__field">
                <span className="hm-billing__field-label">{strings.referenceLabel}</span>
                <input
                  type="text"
                  required
                  className="hm-input"
                  placeholder={strings.referencePlaceholder}
                  value={reference}
                  onChange={(e) => {
                    setReference(e.target.value);
                    setSubmitted(false);
                  }}
                />
              </label>

              {first ? (
                <label className="hm-billing__terms">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span>
                    {strings.termsAgreeLead}
                    {termsLinks}
                  </span>
                </label>
              ) : (
                <p className="hm-supporting">
                  {strings.termsNoticeLead}
                  {termsLinks}
                </p>
              )}

              <button
                type="submit"
                className="hm-btn hm-btn-primary"
                disabled={page.working('billing.submit') || (first && !agreed) || !reference.trim()}
                aria-busy={page.working('billing.submit')}
              >
                {strings.submitPayment}
              </button>
            </>
          )}
        </form>
      )}
      {page.failed('billing.submit') && (
        <InlineError>{strings.error(page.failed('billing.submit')!)}</InlineError>
      )}

      {submitted && <StatusLine tone="success">{strings.paymentSubmitted}</StatusLine>}

      <h3 className="hm-overline hm-billing__history">{strings.paymentHistory}</h3>
      {payments && payments.length === 0 && <p className="hm-supporting">{strings.noPayments}</p>}
      {payments && payments.length > 0 && (
        <ul className="hm-team-invitations">
          {payments.map((payment) => (
            <li key={payment.id} className="hm-team-invitation">
              <span className="hm-team-invitation__who">
                <bdi>{payment.reference}</bdi>
                <span className="hm-team-member__meta">
                  {strings.paymentLine(
                    formatMoney(payment.amountMinor, payment.currency, lang),
                    formatDate(payment.submittedAt, lang),
                  )}{' '}
                  · {methodLabel(payment.method)}
                </span>
                {/* An admin's note only ever exists on a refusal. */}
                {payment.note && <span className="hm-team-member__meta">{payment.note}</span>}
              </span>
              <span className="hm-team-member__meta">{strings.paymentStatus(payment.status)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
