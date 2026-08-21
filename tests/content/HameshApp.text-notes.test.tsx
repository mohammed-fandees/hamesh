// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HameshApp } from '@/content/HameshApp';
import type { NotesRepository } from '@/storage/notes-repository';
import type { PreferencesRepository } from '@/storage/preferences-repository';
import type { Note, TextAnchor } from '@/domain/note';
import { DEFAULT_PREFERENCES, type Preferences } from '@/domain/preferences';
import { buildTextAnchor } from '@/domain/text-anchor';

const PAGE_HTML =
  '<article id="post"><p id="intro">Performance is extremely important in large applications.</p></article>';

function makeRepo(notes: Note[] = []): NotesRepository {
  return {
    getForPage: vi.fn().mockResolvedValue(notes),
    getAll: vi.fn().mockResolvedValue(notes),
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
  };
}

function makePrefsRepo(prefs: Preferences = DEFAULT_PREFERENCES): PreferencesRepository {
  return {
    get: vi.fn().mockResolvedValue(prefs),
    watch: vi.fn().mockReturnValue(() => {}),
    setLanguage: vi.fn(),
    setAppearance: vi.fn(),
    setTextNotes: vi.fn(),
    setLastSeenReleaseVersion: vi.fn(),
  };
}

function withTextNotes(patch: Partial<Preferences['textNotes']>): Preferences {
  return { ...DEFAULT_PREFERENCES, textNotes: { ...DEFAULT_PREFERENCES.textNotes, ...patch } };
}

/** Selects `needle` inside #intro, exactly as dragging over it would, and
 *  fires the mouseup that ends the drag. */
function selectText(needle: string): void {
  const text = document.getElementById('intro')!.firstChild as Text;
  const at = text.data.indexOf(needle);
  if (at === -1) throw new Error(`"${needle}" not in the fixture`);
  const range = document.createRange();
  range.setStart(text, at);
  range.setEnd(text, at + needle.length);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  fireEvent.mouseUp(document.body);
}

function renderApp(
  repo: NotesRepository,
  prefsRepo: PreferencesRepository,
  hooks: { onActivateText?: (fn: () => void) => void } = {},
) {
  return render(
    <HameshApp
      repo={repo}
      prefsRepo={prefsRepo}
      initialLang="en"
      registerActivate={() => {}}
      registerActivateVideo={() => {}}
      registerActivateText={(fn) => hooks.onActivateText?.(fn)}
      registerRestoreNote={() => {}}
    />,
  );
}

const findAction = () => screen.findByRole('button', { name: 'Add a note to the selected text' });
const queryAction = () => screen.queryByRole('button', { name: 'Add a note to the selected text' });

describe('HameshApp — contextual text notes', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = PAGE_HTML;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    document.elementFromPoint = vi.fn().mockReturnValue(null);
    // jsdom has no layout, so a range reports no rects — and the action chip
    // is positioned from them. One shared stand-in line box is enough for
    // every range in these tests.
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
    // requestAnimationFrame is what defers reading the finished selection.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('offers the action chip once a valid selection is finished', async () => {
    renderApp(makeRepo(), makePrefsRepo());
    await waitFor(() => expect(queryAction()).toBeNull());

    selectText('extremely important');
    expect(await findAction()).toBeInTheDocument();
  });

  it('does not open the composer from the selection alone', async () => {
    renderApp(makeRepo(), makePrefsRepo());
    selectText('extremely important');
    await findAction();

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByPlaceholderText('Write a note…')).toBeNull();
  });

  it('opens the composer with the selected text attached only once the chip is clicked', async () => {
    renderApp(makeRepo(), makePrefsRepo());
    selectText('extremely important');
    fireEvent.click(await findAction());

    expect(await screen.findByPlaceholderText('Write a note…')).toBeInTheDocument();
    expect(screen.getByText('Attached text')).toBeInTheDocument();
    expect(screen.getByText('extremely important')).toBeInTheDocument();
  });

  it('attaches the preserved selection even after the live selection is lost', async () => {
    const repo = makeRepo();
    renderApp(repo, makePrefsRepo());
    selectText('extremely important');
    const action = await findAction();

    // Clicking external UI can collapse the page selection — the note must
    // still be about the text that was selected, not about nothing.
    window.getSelection()!.removeAllRanges();
    fireEvent.click(action);

    fireEvent.change(await screen.findByPlaceholderText('Write a note…'), {
      target: { value: 'Review this later' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(repo.create).toHaveBeenCalled());
    const anchor = vi.mocked(repo.create).mock.calls[0][0].anchor as TextAnchor;
    expect(anchor.exact).toBe('extremely important');
  });

  it('creates an ordinary note carrying contextual metadata when saved', async () => {
    const repo = makeRepo();
    renderApp(repo, makePrefsRepo());
    selectText('extremely important');
    fireEvent.click(await findAction());
    fireEvent.change(await screen.findByPlaceholderText('Write a note…'), {
      target: { value: 'Review this section later' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(repo.create).toHaveBeenCalledTimes(1));
    const input = vi.mocked(repo.create).mock.calls[0][0];
    expect(input.content).toBe('Review this section later');
    expect(input.pageKey).toBeTruthy();
    expect(input.originalUrl).toBe(location.href);
    const anchor = input.anchor as TextAnchor;
    expect(anchor.type).toBe('text');
    expect(anchor.version).toBe(1);
    expect(anchor.exact).toBe('extremely important');
    expect(anchor.context.prefix).toContain('Performance is');
  });

  it('creates nothing and leaves no highlight when the composer is cancelled', async () => {
    const repo = makeRepo();
    renderApp(repo, makePrefsRepo());
    selectText('extremely important');
    fireEvent.click(await findAction());
    await screen.findByPlaceholderText('Write a note…');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByPlaceholderText('Write a note…')).toBeNull());
    expect(repo.create).not.toHaveBeenCalled();
    expect(queryAction()).toBeNull();
  });

  it('takes the chip away when the selection is cleared', async () => {
    renderApp(makeRepo(), makePrefsRepo());
    selectText('extremely important');
    await findAction();

    window.getSelection()!.removeAllRanges();
    fireEvent(document, new Event('selectionchange'));

    await waitFor(() => expect(queryAction()).toBeNull());
  });

  it('takes the chip away on Escape', async () => {
    renderApp(makeRepo(), makePrefsRepo());
    selectText('extremely important');
    await findAction();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(queryAction()).toBeNull());
  });

  it('takes the chip away when a new selection starts', async () => {
    renderApp(makeRepo(), makePrefsRepo());
    selectText('extremely important');
    await findAction();

    fireEvent.mouseDown(document.getElementById('intro')!);
    await waitFor(() => expect(queryAction()).toBeNull());
  });
});

describe('HameshApp — contextual text note settings', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = PAGE_HTML;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    document.elementFromPoint = vi.fn().mockReturnValue(null);
    Range.prototype.getClientRects = vi.fn(
      () => [] as unknown as DOMRectList,
    ) as unknown as Range['getClientRects'];
    Range.prototype.getBoundingClientRect = vi.fn(() => ({}) as DOMRect);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('never shows the chip when the automatic selection action is disabled', async () => {
    const prefsRepo = makePrefsRepo(withTextNotes({ selectionAction: false }));
    renderApp(makeRepo(), prefsRepo);
    await waitFor(() => expect(prefsRepo.get).toHaveBeenCalled());

    selectText('extremely important');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queryAction()).toBeNull();
  });

  it('still creates a contextual note from the shortcut with the chip disabled', async () => {
    const repo = makeRepo();
    const prefsRepo = makePrefsRepo(withTextNotes({ selectionAction: false }));
    let activateText: (() => void) | null = null;
    renderApp(repo, prefsRepo, {
      onActivateText: (fn) => {
        activateText = fn;
      },
    });
    await waitFor(() => expect(prefsRepo.get).toHaveBeenCalled());
    await waitFor(() => expect(activateText).not.toBeNull());

    selectText('extremely important');
    expect(queryAction()).toBeNull();

    activateText!();
    fireEvent.change(await screen.findByPlaceholderText('Write a note…'), {
      target: { value: 'From the keyboard' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(repo.create).toHaveBeenCalledTimes(1));
    expect((vi.mocked(repo.create).mock.calls[0][0].anchor as TextAnchor).exact).toBe(
      'extremely important',
    );
  });

  it('does nothing on the shortcut when there is no valid selection', async () => {
    const repo = makeRepo();
    let activateText: (() => void) | null = null;
    renderApp(repo, makePrefsRepo(), {
      onActivateText: (fn) => {
        activateText = fn;
      },
    });
    await waitFor(() => expect(activateText).not.toBeNull());

    window.getSelection()!.removeAllRanges();
    activateText!();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByPlaceholderText('Write a note…')).toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('creates no contextual note at all when the feature is disabled', async () => {
    const repo = makeRepo();
    const prefsRepo = makePrefsRepo(withTextNotes({ enabled: false }));
    let activateText: (() => void) | null = null;
    renderApp(repo, prefsRepo, {
      onActivateText: (fn) => {
        activateText = fn;
      },
    });
    await waitFor(() => expect(prefsRepo.get).toHaveBeenCalled());
    await waitFor(() => expect(activateText).not.toBeNull());

    selectText('extremely important');
    expect(queryAction()).toBeNull();

    activateText!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByPlaceholderText('Write a note…')).toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('keeps existing contextual notes and their anchors when the feature is disabled', async () => {
    document.body.innerHTML = PAGE_HTML;
    const text = document.getElementById('intro')!.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, text.data.indexOf('extremely important'));
    range.setEnd(text, text.data.indexOf('extremely important') + 'extremely important'.length);
    const anchor = buildTextAnchor(range)!.anchor;
    const note: Note = {
      id: 'existing',
      schemaVersion: 1,
      pageKey: 'https://example.com/page',
      originalUrl: 'https://example.com/page',
      content: 'an existing contextual note',
      anchor,
      workspaceId: 'default',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const repo = makeRepo([note]);
    const prefsRepo = makePrefsRepo(withTextNotes({ enabled: false }));

    renderApp(repo, prefsRepo);
    await waitFor(() => expect(repo.getForPage).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Disabling hides the feature's on-page presence. It must never write.
    expect(repo.delete).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(note.anchor).toBe(anchor);
    expect((note.anchor as TextAnchor).exact).toBe('extremely important');
  });
});
