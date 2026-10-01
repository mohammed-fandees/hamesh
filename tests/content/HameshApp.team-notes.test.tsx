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
import type { PeopleDirectory } from '@/teams/people-cache';

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

/** A personal note's mark, or a shared note's pin — whichever a note has. */
const MARK = /view note|shared note/i;

const AUTHOR = '01J0000000000000000000000U';
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';

/** A team-note source a test drives: what is cached, and one change to it. */
function source(notes: Note[], people: PeopleDirectory['people'] = {}) {
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
    people: vi.fn(async () => ({ people, me: null, teamIds: [], syncedAt: 1 })),
    watchPeople: () => () => {},
    label: (n, lang) => (n.team ? sharedWithTeam(n.team.name, lang) : undefined),
    thread: vi.fn(async () => ({ ok: true as const, data: { total: 0, latest: [] } })),
    reply: vi.fn(async () => ({ ok: true as const, data: null })),
    openDiscussion: vi.fn(async () => {}),
    openInHamesh: vi.fn(async () => {}),
    remove: vi.fn(async () => ({ ok: true as const, data: null })),
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
  const markers = await screen.findAllByRole('button', { name: MARK });
  fireEvent.click(markers[0]);
}

describe('a team’s notes on the page they belong to', () => {
  it('draws them beside personal ones, from the cache and nothing else', async () => {
    const repo = repoWith([note()]);
    const cached = source([teamNote()]);
    renderApp(repo, cached.teamNotes);

    // Asked for this page by its page key, which is all the source is ever given.
    await waitFor(() => expect(cached.read).toHaveBeenCalledWith(generatePageKey(location.href)));
    await waitFor(() => expect(screen.getAllByRole('button', { name: MARK })).toHaveLength(2));
  });

  it('says which team a shared note came from, and offers nothing that would change it', async () => {
    const repo = repoWith([]);
    renderApp(repo, source([teamNote()]).teamNotes);
    await openTheMarker();

    expect(await screen.findByText('what the team said')).toBeInTheDocument();
    // Its popup names the team in its header.
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pin/i })).not.toBeInTheDocument();
  });

  it('still offers all of that on a note of this device’s own', async () => {
    renderApp(repoWith([note()]), source([]).teamNotes);
    await openTheMarker();

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    // Delete is in the note's menu, beside opening it in Hamesh and copying it.
    fireEvent.click(screen.getByRole('button', { name: 'Note actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open in Hamesh' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy the note' })).toBeInTheDocument();
    expect(screen.queryByText(/Shared with/)).not.toBeInTheDocument();
  });

  it('redraws when the worker writes a change to this page’s shelf', async () => {
    const cached = source([]);
    renderApp(repoWith([]), cached.teamNotes);
    await waitFor(() => expect(cached.read).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: MARK })).not.toBeInTheDocument();

    cached.set([teamNote()]);
    await waitFor(() => expect(screen.getAllByRole('button', { name: MARK })).toHaveLength(1));
  });

  it('draws a note that moved to a team once — as the team’s, never also as this device’s', async () => {
    const repo = repoWith([note()]);
    const cached = source([]);
    renderApp(repo, cached.teamNotes);
    expect(await screen.findByRole('button', { name: /view note/i })).toBeInTheDocument();

    // Shared from the Library: the local copy is gone, and the team's arrives.
    vi.mocked(repo.getForPage).mockResolvedValue([]);
    cached.set([teamNote()]);

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /view note/i })).not.toBeInTheDocument(),
    );
    expect(screen.getAllByRole('button', { name: MARK })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'A shared note' })).toBeInTheDocument();
  });

  it('gathers several shared notes on one element into one pin, and lists them', async () => {
    const SARA = '01J0000000000000000000000S';
    const second = teamNote({
      id: '01J0000000000000000000000O',
      content: 'a second thought',
      team: {
        id: '01J0000000000000000000000A',
        name: 'Alpha',
        version: 1,
        authorId: SARA,
        folderId: null,
      },
    });
    renderApp(
      repoWith([]),
      source([teamNote(), second], { [SARA]: { name: 'Sara', photo: PHOTO, source: null } })
        .teamNotes,
    );

    const cluster = await screen.findByRole('button', { name: '2 shared notes' });
    expect(cluster.querySelectorAll('.hm-avatar')).toHaveLength(2);
    fireEvent.click(cluster);
    fireEvent.click(await screen.findByRole('button', { name: /a second thought/ }));

    expect(await screen.findByRole('dialog', { name: 'Sara’s shared note' })).toBeInTheDocument();
  });

  it('marks a shared note with its author’s face, and one of this device’s own with the margin mark', async () => {
    const repo = repoWith([note()]);
    renderApp(
      repo,
      source([teamNote()], { [AUTHOR]: { name: 'Sara', photo: PHOTO, source: null } }).teamNotes,
    );

    const pin = await screen.findByRole('button', { name: 'Sara’s shared note' });
    expect(pin.querySelector('img')).toHaveAttribute('src', PHOTO);
    expect(screen.getByRole('button', { name: /view note/i })).not.toHaveClass('hm-pin');
  });

  it('pins a note by someone this device does not know with a quiet dot', async () => {
    renderApp(repoWith([]), source([teamNote()]).teamNotes);

    const pin = await screen.findByRole('button', { name: 'A shared note' });
    expect(pin.querySelector('img')).toBeNull();
    expect(pin.querySelector('.hm-avatar')).toHaveAttribute('data-unknown', 'true');
  });

  it('shows only personal notes in a build with no Teams at all', async () => {
    vi.unstubAllEnvs();
    renderApp(repoWith([note()]));
    await waitFor(() => expect(screen.getAllByRole('button', { name: MARK })).toHaveLength(1));
    expect(screen.queryByText(/Shared with/)).not.toBeInTheDocument();
  });
});
