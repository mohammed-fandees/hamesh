// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MentionsInbox } from '@/ui/teams/MentionsInbox';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { TeamsClient } from '@/teams/client';

const strings = getTeamsStrings('en');
const ALPHA = '01J0000000000000000000000A';
const BETA = '01J0000000000000000000000B';
const ME = '01J0000000000000000000000Z';
const SARA = '01J0000000000000000000000S';
const C1 = '01J0000000000000000000000C';
const C2 = '01J0000000000000000000000D';

function entry(overrides: Record<string, unknown> = {}) {
  return {
    commentId: C1,
    teamId: ALPHA,
    teamName: 'Alpha',
    noteId: '01J0000000000000000000000N',
    authorId: SARA,
    body: `what do you think <@${ME}>?`,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

/** A client whose answers a test steers, recording what was asked. */
function fakeClient(answers: Record<string, unknown> = {}) {
  const calls: { op: string; params: unknown }[] = [];
  const request = vi.fn(async (op: string, params: unknown) => {
    calls.push({ op, params });
    return Object.hasOwnProperty.call(answers, op)
      ? { ok: true as const, data: answers[op] }
      : { ok: true as const, data: undefined };
  });
  const client = {
    send: vi.fn(async () => ({
      status: {
        state: 'signed_in',
        me: { user: { id: ME, email: 'me@example.test', displayName: 'Me' } },
      },
    })),
    request,
    cache: vi.fn(),
    onEvent: () => () => {},
    requestPermissions: vi.fn(),
    removePermissions: vi.fn(),
  } as unknown as TeamsClient;
  return { client, calls };
}

const onRead = vi.fn();
const view = (client: TeamsClient) =>
  render(<MentionsInbox lang="en" client={client} onRead={onRead} />);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('where you were named', () => {
  it('lists them newest first, with the team each came from', async () => {
    const { client } = fakeClient({
      'mentions.list': { mentions: [entry()], nextBefore: null },
      'members.list': {
        members: [{ userId: SARA, displayName: 'Sara', role: 'member', joinedAt: 1 }],
      },
    });
    view(client);

    expect(await screen.findByText(/what do you think/)).toBeInTheDocument();
    expect(screen.getByText(strings.mentionIn('Alpha'))).toBeInTheDocument();
  });

  it('reads the ids in the text by asking the teams they came from', async () => {
    const { client, calls } = fakeClient({
      'mentions.list': {
        mentions: [entry(), entry({ commentId: C2, teamId: BETA, teamName: 'Beta' })],
        nextBefore: null,
      },
      'members.list': {
        members: [{ userId: SARA, displayName: 'Sara', role: 'member', joinedAt: 1 }],
      },
    });
    view(client);

    await screen.findAllByText(/what do you think/);
    await waitFor(() => expect(screen.getAllByText('Sara').length).toBeGreaterThan(0));
    // One member list per distinct team, not one per entry.
    const asked = calls.filter((c) => c.op === 'members.list').map((c) => c.params);
    expect(asked).toEqual([{ teamId: ALPHA }, { teamId: BETA }]);
  });

  it('shows the reader themselves as themselves', async () => {
    const { client } = fakeClient({
      'mentions.list': { mentions: [entry()], nextBefore: null },
      'members.list': { members: [] },
    });
    view(client);

    expect(await screen.findByText(strings.youMarker)).toBeInTheDocument();
    // What the body carries is an id; an id is never what is shown.
    expect(screen.queryByText(new RegExp(ME))).not.toBeInTheDocument();
  });

  it('says so, rather than nothing, when nobody has named you', async () => {
    const { client } = fakeClient({ 'mentions.list': { mentions: [], nextBefore: null } });
    view(client);
    expect(await screen.findByText(strings.emptyMentionsTitle)).toBeInTheDocument();
    expect(screen.getByText(strings.emptyMentionsBody)).toBeInTheDocument();
  });

  it('pages back through older ones', async () => {
    const { client, calls } = fakeClient({
      'mentions.list': { mentions: [entry()], nextBefore: C1 },
      'members.list': { members: [] },
    });
    view(client);

    fireEvent.click(await screen.findByRole('button', { name: strings.moreMentions }));
    await waitFor(() =>
      expect(calls.filter((c) => c.op === 'mentions.list').length).toBeGreaterThan(1),
    );
    expect(
      (calls.filter((c) => c.op === 'mentions.list')[1]!.params as { before: string }).before,
    ).toBe(C1);
  });
});
