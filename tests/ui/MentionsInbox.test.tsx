// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MentionsInbox } from '@/ui/teams/MentionsInbox';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { TeamsPage } from '@/ui/teams/useTeams';

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

function fakePage(answers: Record<string, unknown> = {}) {
  const calls: { op: string; params: unknown }[] = [];
  const run = vi.fn(async (op: string, params: unknown) => {
    calls.push({ op, params });
    return (Object.hasOwnProperty.call(answers, op) ? answers[op] : undefined) as never;
  });
  const page = {
    status: { state: 'signed_in', me: null },
    me: null,
    error: null,
    busy: false,
    clearError: vi.fn(),
    refresh: vi.fn(async () => {}),
    run,
    cache: vi.fn(),
    onEvent: () => () => {},
  } as unknown as TeamsPage;
  return { page, calls };
}

const view = (page: TeamsPage) =>
  render(<MentionsInbox strings={strings} lang="en" page={page} myUserId={ME} />);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('where you were named', () => {
  it('lists them newest first, with the team each came from', async () => {
    const { page } = fakePage({
      'mentions.list': { mentions: [entry()], nextBefore: null },
      'members.list': {
        members: [{ userId: SARA, displayName: 'Sara', role: 'member', joinedAt: 1 }],
      },
    });
    view(page);

    expect(await screen.findByText(/what do you think/)).toBeInTheDocument();
    expect(screen.getByText(strings.mentionIn('Alpha'))).toBeInTheDocument();
  });

  it('reads the ids in the text by asking the teams they came from', async () => {
    const { page, calls } = fakePage({
      'mentions.list': {
        mentions: [entry(), entry({ commentId: C2, teamId: BETA, teamName: 'Beta' })],
        nextBefore: null,
      },
      'members.list': {
        members: [{ userId: SARA, displayName: 'Sara', role: 'member', joinedAt: 1 }],
      },
    });
    view(page);

    await screen.findAllByText(/what do you think/);
    await waitFor(() => expect(screen.getAllByText('Sara').length).toBeGreaterThan(0));
    // One member list per distinct team, not one per entry.
    const asked = calls.filter((c) => c.op === 'members.list').map((c) => c.params);
    expect(asked).toEqual([{ teamId: ALPHA }, { teamId: BETA }]);
  });

  it('shows the reader themselves as themselves', async () => {
    const { page } = fakePage({
      'mentions.list': { mentions: [entry()], nextBefore: null },
      'members.list': { members: [] },
    });
    view(page);

    expect(await screen.findByText(strings.youMarker)).toBeInTheDocument();
    // What the body carries is an id; an id is never what is shown.
    expect(screen.queryByText(new RegExp(ME))).not.toBeInTheDocument();
  });

  it('says so, rather than nothing, when nobody has named you', async () => {
    const { page } = fakePage({ 'mentions.list': { mentions: [], nextBefore: null } });
    view(page);
    expect(await screen.findByText(strings.noMentions)).toBeInTheDocument();
  });

  it('pages back through older ones', async () => {
    const { page, calls } = fakePage({
      'mentions.list': { mentions: [entry()], nextBefore: C1 },
      'members.list': { members: [] },
    });
    view(page);

    fireEvent.click(await screen.findByRole('button', { name: strings.moreMentions }));
    await waitFor(() =>
      expect(calls.filter((c) => c.op === 'mentions.list').length).toBeGreaterThan(1),
    );
    expect(
      (calls.filter((c) => c.op === 'mentions.list')[1]!.params as { before: string }).before,
    ).toBe(C1);
  });
});
