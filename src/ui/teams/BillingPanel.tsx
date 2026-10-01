import { useCallback, useEffect, useState } from 'react';
import type { MeResponse, PaymentView, PlansResponse } from '@hamesh/teams-contract';
import type { Lang } from '../i18n';
import { InlineError, StatusLine } from '../kit/Feedback';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import { formatDate, formatMoney } from '../format';

interface BillingPanelProps {
  strings: TeamsStrings;
  lang: Lang;
  page: TeamsPage;
  me: MeResponse;
}

/**
 * The plan, and how to pay for it.
 *
 * Every number here — price, currency, period, limits, dates, status — comes
 * from the server. The extension knows no prices: it shows what `/v1/plans`
 * offers, and submits a reference for money the user moved elsewhere. Whether
 * that payment counts is decided by a person on the server's side, never here.
 */
export function BillingPanel({ strings, lang, page, me }: BillingPanelProps) {
  const [plans, setPlans] = useState<PlansResponse | null>(null);
  const [payments, setPayments] = useState<PaymentView[] | null>(null);
  const [method, setMethod] = useState<string>('');
  const [reference, setReference] = useState('');
  const [periods, setPeriods] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    const [offered, history] = await Promise.all([
      page.run('billing.plans', {}),
      page.run('billing.payments', {}),
    ]);
    if (offered) {
      setPlans(offered);
      setMethod((current) => current || (offered.methods[0] ?? ''));
    }
    if (history) setPayments(history.payments);
  }, [page]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [offered, history] = await Promise.all([
        page.run('billing.plans', {}),
        page.run('billing.payments', {}),
      ]);
      if (cancelled) return;
      if (offered) {
        setPlans(offered);
        setMethod(offered.methods[0] ?? '');
      }
      if (history) setPayments(history.payments);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = plans?.plans[0] ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || !method) return;
    const result = await page.run(
      'billing.submit',
      {
        planCode: plan.code,
        method: method as 'instapay' | 'vodafone_cash',
        reference,
        periods,
      },
      'billing.submit',
    );
    if (!result) return;
    setSubmitted(true);
    setReference('');
    await load();
  }

  const methodLabel = (m: string) =>
    m === 'vodafone_cash' ? strings.methodVodafoneCash : strings.methodInstapay;

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

  return (
    <>
      <p className="hm-section__intro">{planLine()}</p>

      {plan && (
        <form className="hm-billing" onSubmit={submit}>
          <p className="hm-billing__price">
            {strings.price(
              formatMoney(plan.price.amountMinor, plan.price.currency, lang),
              plan.price.periodDays,
            )}
          </p>

          <div className="hm-team-invite">
            <select
              className="hm-input"
              aria-label={strings.payWith}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {plans?.methods.map((m) => (
                <option key={m} value={m}>
                  {methodLabel(m)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={12}
              className="hm-input hm-input--number"
              aria-label={strings.periods}
              value={periods}
              onChange={(e) => setPeriods(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
            />
            <input
              type="text"
              required
              className="hm-input"
              placeholder={strings.referencePlaceholder}
              aria-label={strings.referencePlaceholder}
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                setSubmitted(false);
              }}
            />
            <button
              type="submit"
              className="hm-btn hm-btn-primary"
              disabled={page.working('billing.submit')}
              aria-busy={page.working('billing.submit')}
            >
              {strings.submitPayment}
            </button>
          </div>
          <p className="hm-supporting">{strings.referenceHint}</p>
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
