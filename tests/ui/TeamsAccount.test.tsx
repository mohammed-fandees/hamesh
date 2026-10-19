// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TeamsAccount } from '@/ui/teams/TeamsAccount';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { TeamsClient } from '@/teams/client';
import { formatDate } from '@/ui/format';
import type { TeamsOpName } from '@/teams/operation-names';

const strings = getTeamsStrings('en');
const TEAM = '01J0000000000000000000000A';
const ME = '01J0000000000000000000000Z';

const me = {
  user: { id: ME, email: 'me@example.test', displayName: 'Me' },
  entitlement: {
    state: 'none',
    plan: null,
    until: null,
    limits: null,
    sources: [],
  },
  subscription: { state: 'none', canceled: false, pendingPayment: null },
  teams: [],
  serverTime: 1,
};

const plans = {
  plans: [
    {
      code: 'teams',
      price: { amountMinor: 45_000, currency: 'EGP', periodDays: 30 },
      limits: { ownedTeams: 3, membersPerTeam: 10, notesPerTeam: 5000 },
      details: { name: { ar: 'فرق هامش', en: 'Hamesh Teams' }, description: null },
      discount: null,
    },
  ],
  payment: {
    accounts: [
      { method: 'instapay', account: '01000000000' },
      { method: 'vodafone_cash', account: '01111111111' },
    ],
    confirm: { whatsapp: '+201222222222' },
  },
  terms: {
    version: '2026-10-01',
    termsUrl: 'https://hamesh.example/terms.html',
    privacyUrl: 'https://hamesh.example/privacy.html',
  },
};

/** A client whose answers a test steers, recording what was asked. */
function fakeClient(
  overrides: Partial<Record<TeamsOpName, unknown>> = {},
  signedIn = true,
  who: typeof me = me,
) {
  const answers: Partial<Record<TeamsOpName, unknown>> = {
    'billing.plans': plans,
    'billing.payments': { payments: [] },
    ...overrides,
  };
  const calls: { op: TeamsOpName; params: unknown }[] = [];
  const client = {
    send: vi.fn(async () => ({
      status: signedIn ? { state: 'signed_in', me: who } : { state: 'signed_out' },
    })),
    request: vi.fn(async (op: TeamsOpName, params: unknown) => {
      calls.push({ op, params });
      return Object.hasOwnProperty.call(answers, op)
        ? { ok: true, data: answers[op] }
        : { ok: true, data: undefined };
    }),
    cache: vi.fn(),
    onEvent: () => () => {},
    requestPermissions: vi.fn(),
    removePermissions: vi.fn(),
  };
  return { client: client as unknown as TeamsClient, calls };
}

const view = (client: TeamsClient, onJoined = vi.fn()) =>
  render(<TeamsAccount lang="en" client={client} onJoined={onJoined} />);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('the account’s own half of Teams, in Settings', () => {
  it('shows nothing at all to someone who is not signed in', async () => {
    const { client, calls } = fakeClient({}, false);
    view(client);
    await waitFor(() => expect(client.send).toHaveBeenCalled());
    expect(screen.queryByText(strings.joinTeam)).not.toBeInTheDocument();
    expect(calls, 'and asks the server for nothing').toHaveLength(0);
  });

  it('checks a pasted invite link before joining, and never puts the token in a URL', async () => {
    const token = 'a'.repeat(43);
    const onJoined = vi.fn();
    const { client, calls } = fakeClient({
      'invites.preview': {
        team: { id: TEAM, name: 'Alpha' },
        invitedBy: 'Sara',
        role: 'member',
        expiresAt: Date.UTC(2026, 9, 1),
      },
      'invites.accept': {
        team: { id: TEAM, name: 'Alpha', role: 'member', state: 'active', readOnlyUntil: null },
        capabilities: ['team.view'],
        serverTime: 1,
      },
    });
    view(client, onJoined);

    fireEvent.change(await screen.findByPlaceholderText(strings.joinPlaceholder), {
      target: { value: `https://hamesh.app/join#${token}` },
    });
    fireEvent.click(screen.getByRole('button', { name: strings.joinCheck }));

    await waitFor(() => expect(calls.some((c) => c.op === 'invites.preview')).toBe(true));
    // The token travels in the body of the request, never in its path.
    expect(calls.find((c) => c.op === 'invites.preview')!.params).toEqual({ token });

    fireEvent.click(await screen.findByRole('button', { name: strings.joinAccept }));
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith(TEAM));
  });

  it('refuses a link that is not one, without asking the server', async () => {
    const { client, calls } = fakeClient();
    view(client);

    fireEvent.change(await screen.findByPlaceholderText(strings.joinPlaceholder), {
      target: { value: 'https://example.test/not-an-invite' },
    });
    fireEvent.click(screen.getByRole('button', { name: strings.joinCheck }));

    // A refusal, said beside the field — and nothing sent.
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(calls.some((c) => c.op === 'invites.preview')).toBe(false);
  });

  it('shows the price, the total, and where to pay — all of it the server’s', async () => {
    const { client } = fakeClient();
    view(client);

    // Nothing about the amount or the account is written into the extension.
    expect((await screen.findAllByText(/450/)).length).toBeGreaterThan(0);
    expect(screen.getByText('01000000000')).toBeInTheDocument();
    expect(screen.getByText('+201222222222').closest('a')).toHaveAttribute(
      'href',
      'https://wa.me/201222222222',
    );

    // Months, and the total they come to, said as the reader changes them.
    fireEvent.click(screen.getByRole('button', { name: strings.morePeriods }));
    // The step that says what to send now says the new total, too.
    expect(screen.getAllByText(/900/).length).toBe(2);
    expect(screen.getByText(new RegExp(strings.periodsCount(2, 30)))).toBeInTheDocument();
  });

  it('asks for agreement to the terms on a first payment, and sends their version', async () => {
    const { client, calls } = fakeClient({
      'billing.submit': { payment: { id: '1', status: 'pending' } },
    });
    view(client);

    fireEvent.change(await screen.findByPlaceholderText(strings.referencePlaceholder), {
      target: { value: 'REF-9' },
    });
    const pay = screen.getByRole('button', { name: strings.submitPayment });
    expect(pay, 'not before the terms are agreed to').toBeDisabled();
    expect(screen.getByRole('link', { name: strings.termsOfUse })).toHaveAttribute(
      'href',
      'https://hamesh.example/terms.html',
    );

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(pay);

    await waitFor(() => expect(calls.some((c) => c.op === 'billing.submit')).toBe(true));
    expect(calls.find((c) => c.op === 'billing.submit')!.params).toMatchObject({
      planCode: 'teams',
      method: 'instapay',
      reference: 'REF-9',
      periods: 1,
      termsVersion: '2026-10-01',
    });
  });

  /** Two plans on offer; the second with a discount running on it. */
  const plus = {
    code: 'teams-plus',
    price: { amountMinor: 72_000, currency: 'EGP', periodDays: 30 },
    limits: { ownedTeams: 10, membersPerTeam: 50, notesPerTeam: 20000 },
    details: {
      name: { ar: 'فرق هامش بلس', en: 'Hamesh Teams Plus' },
      description: { ar: 'للفرق الكبيرة', en: 'For bigger teams' },
    },
    discount: {
      kind: 'percent',
      percent: 20,
      listAmountMinor: 90_000,
      endsAt: Date.UTC(2026, 10, 15),
      label: null,
    },
  };
  const twoPlans = { ...plans, plans: [...plans.plans, plus] };

  it('offers a choice of plan, and pays for the one chosen at its discounted price', async () => {
    const { client, calls } = fakeClient({
      'billing.plans': twoPlans,
      'billing.submit': { payment: { id: '1', status: 'pending' } },
    });
    view(client);

    const group = await screen.findByRole('group', { name: strings.choosePlan });
    expect(group).toBeInTheDocument();
    const [basic, better] = within(group).getAllByRole('radio');
    // Nothing chosen before: the first plan on offer.
    expect(basic).toBeChecked();
    expect(better).not.toBeChecked();

    // The discount: the old price struck through, what it is, and until when.
    expect(screen.getByText('For bigger teams')).toBeInTheDocument();
    expect(screen.getByText(/EGP\s?900/).closest('s')).not.toBeNull();
    expect(screen.getByText(new RegExp(strings.discountPercent(20)))).toBeInTheDocument();

    fireEvent.click(better!);
    expect(better).toBeChecked();
    // The total is the price the server sent, the discount already in it.
    expect(screen.getByText(new RegExp(`Total: EGP\\s?720`))).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(strings.referencePlaceholder), {
      target: { value: 'REF-7' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: strings.submitPayment }));
    await waitFor(() => expect(calls.some((c) => c.op === 'billing.submit')).toBe(true));
    expect(calls.find((c) => c.op === 'billing.submit')!.params).toMatchObject({
      planCode: 'teams-plus',
      reference: 'REF-7',
    });
  });

  it('starts from the plan the account is on, and marks it', async () => {
    const onPlus = {
      ...me,
      entitlement: {
        ...me.entitlement,
        state: 'active',
        plan: 'teams-plus',
        until: Date.UTC(2026, 11, 1),
      },
    };
    const { client } = fakeClient(
      { 'billing.plans': twoPlans },
      true,
      onPlus as unknown as typeof me,
    );
    view(client);

    const better = await screen.findByRole('radio', { name: /Hamesh Teams Plus/ });
    expect(better).toBeChecked();
    expect(better.closest('label')).toHaveTextContent(strings.yourPlan);
  });

  it('shows a single plan as it is, with nothing to choose', async () => {
    const { client } = fakeClient();
    view(client);
    expect(await screen.findByText('Hamesh Teams')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: strings.choosePlan })).not.toBeInTheDocument();
    expect(document.querySelector('input[name="hm-plan"]')).toBeNull();
    expect(screen.getByText(strings.planLimits(3, 10, 5000))).toBeInTheDocument();
  });

  it('offers a mobile wallet beside InstaPay, saying any wallet will do', async () => {
    const { client, calls } = fakeClient({
      'billing.submit': { payment: { id: '1', status: 'pending' } },
    });
    view(client);

    const wallet = await screen.findByRole('radio', { name: strings.methodWallet });
    expect(screen.queryByText(strings.walletHint)).not.toBeInTheDocument();
    fireEvent.click(wallet);
    // The wallet's number, from the server, and which wallets can send to it.
    expect(screen.getByText('01111111111')).toBeInTheDocument();
    expect(screen.getByText(strings.walletHint)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(strings.referencePlaceholder), {
      target: { value: 'W-1' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: strings.submitPayment }));
    await waitFor(() => expect(calls.some((c) => c.op === 'billing.submit')).toBe(true));
    expect(calls.find((c) => c.op === 'billing.submit')!.params).toMatchObject({
      method: 'vodafone_cash',
    });
  });

  /** The free plan as the live server lists it: first, at a price of nothing. */
  const freePlan = {
    code: 'teams-free',
    price: { amountMinor: 0, currency: 'EGP', periodDays: 30 },
    limits: { ownedTeams: 1, membersPerTeam: 10, notesPerTeam: 5000 },
    details: { name: { ar: 'المجانية', en: 'Free' }, description: null },
    discount: null,
  };
  const withFree = { ...plans, plans: [freePlan, ...plans.plans] };
  const until = Date.UTC(2026, 10, 18);
  const onFree = {
    ...me,
    entitlement: { ...me.entitlement, state: 'active', plan: 'teams-free', until },
  } as unknown as typeof me;

  it('shows the free plan the server put the account on, with nothing to pay', async () => {
    const { client, calls } = fakeClient({ 'billing.plans': withFree }, true, onFree);
    view(client);

    const free = await screen.findByRole('radio', { name: /Free/ });
    expect(free).toBeChecked();
    expect(free.closest('label')).toHaveTextContent(strings.yourPlan);
    expect(free.closest('label')).toHaveTextContent(strings.freePrice(30));
    expect(screen.getByText(strings.planFree(formatDate(until, 'en')))).toBeInTheDocument();
    expect(screen.getByText(strings.planFreeRenews)).toBeInTheDocument();
    expect(screen.getByText(strings.freeIsYours)).toBeInTheDocument();

    // No way to pay for it, or to send anything at all.
    expect(screen.queryByPlaceholderText(strings.referencePlaceholder)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.submitPayment })).not.toBeInTheDocument();
    expect(calls.some((c) => c.op === 'billing.submit')).toBe(false);
  });

  it('pays for a paid plan chosen from the free one, saying the free one comes back', async () => {
    const { client, calls } = fakeClient(
      {
        'billing.plans': withFree,
        'billing.submit': { payment: { id: '1', status: 'pending' } },
      },
      true,
      onFree,
    );
    view(client);

    fireEvent.click(await screen.findByRole('radio', { name: /Hamesh Teams/ }));
    expect(screen.queryByText(strings.freeIsYours)).not.toBeInTheDocument();
    expect(screen.getByText(strings.paidStartsNow('Hamesh Teams'))).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(strings.referencePlaceholder), {
      target: { value: 'UP-1' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: strings.submitPayment }));
    await waitFor(() => expect(calls.some((c) => c.op === 'billing.submit')).toBe(true));
    expect(calls.find((c) => c.op === 'billing.submit')!.params).toMatchObject({
      planCode: 'teams',
      reference: 'UP-1',
    });
  });

  it('says a paying account returns to the free plan by itself', async () => {
    const onPaid = {
      ...me,
      entitlement: { ...me.entitlement, state: 'active', plan: 'teams', until },
    } as unknown as typeof me;
    const { client } = fakeClient({ 'billing.plans': withFree }, true, onPaid);
    view(client);

    expect(await screen.findByRole('radio', { name: /Hamesh Teams/ })).toBeChecked();
    // Not the free plan's line: this account pays.
    expect(screen.getByText(strings.planActive(formatDate(until, 'en')))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Free/ }));
    expect(screen.getByText(strings.freeLater)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.submitPayment })).not.toBeInTheDocument();
  });

  it('says payments are closed when the server offers no account to pay', async () => {
    const { client } = fakeClient({
      'billing.plans': { ...plans, payment: { accounts: [], confirm: null } },
    });
    view(client);
    expect(await screen.findByText(strings.paymentsClosed)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.submitPayment })).not.toBeInTheDocument();
  });
});
