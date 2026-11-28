// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { installFakeStorage } from '../storage/fake-local-storage';
import { createAnchorHealthRepository } from '@/storage/anchor-health-repository';
import { HameshApp } from '@/content/HameshApp';
import type { Note } from '@/domain/note';
import type { TeamNotesSource } from '@/teams/page-notes';
import {
  PAGE,
  elementAt,
  foldersRepo,
  memoryRepo,
  prefsRepo,
  stubBrowserBits,
} from './lost-support';

const TEAM = '01J0000000000000000000000A';
const NOTE = '01J000000000000000000000N1';
const SARA = '01J0000000000000000000000S';
const HIBA = '01J0000000000000000000000H';

const teamNote: Note = {
  id: NOTE,
  schemaVersion: 1,
  pageKey: PAGE,
  originalUrl: PAGE,
  content: 'the equation, as Bennabi set it out',
  anchor: elementAt('#renaissance'),
  workspaceId: 'default',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  team: { id: TEAM, name: 'Readers', version: 3, authorId: SARA, folderId: null },
};

function source(me: string): TeamNotesSource {
  return {
    read: vi.fn(async () => [teamNote]),
    watch: () => () => {},
    people: vi.fn(async () => ({
      people: { [SARA]: { name: 'Sara', teams: [], photo: null, source: null } },
      me,
      teamIds: [TEAM],
      syncedAt: 1,
    })),
    watchPeople: () => () => {},
    label: () => 'Shared with Readers',
    thread: vi.fn(async () => ({ ok: true as const, data: { total: 0, latest: [] } })),
    reply: vi.fn(),
    openDiscussion: vi.fn(),
    openInHamesh: vi.fn(),
    remove: vi.fn(),
    reanchor: vi.fn(async () => ({ ok: true as const, data: null })),
    destinations: vi.fn(async () => ({ ok: true as const, data: [] })),
    share: vi.fn(),
  };
}

function renderPage(teamNotes: TeamNotesSource, count = vi.fn()) {
  const healthRepo = createAnchorHealthRepository();
  const view = render(
    <HameshApp
      repo={memoryRepo([])}
      prefsRepo={prefsRepo()}
      foldersRepo={foldersRepo()}
      healthRepo={healthRepo}
      count={count}
      initialLang="en"
      registerActivate={() => {}}
      registerActivateVideo={() => {}}
      registerActivateText={() => {}}
      registerRestoreNote={() => {}}
      teamNotes={teamNotes}
    />,
  );
  return { ...view, healthRepo };
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
}

describe('HameshApp — a team’s note that lost its place', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.stubEnv('WXT_TEAMS_API_ORIGIN', 'https://api.example.test');
    const fake = installFakeStorage();
    fake.store.set('local:hamesh:anchor-health', {
      [NOTE]: { status: 'lost', misses: 2, lastCheckedAt: '2026-11-01T00:00:00Z', pageKey: PAGE },
    });
    document.body.innerHTML = '<section id="other"><p>Man, soil and time.</p></section>';
    stubBrowserBits(document.querySelector('#other p'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('is shown to every member, and only its author may put it back', async () => {
    renderPage(source(HIBA));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: "1 note couldn't find its place" }));
    const list = screen.getByRole('dialog', { name: 'Notes that lost their place' });
    expect(within(list).getByText('the equation, as Bennabi set it out')).toBeInTheDocument();
    expect(within(list).getByText('Only Sara can put it back')).toBeInTheDocument();
    expect(within(list).queryByRole('button', { name: 'Put it back' })).not.toBeInTheDocument();
    expect(
      within(list).queryByRole('button', { name: 'Keep without a place' }),
    ).not.toBeInTheDocument();
  });

  it('lets its author put it back, through the worker, and counts it', async () => {
    const teamNotes = source(SARA);
    const count = vi.fn();
    const { container, healthRepo } = renderPage(teamNotes, count);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: "1 note couldn't find its place" }));
    fireEvent.click(screen.getByRole('button', { name: 'Put it back' }));
    fireEvent.click(container.querySelector('.hm-capture')!, { clientX: 20, clientY: 20 });
    await settle();

    expect(teamNotes.reanchor).toHaveBeenCalledWith(
      TEAM,
      NOTE,
      expect.objectContaining({ signals: expect.objectContaining({ tagName: 'p' }) }),
    );
    expect(count).toHaveBeenCalledWith('lost.reattached.element');
    expect(await healthRepo.read()).toEqual({});
  });

  it('says so when the server refuses, and counts nothing', async () => {
    const teamNotes = source(SARA);
    vi.mocked(teamNotes.reanchor).mockResolvedValue({ ok: false, error: 'forbidden' });
    const count = vi.fn();
    const { container } = renderPage(teamNotes, count);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: "1 note couldn't find its place" }));
    fireEvent.click(screen.getByRole('button', { name: 'Put it back' }));
    fireEvent.click(container.querySelector('.hm-capture')!, { clientX: 20, clientY: 20 });
    await settle();

    expect(screen.getByText("Couldn't save. Try again.")).toBeInTheDocument();
    expect(count).not.toHaveBeenCalled();
  });
});
