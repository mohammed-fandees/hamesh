// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TeamsAccount } from '@/ui/teams/TeamsAccount';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { TeamsClient } from '@/teams/client';
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
    },
  ],
  methods: ['instapay', 'vodafone_cash'],
};

/** A client whose answers a test steers, recording what was asked. */
function fakeClient(overrides: Partial<Record<TeamsOpName, unknown>> = {}, signedIn = true) {
  const answers: Partial<Record<TeamsOpName, unknown>> = {
    'billing.plans': plans,
    'billing.payments': { payments: [] },
    ...overrides,
  };
  const calls: { op: TeamsOpName; params: unknown }[] = [];
  const client = {
    send: vi.fn(async () => ({
      status: signedIn ? { state: 'signed_in', me } : { state: 'signed_out' },
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

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(calls.some((c) => c.op === 'invites.preview')).toBe(false);
  });

  it('shows the price the server sent, and submits a payment reference', async () => {
    const { client, calls } = fakeClient({
      'billing.submit': { payment: { id: '1', status: 'pending' } },
    });
    view(client);

    // The amount and currency are the server's; nothing about them is written
    // into the extension.
    expect(await screen.findByText(/450/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(strings.referencePlaceholder), {
      target: { value: 'REF-9' },
    });
    fireEvent.click(screen.getByRole('button', { name: strings.submitPayment }));

    await waitFor(() => expect(calls.some((c) => c.op === 'billing.submit')).toBe(true));
    expect(calls.find((c) => c.op === 'billing.submit')!.params).toMatchObject({
      planCode: 'teams',
      reference: 'REF-9',
    });
  });
});
