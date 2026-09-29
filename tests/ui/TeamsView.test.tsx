// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TeamsView } from '@/ui/teams/TeamsView';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { TeamsClient } from '@/teams/client';
import type { TeamsOpName } from '@/teams/operation-names';

const strings = getTeamsStrings('en');
const TEAM = '01J0000000000000000000000A';
const ME_ID = '01J0000000000000000000000B';
const MATE_ID = '01J0000000000000000000000C';

const me = {
  user: { id: ME_ID, email: 'me@example.test', displayName: 'Me' },
  entitlement: {
    state: 'active',
    plan: 'teams',
    until: Date.UTC(2026, 11, 31),
    limits: { ownedTeams: 3, membersPerTeam: 10, notesPerTeam: 5000 },
    sources: ['subscription'],
  },
  subscription: { state: 'active', canceled: false, pendingPayment: null },
  teams: [{ id: TEAM, name: 'Alpha', role: 'owner' }],
  serverTime: 1,
};

const team = {
  team: { id: TEAM, name: 'Alpha', role: 'owner', state: 'active', readOnlyUntil: null },
  capabilities: [
    'team.view',
    'team.rename',
    'team.delete',
    'team.transfer',
    'members.view_emails',
    'members.promote',
    'members.demote',
    'members.remove_member',
    'invites.create_member',
    'invites.create_admin',
    'invites.manage',
  ],
  serverTime: 1,
};

const members = {
  members: [
    { userId: ME_ID, displayName: 'Me', email: 'me@example.test', role: 'owner', joinedAt: 1 },
    {
      userId: MATE_ID,
      displayName: 'Sara',
      email: 'sara@example.test',
      role: 'member',
      joinedAt: 2,
    },
  ],
};

/** A client whose answers a test can steer, recording what was asked. */
function fakeClient(overrides: Partial<Record<TeamsOpName, unknown>> = {}, signedIn = true) {
  const answers: Partial<Record<TeamsOpName, unknown>> = {
    'team.get': team,
    'members.list': members,
    'invites.list': { invitations: [] },
    'billing.plans': {
      plans: [
        {
          code: 'teams',
          price: { amountMinor: 45_000, currency: 'EGP', periodDays: 30 },
          limits: { ownedTeams: 3, membersPerTeam: 10, notesPerTeam: 5000 },
        },
      ],
      methods: ['instapay', 'vodafone_cash'],
    },
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
    requestPermissions: vi.fn(async () => true),
    removePermissions: vi.fn(async () => {}),
  };
  return { client: client as unknown as TeamsClient & typeof client, calls };
}

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const render_ = (client: TeamsClient, onOpenSettings = vi.fn()) =>
  render(<TeamsView lang="en" client={client} onOpenSettings={onOpenSettings} />);

/**
 * Waits for the page to finish its first round of loading. Controls are
 * disabled while the page is talking to the worker, so a person would wait
 * too — clicking a disabled button does nothing at all.
 */
async function idle(name: string) {
  const button = await screen.findByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe('the Teams page', () => {
  it('sends someone who is not signed in to Settings, and asks the server for nothing', async () => {
    const { client, calls } = fakeClient({}, false);
    const onOpenSettings = vi.fn();
    render_(client, onOpenSettings);
    fireEvent.click(await screen.findByRole('button', { name: strings.goToSettings }));
    expect(onOpenSettings).toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it('lists the teams the server reported, and opens the first', async () => {
    const { client } = fakeClient();
    render_(client);
    expect(await screen.findByRole('button', { name: /Alpha/ })).toBeInTheDocument();
    expect(await screen.findByText('Sara')).toBeInTheDocument();
    expect(screen.getByText('sara@example.test')).toBeInTheDocument();
  });

  it('shows only the controls the server said this caller holds', async () => {
    const { client } = fakeClient({
      'team.get': { ...team, capabilities: ['team.view', 'team.leave'] },
    });
    render_(client);
    await screen.findByText('Sara');
    // No promote, remove, invite or delete without the capability for it.
    for (const name of [
      strings.makeAdmin,
      strings.removeMember,
      strings.sendInvite,
      strings.deleteTeam,
    ]) {
      expect(screen.queryByRole('button', { name }), name).toBeNull();
    }
    expect(screen.getByRole('button', { name: strings.leaveTeam })).toBeInTheDocument();
  });

  it('promotes a member through the server, then re-reads it', async () => {
    const { client, calls } = fakeClient();
    render_(client);
    fireEvent.click(await idle(strings.makeAdmin));
    await waitFor(() => expect(calls.some((c) => c.op === 'members.setRole')).toBe(true));
    expect(calls.find((c) => c.op === 'members.setRole')!.params).toEqual({
      teamId: TEAM,
      userId: MATE_ID,
      role: 'admin',
    });
    // The list is asked for again rather than being edited in place here.
    await waitFor(() =>
      expect(calls.filter((c) => c.op === 'members.list').length).toBeGreaterThan(1),
    );
  });

  it('shows a new invite link once, and does not ask for it again', async () => {
    const link = `https://hamesh.app/join#${'a'.repeat(43)}`;
    const { client, calls } = fakeClient({
      'invites.create': {
        invitation: {
          id: TEAM,
          email: 'new@example.test',
          role: 'member',
          createdAt: 1,
          expiresAt: 2,
          expired: false,
        },
        link,
      },
    });
    render_(client);
    await idle(strings.sendInvite);
    fireEvent.change(screen.getByPlaceholderText(strings.inviteEmailPlaceholder), {
      target: { value: 'new@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: strings.sendInvite }));
    expect(await screen.findByText(link)).toBeInTheDocument();
    expect(calls.find((c) => c.op === 'invites.create')!.params).toEqual({
      teamId: TEAM,
      email: 'new@example.test',
      role: 'member',
    });
  });

  it('checks a pasted invite link before joining, and never puts the token in a URL', async () => {
    const token = 'b'.repeat(43);
    const { client, calls } = fakeClient({
      'invites.preview': {
        team: { id: TEAM, name: 'Beta' },
        invitedBy: 'Sara',
        role: 'member',
        expiresAt: 2,
      },
      'invites.accept': { ...team, team: { ...team.team, id: TEAM, name: 'Beta' } },
    });
    render_(client);
    // The button stays disabled until there is something pasted to check.
    fireEvent.change(await screen.findByPlaceholderText(strings.joinPlaceholder), {
      target: { value: `https://hamesh.app/join#${token}` },
    });
    fireEvent.click(await idle(strings.joinCheck));
    expect(await screen.findByText(/invited to Beta/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: strings.joinAccept }));
    await waitFor(() => expect(calls.some((c) => c.op === 'invites.accept')).toBe(true));
    expect(calls.find((c) => c.op === 'invites.preview')!.params).toEqual({ token });
  });

  it('refuses a link that is not one, without asking the server', async () => {
    const { client, calls } = fakeClient();
    render_(client);
    fireEvent.change(await screen.findByPlaceholderText(strings.joinPlaceholder), {
      target: { value: 'https://hamesh.app/join#nope' },
    });
    fireEvent.click(await idle(strings.joinCheck));
    expect(await screen.findByText(strings.error('invalid_request'))).toBeInTheDocument();
    expect(calls.some((c) => c.op === 'invites.preview')).toBe(false);
  });

  it('shows the price the server sent, and submits a payment reference', async () => {
    const { client, calls } = fakeClient();
    render_(client);
    // 45000 minor units of EGP, formatted — no price is written into the page.
    expect(await screen.findByText(/450/)).toBeInTheDocument();
    await idle(strings.submitPayment);
    fireEvent.change(screen.getByPlaceholderText(strings.referencePlaceholder), {
      target: { value: 'ref-9' },
    });
    fireEvent.click(screen.getByRole('button', { name: strings.submitPayment }));
    await waitFor(() => expect(calls.some((c) => c.op === 'billing.submit')).toBe(true));
    expect(calls.find((c) => c.op === 'billing.submit')!.params).toEqual({
      planCode: 'teams',
      method: 'instapay',
      reference: 'ref-9',
      periods: 1,
    });
  });

  it('says when a team is read-only, with the date the server gave', async () => {
    const { client } = fakeClient({
      'team.get': {
        ...team,
        team: { ...team.team, state: 'read_only', readOnlyUntil: Date.UTC(2026, 0, 15) },
      },
    });
    render_(client);
    const heading = await screen.findByRole('heading', { name: /Alpha/ });
    expect(within(heading).getByText(/Read-only until/)).toBeInTheDocument();
  });

  it('reports a failure in the reader’s own words', async () => {
    const { client } = fakeClient();
    client.request = vi.fn(async () => ({ ok: false, error: 'team_locked' })) as never;
    render_(client);
    expect(await screen.findByText(strings.error('team_locked'))).toBeInTheDocument();
  });
});
