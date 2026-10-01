// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HameshApp } from '@/content/HameshApp';
import type { NotesRepository } from '@/storage/notes-repository';
import type { PreferencesRepository } from '@/storage/preferences-repository';
import type { FoldersRepository } from '@/storage/folders-repository';
import type { Note } from '@/domain/note';
import { DEFAULT_PREFERENCES } from '@/domain/preferences';
import { generatePageKey } from '@/domain/page-key';
import { sharedWithTeam, type TeamNotesSource } from '@/teams/page-notes';

const PAGE = 'https://example.com/page';

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    schemaVersion: 1,
    pageKey: PAGE,
    originalUrl: PAGE,
    content: 'a personal thought',
    anchor: {
      primarySelector: '#target',
      signals: { tagName: 'div' },
      fallbackDocumentPosition: { x: 0, y: 0 },
    },
    workspaceId: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const teamNote = (overrides: Partial<Note> = {}) =>
  note({
    id: '01J0000000000000000000000N',
    content: 'what the team said',
    team: {
      id: '01J0000000000000000000000A',
      name: 'Alpha',
      version: 4,
      authorId: '01J0000000000000000000000U',
      folderId: null,
    },
    ...overrides,
  });

function repoWith(notes: Note[]): NotesRepository {
  return {
    getForPage: vi.fn().mockResolvedValue(notes),
    getAll: vi.fn().mockResolvedValue(notes),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setPinned: vi.fn(),
    setFolder: vi.fn(),
    saveAll: vi.fn(),
  };
}

const prefsRepo = (): PreferencesRepository => ({
  get: vi.fn().mockResolvedValue(DEFAULT_PREFERENCES),
  watch: vi.fn().mockReturnValue(() => {}),
  setLanguage: vi.fn(),
  setAppearance: vi.fn(),
  setTextNotes: vi.fn(),
  setLastSeenReleaseVersion: vi.fn(),
  setLastSeenMention: vi.fn(),
  setSkipShareConsent: vi.fn(),
  setPageDefaultFolder: vi.fn(),
  setGlobalDefaultFolder: vi.fn(),
});

const foldersRepo = (): FoldersRepository => ({
  getAll: vi.fn().mockResolvedValue([]),
  create: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  saveAll: vi.fn(),
  watch: vi.fn().mockReturnValue(() => {}),
});

/** A team-note source a test drives: what is cached, and one change to it. */
function source(notes: Note[]) {
  let current = notes;
  let announce: (() => void) | null = null;
  const read = vi.fn(async () => current);
  const teamNotes: TeamNotesSource = {
    read,
    watch: (_pageKey, onChange) => {
      announce = onChange;
      return () => {
        announce = null;
      };
    },
    label: (n, lang) => (n.team ? sharedWithTeam(n.team.name, lang) : undefined),
    thread: vi.fn(async () => ({ ok: true as const, data: { total: 0, latest: [] } })),
    reply: vi.fn(async () => ({ ok: true as const, data: null })),
    openDiscussion: vi.fn(async () => {}),
    destinations: vi.fn(async () => ({ ok: true as const, data: [] })),
    share: vi.fn(async () => ({ ok: true as const, data: null })),
  };
  return {
    teamNotes,
    read,
    set(next: Note[]) {
      current = next;
      announce?.();
    },
  };
}

function renderApp(repo: NotesRepository, teamNotes?: TeamNotesSource) {
  return render(
    <HameshApp
      repo={repo}
      prefsRepo={prefsRepo()}
      foldersRepo={foldersRepo()}
      initialLang="en"
      registerActivate={() => {}}
      registerActivateVideo={() => {}}
      registerActivateText={() => {}}
      registerRestoreNote={() => {}}
      teamNotes={teamNotes}
    />,
  );
}

beforeEach(() => {
  cleanup();
  // The in-page card names the team only in a build that has Teams: the gate is
  // a build-time constant, so a test that wants the label has to be such a build.
  vi.stubEnv('WXT_TEAMS_API_ORIGIN', 'https://api.example.com');
  document.body.innerHTML = '<div id="target">Target element</div>';
  Element.prototype.scrollIntoView = vi.fn() as unknown as Element['scrollIntoView'];
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
  document.elementFromPoint = vi.fn().mockReturnValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Opens the note behind the only marker on the page. */
async function openTheMarker() {
  const markers = await screen.findAllByRole('button', { name: /view note/i });
  fireEvent.click(markers[0]);
}

describe('a team’s notes on the page they belong to', () => {
  it('draws them beside personal ones, from the cache and nothing else', async () => {
    const repo = repoWith([note()]);
    const cached = source([teamNote()]);
    renderApp(repo, cached.teamNotes);

    // Asked for this page by its page key, which is all the source is ever given.
    await waitFor(() => expect(cached.read).toHaveBeenCalledWith(generatePageKey(location.href)));
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /view note/i })).toHaveLength(2),
    );
  });

  it('says which team a shared note came from, and offers nothing that would change it', async () => {
    const repo = repoWith([]);
    renderApp(repo, source([teamNote()]).teamNotes);
    await openTheMarker();

    expect(await screen.findByText('what the team said')).toBeInTheDocument();
    expect(screen.getByText('Shared with Alpha')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pin/i })).not.toBeInTheDocument();
  });

  it('still offers all of that on a note of this device’s own', async () => {
    renderApp(repoWith([note()]), source([]).teamNotes);
    await openTheMarker();

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByText(/Shared with/)).not.toBeInTheDocument();
  });

  it('redraws when the worker writes a change to this page’s shelf', async () => {
    const cached = source([]);
    renderApp(repoWith([]), cached.teamNotes);
    await waitFor(() => expect(cached.read).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /view note/i })).not.toBeInTheDocument();

    cached.set([teamNote()]);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /view note/i })).toHaveLength(1),
    );
  });

  it('shows only personal notes in a build with no Teams at all', async () => {
    vi.unstubAllEnvs();
    renderApp(repoWith([note()]));
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /view note/i })).toHaveLength(1),
    );
    expect(screen.queryByText(/Shared with/)).not.toBeInTheDocument();
  });
});
