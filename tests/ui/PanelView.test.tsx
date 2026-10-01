// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PanelView } from '@/ui/teams/PanelView';
import { getTeamsStrings } from '@/ui/teams/strings';
import { projectPage, type CachedTeamNote } from '@/teams/page-cache';
import type { Note } from '@/domain/note';
import type { TeamsClient } from '@/teams/client';

const pageNotes = vi.hoisted(() => ({ value: [] as Note[] }));
vi.mock('@/teams/page-cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/teams/page-cache')>()),
  readPageNotes: vi.fn(async () => pageNotes.value),
}));

const strings = getTeamsStrings('en');
const TEAM = '01J0000000000000000000000A';
const ME = '01J0000000000000000000000Z';
const SARA = '01J0000000000000000000000S';
const N1 = '01J000000000000000000000N1';
const N2 = '01J000000000000000000000N2';
const PAGE = 'https://blog.example/transformers';
const PHOTO = 'https://lh3.googleusercontent.com/a/sara';

function cached(id: string, content: string, authorId: string): CachedTeamNote {
  return {
    id,
    teamId: TEAM,
    originalUrl: PAGE,
    pageTitle: 'Transformers',
    content,
    anchor: {
      type: 'text',
      version: 1,
      exact: 'Self-attention, at once.',
      context: { prefix: '', suffix: '' },
      textPosition: { start: 0, end: 24 },
    },
    folderId: null,
    authorId,
    version: 1,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  };
}

/** A client whose answers a test steers, recording what was asked. */
function fakeClient(state: 'signed_in' | 'signed_out' = 'signed_in') {
  const calls: { op: string; params: unknown }[] = [];
  const answers: Record<string, unknown> = {
    'team.get': {
      team: { id: TEAM, name: 'Research', role: 'member', state: 'active', readOnlyUntil: null },
      capabilities: ['team.view', 'comments.create'],
      serverTime: 1,
    },
    'members.list': {
      members: [
        { userId: ME, displayName: 'Me', role: 'member', joinedAt: 1 },
        { userId: SARA, displayName: 'Sara', role: 'owner', joinedAt: 1, avatarUrl: PHOTO },
      ],
    },
    'comments.list': { comments: [], nextAfter: null },
  };
  const client = {
    send: vi.fn(async () => ({
      status:
        state === 'signed_in'
          ? { state, me: { user: { id: ME, email: 'me@example.test', displayName: 'Me' } } }
          : { state },
    })),
    request: vi.fn(async (op: string, params: unknown) => {
      calls.push({ op, params });
      return { ok: true as const, data: answers[op] };
    }),
    cache: vi.fn(),
    onEvent: () => () => {},
    requestPermissions: vi.fn(),
    removePermissions: vi.fn(),
  } as unknown as TeamsClient;
  return { client, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
  pageNotes.value = projectPage(
    [cached(N1, 'The heart of the paper.', SARA), cached(N2, 'Positional encoding.', ME)],
    PAGE,
    { teams: [{ id: TEAM, name: 'Research' }], syncedAt: 1 },
  );
});
afterEach(cleanup);

describe('Hamesh in the side panel', () => {
  it('opens on the note it was asked for: who shared it, what it quotes, and its discussion', async () => {
    const { client, calls } = fakeClient();
    const { container } = render(
      <PanelView lang="en" client={client} teamId={TEAM} noteId={N1} pageKey={PAGE} />,
    );

    expect(await screen.findByText('The heart of the paper.')).toBeInTheDocument();
    expect(screen.getByText('«Self-attention, at once.»')).toBeInTheDocument();
    expect(screen.getByText('Sara')).toBeInTheDocument();
    expect(container.querySelector('.hm-panel-note img')).toHaveAttribute('src', PHOTO);
    expect(calls.some((c) => c.op === 'comments.list')).toBe(true);
  });

  it('lists every shared note on the page, and opens the one picked', async () => {
    const { client } = fakeClient();
    render(<PanelView lang="en" client={client} teamId={null} noteId={null} pageKey={PAGE} />);

    expect(await screen.findByRole('radio', { name: strings.panelWholePage(2) })).toBeChecked();
    fireEvent.click(screen.getByText('Positional encoding.'));

    expect(screen.getByRole('radio', { name: strings.panelThisNote })).toBeChecked();
    expect(await screen.findByText('Me')).toBeInTheDocument();
    expect(screen.queryByText('The heart of the paper.')).toBeNull();
  });

  it('says so when the page has no shared notes, or it was opened on no page', async () => {
    pageNotes.value = [];
    const { client } = fakeClient();
    const { unmount } = render(
      <PanelView lang="en" client={client} teamId={null} noteId={null} pageKey={PAGE} />,
    );
    expect(await screen.findByText(strings.panelNoneHere)).toBeInTheDocument();
    unmount();

    render(<PanelView lang="en" client={client} teamId={null} noteId={null} pageKey={null} />);
    expect(await screen.findByText(strings.panelEmptyTitle)).toBeInTheDocument();
  });

  it('asks nothing of a team and shows no discussion while signed out', async () => {
    const { client, calls } = fakeClient('signed_out');
    render(<PanelView lang="en" client={client} teamId={TEAM} noteId={N1} pageKey={PAGE} />);

    expect(await screen.findByText(strings.signedOutTitle)).toBeInTheDocument();
    expect(screen.queryByText('The heart of the paper.')).toBeNull();
    expect(calls).toEqual([]);
  });
});
