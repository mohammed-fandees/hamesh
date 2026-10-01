// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HameshApp } from '@/content/HameshApp';
import type { NotesRepository } from '@/storage/notes-repository';
import type { PreferencesRepository } from '@/storage/preferences-repository';
import type { FoldersRepository } from '@/storage/folders-repository';
import type { Note } from '@/domain/note';
import { DEFAULT_PREFERENCES, type Preferences } from '@/domain/preferences';
import type { TeamNotesSource } from '@/teams/page-notes';
import { getTeamsStrings } from '@/ui/teams/strings';

/**
 * The composer on the page, in a build with Teams, for a reader in a team:
 * where a note goes, the consent asked before it goes to a team, and what
 * happens when the team refuses it.
 */

const teamStrings = getTeamsStrings('en');
const TEAM = '01J0000000000000000000000A';
const FOLDER = '01J000000000000000000000F1';
const PAGE_HTML =
  '<article id="post"><p id="intro">Performance is extremely important in large applications.</p></article>';

function makeRepo(): NotesRepository {
  return {
    getForPage: vi.fn().mockResolvedValue([]),
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(async (input) => ({
      id: 'created-note',
      schemaVersion: 1 as const,
      workspaceId: 'default',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...input,
    })),
    update: vi.fn(),
    delete: vi.fn(),
    setPinned: vi.fn(),
    setFolder: vi.fn(),
    saveAll: vi.fn(),
  };
}

function makePrefsRepo(prefs: Preferences): PreferencesRepository {
  return {
    get: vi.fn().mockResolvedValue(prefs),
    watch: vi.fn().mockReturnValue(() => {}),
    setLanguage: vi.fn(),
    setAppearance: vi.fn(),
    setTextNotes: vi.fn(),
    setLastSeenReleaseVersion: vi.fn(),
    setLastSeenMention: vi.fn(),
    setSkipShareConsent: vi.fn(),
    setPageDefaultFolder: vi.fn(),
    setGlobalDefaultFolder: vi.fn(),
  };
}

const foldersRepo: FoldersRepository = {
  getAll: vi.fn().mockResolvedValue([]),
  create: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  saveAll: vi.fn(),
  watch: vi.fn().mockReturnValue(() => {}),
};

function teamSource(share: TeamNotesSource['share']): TeamNotesSource {
  return {
    read: vi.fn(async (): Promise<Note[]> => []),
    watch: () => () => {},
    people: vi.fn(async () => ({ people: {}, teamIds: [], syncedAt: 0 })),
    watchPeople: () => () => {},
    label: () => undefined,
    thread: vi.fn(),
    reply: vi.fn(),
    openDiscussion: vi.fn(),
    destinations: vi.fn(async () => ({
      ok: true as const,
      data: [
        { id: TEAM, name: 'Research', folders: [{ id: FOLDER, name: 'Papers', parentId: null }] },
      ],
    })),
    share,
  };
}

function renderApp(teamNotes: TeamNotesSource, prefs: Preferences = DEFAULT_PREFERENCES) {
  const repo = makeRepo();
  const prefsRepo = makePrefsRepo(prefs);
  let activateText: (() => void) | null = null;
  render(
    <HameshApp
      repo={repo}
      prefsRepo={prefsRepo}
      foldersRepo={foldersRepo}
      initialLang="en"
      registerActivate={() => {}}
      registerActivateVideo={() => {}}
      registerActivateText={(fn) => {
        activateText = fn;
      }}
      registerRestoreNote={() => {}}
      teamNotes={teamNotes}
    />,
  );
  return { repo, prefsRepo, activateText: () => activateText?.() };
}

async function openComposer(activateText: () => void): Promise<HTMLElement> {
  const text = document.getElementById('intro')!.firstChild as Text;
  const range = document.createRange();
  range.setStart(text, 15);
  range.setEnd(text, 34);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  await waitFor(() => {
    activateText();
    expect(screen.getByPlaceholderText('Write a note…')).toBeInTheDocument();
  });
  return screen.getByPlaceholderText('Write a note…');
}

/** Writes a note and sends it to the team's Papers folder. */
async function writeToTeam(activateText: () => void) {
  const textarea = await openComposer(activateText);
  fireEvent.change(textarea, { target: { value: 'For the team' } });
  fireEvent.click(await screen.findByRole('radio', { name: new RegExp(teamStrings.destTeam) }));
  fireEvent.change(screen.getByRole('combobox', { name: teamStrings.moveToFolder }), {
    target: { value: FOLDER },
  });
  fireEvent.click(screen.getByRole('button', { name: teamStrings.saveAndShare }));
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
});

describe('HameshApp — a note written on the page, for a team', () => {
  beforeEach(() => {
    cleanup();
    vi.stubEnv('WXT_TEAMS_API_ORIGIN', 'https://api.example.test');
    document.body.innerHTML = PAGE_HTML;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    document.elementFromPoint = vi.fn().mockReturnValue(null);
    const lineBox = {
      left: 40,
      top: 100,
      right: 240,
      bottom: 120,
      width: 200,
      height: 20,
      x: 40,
      y: 100,
    } as DOMRect;
    Range.prototype.getClientRects = vi.fn(
      () => [lineBox] as unknown as DOMRectList,
    ) as unknown as Range['getClientRects'];
    Range.prototype.getBoundingClientRect = vi.fn(() => lineBox);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('starts on this device, with the device’s folders', async () => {
    const { activateText } = renderApp(teamSource(vi.fn()));
    await openComposer(activateText);
    expect(
      await screen.findByRole('radio', { name: new RegExp(teamStrings.destDevice) }),
    ).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('asks before sharing, then saves here and hands the note to the team', async () => {
    const share = vi.fn(async () => ({ ok: true as const, data: null }));
    const { activateText, repo } = renderApp(teamSource(share));
    await writeToTeam(activateText);

    // Nothing is saved or sent before the reader agrees.
    expect(
      await screen.findByRole('dialog', { name: teamStrings.consentTitle('Research') }),
    ).toBeInTheDocument();
    expect(repo.create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: teamStrings.consentShare }));
    await waitFor(() => expect(share).toHaveBeenCalledWith('created-note', TEAM, FOLDER));
    // Saved unfiled here: the folder is the team's, not this device's.
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ folderId: undefined }));
  });

  it('saves and shares nothing when the reader declines', async () => {
    const share = vi.fn();
    const { activateText, repo } = renderApp(teamSource(share));
    await writeToTeam(activateText);
    const dialog = await screen.findByRole('dialog', {
      name: teamStrings.consentTitle('Research'),
    });
    fireEvent.click(within(dialog).getByRole('button', { name: teamStrings.cancel }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: teamStrings.consentTitle('Research') }),
      ).not.toBeInTheDocument(),
    );
    expect(repo.create).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Write a note…')).toHaveValue('For the team');
  });

  it('does not ask again once the reader said so', async () => {
    const share = vi.fn(async () => ({ ok: true as const, data: null }));
    const prefs = {
      ...DEFAULT_PREFERENCES,
      teams: { ...DEFAULT_PREFERENCES.teams, skipShareConsent: true },
    };
    const { activateText } = renderApp(teamSource(share), prefs);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await writeToTeam(activateText);
    await waitFor(() => expect(share).toHaveBeenCalled());
  });

  it('keeps the note here and says why when the team refuses it', async () => {
    const share = vi.fn(async () => ({ ok: false as const, error: 'limit_reached' as const }));
    const { activateText } = renderApp(teamSource(share));
    await writeToTeam(activateText);
    fireEvent.click(await screen.findByRole('button', { name: teamStrings.consentShare }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      teamStrings.shareFailedKept(teamStrings.error('limit_reached')),
    );
  });
});
