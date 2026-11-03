// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  (globalThis as unknown as { storage: unknown }).storage = {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: unknown) => void store.set(key, value),
    watch: () => () => {},
  };
  return {
    store,
    sidePanel: { setOptions: vi.fn(async () => {}), open: vi.fn(async () => {}) },
    createTab: vi.fn(async () => ({ id: 2 })),
  };
});

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { getURL: (path: string) => `chrome-extension://id${path}` },
    i18n: { getUILanguage: () => 'en' },
    tabs: {
      query: async () => [{ id: 7, url: 'https://example.test/article#part' }],
      sendMessage: async () => ({ type: 'PAGE_STATE', count: 1 }),
      create: mocks.createTab,
    },
    sidePanel: mocks.sidePanel,
  },
}));

const LABEL = 'Shared notes on this page';
const inATeam = () =>
  mocks.store.set('local:hamesh:teams', { teams: [{ id: 't', name: 'Design' }], syncedAt: 1 });

async function open() {
  const { App } = await import('@/entrypoints/popup/App');
  render(<App />);
}

describe('the popup’s way to the panel', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('WXT_TEAMS_API_ORIGIN', 'https://api.example.test');
    mocks.store.clear();
    vi.clearAllMocks();
    vi.spyOn(window, 'close').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('opens the page’s shared notes beside it, for someone in a team', async () => {
    inATeam();
    await open();
    fireEvent.click(await screen.findByRole('button', { name: LABEL }));
    expect(mocks.sidePanel.open).toHaveBeenCalledWith({ tabId: 7 });
    const { path } = (mocks.sidePanel.setOptions.mock.calls[0] as unknown as [{ path: string }])[0];
    const params = new URLSearchParams(path.split('?')[1]);
    expect(params.get('view')).toBe('panel');
    expect(params.get('pagekey')).toBe('https://example.test/article');
    await waitFor(() => expect(window.close).toHaveBeenCalled());
  });

  it('opens Teams in a tab when the browser refuses the panel', async () => {
    inATeam();
    mocks.sidePanel.open.mockRejectedValueOnce(new Error('no panel'));
    await open();
    fireEvent.click(await screen.findByRole('button', { name: LABEL }));
    await waitFor(() => {
      expect(mocks.createTab).toHaveBeenCalledWith({
        url: 'chrome-extension://id/notes.html?view=teams',
      });
    });
  });

  it('offers nothing to someone with no team', async () => {
    await open();
    await screen.findByText(/note on this page/);
    expect(screen.queryByRole('button', { name: LABEL })).not.toBeInTheDocument();
  });
});
