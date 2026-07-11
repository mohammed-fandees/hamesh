// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const sendMessage = vi.fn();
const query = vi.fn();

// Minimal fake of WXT's `storage` global (auto-imported at runtime, absent in
// tests) with just enough of getItem/setItem/watch for the preferences
// repository — same shape as tests/storage/notes-repository.test.ts's mock,
// extended with watchers so cross-context propagation is exercisable.
const fakeStorage = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const watchers = new Map<string, Set<(v: unknown) => void>>();
  const api = {
    getItem: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      for (const cb of watchers.get(key) ?? []) cb(value);
      return Promise.resolve();
    }),
    snapshot: vi.fn((area?: string) => {
      const entries = [...store.entries()];
      if (area) {
        const filtered = entries.filter(([k]) => k.startsWith(`${area}:`));
        return Promise.resolve(
          Object.fromEntries(filtered.map(([k, v]) => [k.slice(area.length + 1), v])),
        );
      }
      return Promise.resolve(Object.fromEntries(store));
    }),
    watch: vi.fn((key: string, cb: (v: unknown) => void) => {
      if (!watchers.has(key)) watchers.set(key, new Set());
      watchers.get(key)!.add(cb);
      return () => watchers.get(key)?.delete(cb);
    }),
  };
  (globalThis as unknown as { storage: unknown }).storage = api;
  return { store, api };
});

vi.mock('wxt/browser', () => ({
  browser: {
    tabs: {
      query: (...args: unknown[]) => query(...args),
      sendMessage: (...args: unknown[]) => sendMessage(...args),
    },
    i18n: {
      getUILanguage: () => 'en',
    },
  },
}));

async function importApp() {
  const mod = await import('@/entrypoints/popup/App');
  return mod.App;
}

describe('popup Settings navigation', () => {
  beforeEach(() => {
    vi.resetModules();
    query.mockReset().mockResolvedValue([{ id: 1 }]);
    sendMessage.mockReset().mockResolvedValue({ type: 'PAGE_STATE', count: 2 });
    fakeStorage.store.clear();
    fakeStorage.api.getItem.mockClear();
    fakeStorage.api.setItem.mockClear();
    // jsdom's window.close() genuinely tears the window down; the real handler
    // calls it after a successful "Add a note" send, so stub it out here.
    vi.spyOn(window, 'close').mockImplementation(() => {});
    cleanup();
  });

  it('opens Settings from the gear button: Language and Appearance are both live controls', async () => {
    const App = await importApp();
    render(<App />);

    const openBtn = await screen.findByRole('button', { name: 'Settings' });
    fireEvent.click(openBtn);

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Arabic' })).not.toBeChecked();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    // Match Website is the default.
    expect(screen.getByRole('radio', { name: 'Match website' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Light' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Dark' })).not.toBeChecked();
  });

  it('selecting a language updates the UI immediately and persists it to storage', async () => {
    const App = await importApp();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Arabic' }));

    // Immediate feedback: the popup itself re-renders in Arabic/RTL, and the
    // English radio's a11y name updates too since it's now Hamesh's own label.
    expect(await screen.findByRole('heading', { name: 'الإعدادات' })).toBeInTheDocument();
    expect(document.querySelector('.hm-popup')).toHaveAttribute('dir', 'rtl');

    await waitFor(() =>
      expect(fakeStorage.api.setItem).toHaveBeenCalledWith(
        'local:hamesh:preferences',
        expect.objectContaining({ language: 'ar' }),
      ),
    );
  });

  it('restores a previously saved language preference on reopen (remount)', async () => {
    fakeStorage.store.set('local:hamesh:preferences', { schemaVersion: 1, language: 'ar' });
    const App = await importApp();
    render(<App />);

    expect(await screen.findByText('هامش')).toBeInTheDocument();
    expect(document.querySelector('.hm-popup')).toHaveAttribute('dir', 'rtl');
  });

  it('falls back to the browser UI language for a malformed or unknown stored preference', async () => {
    fakeStorage.store.set('local:hamesh:preferences', { language: 'fr' });
    const App = await importApp();
    render(<App />);

    expect(await screen.findByText('Hamesh')).toBeInTheDocument();
    expect(document.querySelector('.hm-popup')).toHaveAttribute('dir', 'ltr');
  });

  it('Match Website is the default appearance and renders light in this OS/test environment', async () => {
    const App = await importApp();
    render(<App />);
    await screen.findByText('Hamesh');
    expect(document.querySelector('.hm-popup')).toHaveAttribute('data-hm-theme', 'light');
  });

  it('selecting an appearance updates the popup theme immediately and persists it to storage', async () => {
    const App = await importApp();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(document.querySelector('.hm-popup')).toHaveAttribute('data-hm-theme', 'dark');
    await waitFor(() =>
      expect(fakeStorage.api.setItem).toHaveBeenCalledWith(
        'local:hamesh:preferences',
        expect.objectContaining({ appearance: 'dark' }),
      ),
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(document.querySelector('.hm-popup')).toHaveAttribute('data-hm-theme', 'light');

    // Back to Match Website restores the OS/default-derived value.
    fireEvent.click(screen.getByRole('radio', { name: 'Match website' }));
    expect(document.querySelector('.hm-popup')).toHaveAttribute('data-hm-theme', 'light');
  });

  it('restores a previously saved appearance preference on reopen (remount)', async () => {
    fakeStorage.store.set('local:hamesh:preferences', {
      schemaVersion: 1,
      language: null,
      appearance: 'dark',
    });
    const App = await importApp();
    render(<App />);

    await screen.findByText('Hamesh');
    expect(document.querySelector('.hm-popup')).toHaveAttribute('data-hm-theme', 'dark');
  });

  it('falls back to Match Website for a malformed or unknown stored appearance value', async () => {
    fakeStorage.store.set('local:hamesh:preferences', { appearance: 'auto' });
    const App = await importApp();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('radio', { name: 'Match website' })).toBeChecked();
    expect(document.querySelector('.hm-popup')).toHaveAttribute('data-hm-theme', 'light');
  });

  it('uses real <button> elements for the settings trigger and back action (native keyboard operability)', async () => {
    const App = await importApp();
    render(<App />);

    const openBtn = await screen.findByRole('button', { name: 'Settings' });
    expect(openBtn.tagName).toBe('BUTTON');
    fireEvent.click(openBtn);
    expect(screen.getByRole('button', { name: 'Back' }).tagName).toBe('BUTTON');
  });

  it('drives the slide purely via a CSS class transition, not an inline one (so prefers-reduced-motion can disable it)', async () => {
    const App = await importApp();
    const { container } = render(<App />);
    const track = container.querySelector('.hm-popup__track') as HTMLElement;
    expect(track.style.transition).toBe('');
    expect(track.style.transform).toBeTruthy();
  });

  it('focuses the Settings heading on open and returns focus to the gear button on back', async () => {
    const App = await importApp();
    render(<App />);

    const openBtn = await screen.findByRole('button', { name: 'Settings' });
    fireEvent.click(openBtn);
    expect(screen.getByRole('heading', { name: 'Settings' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(openBtn).toHaveFocus();
  });

  it('closes Settings on Escape and returns to the home pane', async () => {
    const App = await importApp();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    // aria-hidden (+ inert) on the settings pane removes it from the a11y tree.
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
    // The home pane's primary action is reachable again.
    expect(screen.getByRole('button', { name: /add a note/i })).toBeEnabled();
  });

  it('does not regress the existing Add a note flow', async () => {
    const App = await importApp();
    render(<App />);

    const addBtn = await screen.findByRole('button', { name: /add a note/i });
    expect(addBtn).toBeEnabled();
    fireEvent.click(addBtn);
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(1, { type: 'ENABLE_SELECTION' }));
  });

  it('opens the notes browser and shows grouped saved notes', async () => {
    fakeStorage.store.set('local:hamesh:notes:https://example.com/docs', [
      {
        id: '1',
        schemaVersion: 1,
        pageKey: 'https://example.com/docs',
        originalUrl: 'https://example.com/docs',
        content: 'first saved note',
        anchor: {
          primarySelector: null,
          signals: { tagName: 'div' },
          fallbackDocumentPosition: { x: 0, y: 0 },
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);

    const App = await importApp();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /browse notes/i }));

    expect(await screen.findByRole('heading', { name: 'Notes browser' })).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('example.com/docs')).toBeInTheDocument();
    expect(screen.getByText('first saved note')).toBeInTheDocument();
  });

  it('mirrors slide direction for RTL', async () => {
    query.mockResolvedValue([{ id: 1 }]);
    vi.doMock('wxt/browser', () => ({
      browser: {
        tabs: { query, sendMessage },
        i18n: { getUILanguage: () => 'ar' },
      },
    }));
    const App = await importApp();
    const { container } = render(<App />);

    const track = container.querySelector('.hm-popup__track') as HTMLElement;
    expect(track.style.transform).toContain('0%');

    fireEvent.click(await screen.findByRole('button', { name: 'الإعدادات' }));
    expect(track.style.transform).toBe('translateX(66.66666666666667%)');
  });
});
