// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CommentThread } from '@/ui/teams/CommentThread';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { TeamsPage } from '@/ui/teams/useTeams';
import type { TeamsEvent } from '@/teams/messages';
import type { Comment, TeamAction, TeamResponse } from '@hamesh/teams-contract';

const strings = getTeamsStrings('en');
const TEAM = '01J0000000000000000000000A';
const NOTE = '01J0000000000000000000000N';
const ME = '01J0000000000000000000000Z';
const SARA = '01J0000000000000000000000S';
const C1 = '01J0000000000000000000000B';
const C2 = '01J0000000000000000000000C';

const members = [
  { userId: ME, displayName: 'Me', role: 'owner' as const, joinedAt: 1 },
  { userId: SARA, displayName: 'Sara', role: 'member' as const, joinedAt: 2 },
];

const ALL: TeamAction[] = [
  'team.view',
  'comments.create',
  'comments.edit_own',
  'comments.delete_own',
  'comments.delete_any',
];

function team(capabilities: TeamAction[] = ALL): TeamResponse {
  return {
    team: { id: TEAM, name: 'Alpha', role: 'owner', state: 'active', readOnlyUntil: null },
    capabilities,
    serverTime: 1,
  };
}

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: C1,
    parentId: null,
    authorId: SARA,
    body: 'worth a second look',
    mentions: [],
    createdAt: 1_700_000_000_000,
    editedAt: null,
    deleted: false,
    ...overrides,
  };
}

/** A page whose answers a test steers, recording what was asked of the worker. */
function fakePage(answers: Record<string, unknown> = {}) {
  const calls: { op: string; params: unknown }[] = [];
  let listener: ((event: TeamsEvent) => void) | null = null;
  const run = vi.fn(async (op: string, params: unknown) => {
    calls.push({ op, params });
    return (Object.hasOwnProperty.call(answers, op) ? answers[op] : undefined) as never;
  });
  const page = {
    status: { state: 'signed_in', me: null },
    me: null,
    busy: false,
    failure: null,
    working: () => false,
    failed: () => null,
    clearError: vi.fn(),
    refresh: vi.fn(async () => {}),
    run,
    cache: vi.fn(),
    onEvent: (fn: (event: TeamsEvent) => void) => {
      listener = fn;
      return () => {
        listener = null;
      };
    },
  } as unknown as TeamsPage;
  return { page, calls, run, poke: (event: TeamsEvent) => listener?.(event) };
}

const view = (page: TeamsPage, capabilities?: TeamAction[]) =>
  render(
    <CommentThread
      strings={strings}
      lang="en"
      page={page}
      team={team(capabilities)}
      noteId={NOTE}
      myUserId={ME}
      members={members}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('a note’s discussion', () => {
  it('reads the thread, and names people by looking their ids up in the team', async () => {
    const { page } = fakePage({
      'comments.list': {
        comments: [comment({ body: `good point <@${ME}>`, mentions: [ME] })],
        nextAfter: null,
      },
    });
    view(page);

    expect(await screen.findByText(/good point/)).toBeInTheDocument();
    // The body carries an id; what is drawn is the name, from the member list.
    expect(screen.getByText('Me')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(ME))).not.toBeInTheDocument();
    expect(screen.getByText('Sara')).toBeInTheDocument();
  });

  it('says so, rather than nothing, when nobody has commented', async () => {
    const { page } = fakePage({ 'comments.list': { comments: [], nextAfter: null } });
    view(page);
    expect(await screen.findByText(strings.emptyCommentsTitle)).toBeInTheDocument();
    expect(screen.getByText(strings.emptyCommentsBody)).toBeInTheDocument();
  });

  it('sends a comment with exactly the mentions its text names', async () => {
    const { page, calls } = fakePage({
      'comments.list': { comments: [], nextAfter: null },
      'comments.create': { comment: comment() },
    });
    view(page);
    await screen.findByText(strings.emptyCommentsTitle);

    fireEvent.change(screen.getByLabelText(strings.commentPlaceholder), {
      target: { value: `yes <@${SARA}>` },
    });
    fireEvent.click(screen.getByRole('button', { name: strings.postComment }));

    await waitFor(() => expect(calls.some((c) => c.op === 'comments.create')).toBe(true));
    const sent = calls.find((c) => c.op === 'comments.create')!.params as Record<string, unknown>;
    expect(sent.body).toBe(`yes <@${SARA}>`);
    expect(sent.mentions).toEqual([SARA]);
    expect(sent.teamId).toBe(TEAM);
    expect(sent.noteId).toBe(NOTE);
    expect(sent.parentId, 'a top-level comment replies to nothing').toBeUndefined();
  });

  it('replies to a comment, one level deep and no further', async () => {
    const { page, calls } = fakePage({
      'comments.list': {
        comments: [comment({ replyCount: 1, replies: [comment({ id: C2, parentId: C1 })] })],
        nextAfter: null,
      },
      'comments.create': { comment: comment() },
    });
    view(page);
    await screen.findAllByText('worth a second look');

    // One Reply control: the top-level comment's. Its reply has none.
    const reply = screen.getByRole('button', { name: strings.replyTo });
    fireEvent.click(reply);
    fireEvent.change(screen.getByLabelText(strings.replyPlaceholder), {
      target: { value: 'agreed' },
    });
    fireEvent.click(screen.getByRole('button', { name: strings.postReply }));

    await waitFor(() => expect(calls.some((c) => c.op === 'comments.create')).toBe(true));
    expect(
      (calls.find((c) => c.op === 'comments.create')!.params as { parentId: string }).parentId,
    ).toBe(C1);
  });

  it('fetches the rest of a long thread’s replies only when asked', async () => {
    const { page, calls } = fakePage({
      'comments.list': {
        comments: [comment({ replyCount: 5, replies: [comment({ id: C2, parentId: C1 })] })],
        nextAfter: null,
      },
      'comments.replies': { replies: [comment({ id: C2, parentId: C1 })], nextAfter: null },
    });
    view(page);

    const more = await screen.findByRole('button', { name: strings.showReplies(5) });
    expect(calls.some((c) => c.op === 'comments.replies')).toBe(false);
    fireEvent.click(more);
    await waitFor(() => expect(calls.some((c) => c.op === 'comments.replies')).toBe(true));
  });

  it('offers editing only on your own, and deleting as the server allowed', async () => {
    const { page } = fakePage({
      'comments.list': { comments: [comment({ authorId: SARA })], nextAfter: null },
    });
    // Own-only capabilities: someone else's comment is not this reader's to touch.
    view(page, ['team.view', 'comments.create', 'comments.edit_own', 'comments.delete_own']);
    await screen.findByText('worth a second look');

    expect(screen.queryByRole('button', { name: strings.edit })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.delete })).not.toBeInTheDocument();
  });

  it('lets an admin delete someone else’s, once they have said yes', async () => {
    const { page, calls } = fakePage({
      'comments.list': { comments: [comment({ authorId: SARA })], nextAfter: null },
    });
    view(page);
    await screen.findByText('worth a second look');

    fireEvent.click(screen.getByRole('button', { name: strings.delete }));
    // Asked on the comment itself, not in a browser dialog.
    expect(screen.getByText(strings.deleteCommentConfirm)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: strings.delete })[0]!);
    await waitFor(() => expect(calls.some((c) => c.op === 'comments.delete')).toBe(true));
  });

  it('keeps a deleted comment’s place when replies hang off it, and says what it is', async () => {
    const { page } = fakePage({
      'comments.list': {
        comments: [
          comment({ deleted: true, body: '', replyCount: 1, replies: [comment({ id: C2 })] }),
        ],
        nextAfter: null,
      },
    });
    view(page);

    expect(await screen.findByText(strings.commentDeleted)).toBeInTheDocument();
    // Nothing can be done to a comment that is already gone.
    expect(screen.queryByRole('button', { name: strings.edit })).not.toBeInTheDocument();
  });

  it('reads the thread again when the socket says it moved on, and trusts nothing it was told', async () => {
    const { page, calls, poke } = fakePage({
      'comments.list': { comments: [comment()], nextAfter: null },
    });
    view(page);
    await screen.findByText('worth a second look');
    const before = calls.filter((c) => c.op === 'comments.list').length;

    poke({ type: 'TEAMS_EVENT', event: 'comments', teamId: TEAM, noteId: NOTE });
    await waitFor(() =>
      expect(calls.filter((c) => c.op === 'comments.list').length).toBe(before + 1),
    );

    // A notice about some other note is not this thread's business.
    poke({ type: 'TEAMS_EVENT', event: 'comments', teamId: TEAM, noteId: C2 });
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.filter((c) => c.op === 'comments.list').length).toBe(before + 1);
  });

  it('offers no way to comment to someone the server did not let', async () => {
    const { page } = fakePage({ 'comments.list': { comments: [comment()], nextAfter: null } });
    view(page, ['team.view']);
    await screen.findByText('worth a second look');

    expect(screen.queryByLabelText(strings.commentPlaceholder)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.replyTo })).not.toBeInTheDocument();
  });

  it('pages through a thread longer than one answer', async () => {
    const { page, calls } = fakePage({
      'comments.list': { comments: [comment()], nextAfter: C1 },
    });
    view(page);
    fireEvent.click(await screen.findByRole('button', { name: strings.showMore }));
    await waitFor(() =>
      expect(calls.filter((c) => c.op === 'comments.list').length).toBeGreaterThan(1),
    );
    expect(
      (calls.filter((c) => c.op === 'comments.list')[1]!.params as { after: string }).after,
    ).toBe(C1);
  });

  it('draws a reply under the comment it answers', async () => {
    const { page } = fakePage({
      'comments.list': {
        comments: [
          comment({
            body: 'the question',
            replyCount: 1,
            replies: [comment({ id: C2, body: 'the answer' })],
          }),
        ],
        nextAfter: null,
      },
    });
    view(page);

    await screen.findByText('the question');
    const replies = screen.getAllByRole('listitem').filter((li) => li.dataset.reply === 'true');
    expect(within(replies[0]!).getByText('the answer')).toBeInTheDocument();
  });
});
