// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TeamsView } from '@/ui/teams/TeamsView';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { TeamsClient } from '@/teams/client';
import type { TeamsOpName } from '@/teams/operation-names';
import { OVERVIEW, type TeamsRoute } from '@/ui/teams/route';

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
          details: { name: { ar: 'فرق هامش', en: 'Hamesh Teams' }, description: null },
          discount: null,
        },
      ],
      payment: { accounts: [{ method: 'instapay', account: '01000000000' }], confirm: null },
      terms: {
        version: '2026-10-01',
        termsUrl: 'https://hamesh.example/terms.html',
        privacyUrl: 'https://hamesh.example/privacy.html',
      },
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
    cache: vi.fn(async () => ({
      ok: true as const,
      data: { notes: [], folders: [], syncedAt: 0 },
    })),
    requestPermissions: vi.fn(async () => true),
    removePermissions: vi.fn(async () => {}),
  };
  return { client: client as unknown as TeamsClient & typeof client, calls };
}

/** Sharing and unsharing, which the page asks the library to carry out. */
const personal = { forget: vi.fn(async () => {}), keep: vi.fn(async () => {}) };
/** Where "Subscribe" leads: the plan, in Settings. */
const openPlan = vi.fn();

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The page above owns the route in the real app; a test needs the same owner. */
function Harness({
  client,
  onOpenSettings,
  onOpenLibrary,
  initial = OVERVIEW,
}: {
  client: TeamsClient;
  onOpenSettings: () => void;
  onOpenLibrary: (owner: unknown) => void;
  initial?: TeamsRoute;
}) {
  const [route, setRoute] = useState<TeamsRoute>(initial);
  return (
    <TeamsView
      lang="en"
      client={client}
      onOpenSettings={onOpenSettings}
      onOpenPlan={openPlan}
      onOpenLibrary={onOpenLibrary}
      personal={personal}
      route={route}
      onRoute={setRoute}
    />
  );
}

const render_ = (
  client: TeamsClient,
  onOpenSettings = vi.fn(),
  onOpenLibrary = vi.fn(),
  initial?: TeamsRoute,
) =>
  render(
    <Harness
      client={client}
      onOpenSettings={onOpenSettings}
      onOpenLibrary={onOpenLibrary}
      initial={initial}
    />,
  );

/** The members page, which is where the people and the invitations are. */
const MEMBERS: TeamsRoute = { page: 'members', teamId: TEAM };

/** A client whose local copy of the team's notes and folders is the given one. */
function withSnapshot(
  client: ReturnType<typeof fakeClient>['client'],
  notes: ReturnType<typeof note>[],
  folders: { id: string; parentId: string | null; name: string }[],
) {
  client.cache = vi.fn(async () => ({
    ok: true as const,
    data: {
      notes,
      folders: folders.map((f) => ({ ...f, createdAt: 1, updatedAt: 1 })),
      syncedAt: 1_700_000_000_000,
    },
  })) as never;
}

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

const ANCHOR = {
  primarySelector: 'p',
  signals: { tagName: 'p' },
  fallbackDocumentPosition: { x: 0, y: 0 },
};
function note(id: string, folderId: string | null, content: string) {
  return {
    id,
    teamId: TEAM,
    originalUrl: 'https://example.test/article',
    pageTitle: 'An article',
    content,
    anchor: ANCHOR,
    folderId,
    authorId: ME_ID,
    version: 1,
    createdAt: 1,
    updatedAt: 2,
  };
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
    // The switcher is a segmented control, so each team is a radio.
    expect(await screen.findByRole('radio', { name: 'Alpha' })).toBeInTheDocument();
    // Who is in it is shown at a glance, as names; emails are for the page that
    // manages them.
    expect(await screen.findByText('Sara')).toBeInTheDocument();
    expect(screen.queryByText('sara@example.test')).not.toBeInTheDocument();
  });

  it('is an overview: no list of notes, folders as tiles, and a way into the Library', async () => {
    const onOpenLibrary = vi.fn();
    const { client } = fakeClient();
    withSnapshot(
      client,
      [
        note('n1', 'FOLDER', 'a thought worth keeping'),
        note('n2', null, 'a loose one'),
        // A folder that no longer exists leaves its note unfiled, never hidden.
        note('n3', 'gone', 'an orphan'),
      ],
      [{ id: 'FOLDER', parentId: null, name: 'Onboarding' }],
    );
    render_(client, vi.fn(), onOpenLibrary);

    const tile = await screen.findByRole('button', { name: /Onboarding/ });
    expect(tile).toHaveTextContent('1 note');
    expect(screen.getByRole('button', { name: /Unfiled/ })).toHaveTextContent('2 notes');
    // The notes themselves are read in the Library, not listed here.
    expect(screen.queryByText('a thought worth keeping')).not.toBeInTheDocument();

    fireEvent.click(tile);
    expect(onOpenLibrary).toHaveBeenLastCalledWith({
      teamId: TEAM,
      folder: { id: 'FOLDER', name: 'Onboarding' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Unfiled/ }));
    expect(onOpenLibrary).toHaveBeenLastCalledWith({
      teamId: TEAM,
      folder: { id: null, name: strings.unfiledSection },
    });
    fireEvent.click(screen.getByRole('button', { name: strings.openInLibrary }));
    expect(onOpenLibrary).toHaveBeenLastCalledWith({ teamId: TEAM });
  });

  it('says what to do about a team with nothing shared, and offers the way to do it', async () => {
    const onOpenLibrary = vi.fn();
    const { client } = fakeClient();
    render_(client, vi.fn(), onOpenLibrary);

    expect(await screen.findByText(strings.emptyNotesTitle('Alpha'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: strings.goToLibrary }));
    expect(onOpenLibrary).toHaveBeenCalledWith({ teamId: TEAM });
  });

  it('creates, renames and deletes a team folder, asking on the tile before deleting', async () => {
    const { client, calls } = fakeClient({
      'team.get': { ...team, capabilities: [...team.capabilities, 'folders.manage'] },
      'folders.create': { folder: {} },
      'folders.rename': { folder: {} },
      'folders.delete': {},
    });
    withSnapshot(client, [], [{ id: 'FOLDER', parentId: null, name: 'Reading' }]);
    render_(client);
    await screen.findByText('Reading');

    fireEvent.click(screen.getByRole('button', { name: strings.newFolder }));
    fireEvent.change(screen.getByLabelText(strings.newFolder), {
      target: { value: '  Onboarding  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: strings.create }));
    await waitFor(() => expect(calls.some((c) => c.op === 'folders.create')).toBe(true));
    // Trimmed before it is sent, by the one name field every folder name uses.
    expect(calls.find((c) => c.op === 'folders.create')!.params).toEqual({
      teamId: TEAM,
      name: 'Onboarding',
    });

    // A folder's actions are in its own menu, the same one the Library's have.
    const menu = () => screen.getByRole('button', { name: strings.folderActions('Reading') });
    fireEvent.click(menu());
    fireEvent.click(screen.getByRole('menuitem', { name: strings.renameFolder }));
    fireEvent.change(screen.getByLabelText(strings.renameFolder), {
      target: { value: ' Papers ' },
    });
    fireEvent.click(screen.getByRole('button', { name: strings.save }));
    await waitFor(() => expect(calls.some((c) => c.op === 'folders.rename')).toBe(true));
    // A rename is trimmed too — it used to keep the spaces around the name.
    expect(calls.find((c) => c.op === 'folders.rename')!.params).toEqual({
      teamId: TEAM,
      folderId: 'FOLDER',
      name: 'Papers',
    });

    fireEvent.click(menu());
    fireEvent.click(screen.getByRole('menuitem', { name: strings.deleteFolder }));
    // Asked in place, never in a browser dialog, and nothing has happened yet.
    expect(screen.getByText(strings.deleteTeamFolderConfirm('Reading'))).toBeInTheDocument();
    expect(calls.some((c) => c.op === 'folders.delete')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: strings.deleteFolder }));
    await waitFor(() => expect(calls.some((c) => c.op === 'folders.delete')).toBe(true));
  });

  it('shows no folder controls at all to someone the server did not let manage them', async () => {
    const { client } = fakeClient({ 'team.get': { ...team, capabilities: ['team.view'] } });
    withSnapshot(client, [], [{ id: 'FOLDER', parentId: null, name: 'Reading' }]);
    render_(client);
    await screen.findByText('Reading');

    expect(screen.queryByRole('button', { name: strings.newFolder })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: strings.folderActions('Reading') }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.renameFolder })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.deleteFolder })).not.toBeInTheDocument();
  });

  it('opens the members page from the overview, and comes back by the breadcrumb', async () => {
    const { client } = fakeClient();
    render_(client);
    fireEvent.click(await screen.findByRole('button', { name: strings.manage }));

    expect(await screen.findByText('sara@example.test')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: strings.whoIsIn('Alpha') }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: strings.teams }));
    expect(await screen.findByRole('radio', { name: 'Alpha' })).toBeInTheDocument();
  });

  it('shows only the controls the server said this caller holds', async () => {
    const { client } = fakeClient({
      'team.get': { ...team, capabilities: ['team.view', 'team.leave'] },
    });
    render_(client);
    await screen.findByText('Sara');
    // No delete without the capability for it, and no way to invite.
    expect(screen.queryByRole('button', { name: strings.deleteTeam })).toBeNull();
    expect(screen.queryByRole('button', { name: `+ ${strings.inviteSomeone}` })).toBeNull();
    expect(screen.getByRole('button', { name: strings.leaveTeam })).toBeInTheDocument();
    cleanup();

    // And on the page that manages people: no promote, remove or invite.
    render_(client, vi.fn(), vi.fn(), MEMBERS);
    await screen.findByText('sara@example.test');
    for (const name of [strings.makeAdmin, strings.removeMember, strings.sendInvite]) {
      expect(screen.queryByRole('button', { name }), name).toBeNull();
    }
  });

  it('promotes a member through the server, then re-reads it', async () => {
    const { client, calls } = fakeClient();
    render_(client, vi.fn(), vi.fn(), MEMBERS);
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
    render_(client, vi.fn(), vi.fn(), MEMBERS);
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

  it('says when a team is read-only, with the date the server gave', async () => {
    const { client } = fakeClient({
      'team.get': {
        ...team,
        team: { ...team.team, state: 'read_only', readOnlyUntil: Date.UTC(2026, 0, 15) },
      },
    });
    render_(client);
    // Said once, as a status, and only because it is not the ordinary state.
    expect(await screen.findByText(/Read-only until/)).toBeInTheDocument();
  });

  it('says nothing at all about a team that is simply working', async () => {
    const { client } = fakeClient();
    render_(client);
    await screen.findByRole('radio', { name: 'Alpha' });
    expect(screen.queryByText(/Read-only/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Active$/)).not.toBeInTheDocument();
  });

  it('reports a failure in the reader’s own words', async () => {
    const { client } = fakeClient();
    client.request = vi.fn(async () => ({ ok: false, error: 'team_locked' })) as never;
    render_(client);
    expect(await screen.findByText(strings.error('team_locked'))).toBeInTheDocument();
  });
});

describe('founding a team is an owner’s, and owners subscribe', () => {
  /** The same reader, with the given access and teams. */
  function signedInAs(entitlement: typeof me.entitlement | object, teams = me.teams) {
    const { client } = fakeClient();
    client.send = vi.fn(async () => ({
      status: { state: 'signed_in', me: { ...me, entitlement, teams } },
    })) as never;
    return client;
  }
  const NONE = { state: 'none', plan: null, until: null, limits: null, sources: [] };

  it('says so before a team is named, and leads to the plan', async () => {
    render_(signedInAs(NONE, []));
    expect(await screen.findByText(strings.needsPlanTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.createTeam })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: strings.seePlan }));
    expect(openPlan).toHaveBeenCalled();
  });

  it('offers a member of someone else’s team the way to the plan, not a name field', async () => {
    render_(signedInAs(NONE, [{ id: TEAM, name: 'Alpha', role: 'member' }]));
    const subscribe = await screen.findByRole('button', { name: strings.subscribeToCreate });
    fireEvent.click(subscribe);
    expect(openPlan).toHaveBeenCalled();
  });

  it('says the plan’s limit is reached instead of offering a team it cannot have', async () => {
    const atLimit = {
      ...me.entitlement,
      limits: { ...me.entitlement.limits, ownedTeams: 1 },
    };
    render_(signedInAs(atLimit));
    expect(await screen.findByText(strings.atTeamLimit(1))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.createTeam })).not.toBeInTheDocument();
  });
});
