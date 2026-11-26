// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor, screen } from '@testing-library/react';

const OLDER = '01J0000000000000000000000A';
const NEWER = '01J0000000000000000000000B';

const teams = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  (globalThis as unknown as { storage: unknown }).storage = {
    getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItem: (key: string, value: unknown) => Promise.resolve(void store.set(key, value)),
    watch: () => () => {},
    snapshot: () => Promise.resolve({}),
  };
  /** What the server lists, newest first; `asked` settles once it has answered. */
  const inbox = { newest: null as string | null, asked: 0 };
  const request = vi.fn((op: string) => {
    if (op !== 'mentions.list') return Promise.resolve({ ok: false, error: 'not_found' });
    inbox.asked += 1;
    const mentions = inbox.newest ? [{ commentId: inbox.newest }] : [];
    return Promise.resolve({ ok: true, data: { mentions, nextBefore: null } });
  });
  return { store, inbox, request };
});

vi.mock('@/teams/client', () => ({
  createTeamsClient: () => ({
    request: teams.request,
    send: () => Promise.resolve({ status: { state: 'signed_out' } }),
    cache: () => Promise.resolve({ ok: false, error: 'not_configured' }),
    onEvent: () => () => {},
    requestPermissions: () => Promise.resolve(false),
    removePermissions: () => Promise.resolve(),
    devSignIn: () => Promise.resolve({ status: { state: 'unavailable' } }),
  }),
}));

vi.mock('@/teams/announcements', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/teams/announcements')>()),
  readAnnouncements: () => Promise.resolve([]),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      id: 'test-extension-id',
      getURL: (path: string) => `chrome-extension://test-extension-id${path}`,
      getManifest: () => ({ version: '1.2.3' }),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
    tabs: {
      create: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    i18n: { getUILanguage: () => 'en' },
    storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
  },
}));

async function openLibrary(lastSeen: string | null, newest: string) {
  teams.inbox.newest = newest;
  teams.store.set('local:hamesh:preferences', {
    language: 'en',
    teams: { lastSeenMentionId: lastSeen },
  });
  const { App } = await import('@/entrypoints/notes/App');
  render(<App />);
  await waitFor(() => expect(teams.inbox.asked).toBe(1));
  return screen.findByRole('button', { name: 'Mentions' });
}

const dot = (button: HTMLElement) => button.querySelector('.hm-sidebar__dot');

beforeEach(() => {
  vi.stubEnv('WXT_TEAMS_API_ORIGIN', 'https://api.example.com');
  vi.stubEnv('WXT_GOOGLE_CLIENT_ID', 'test.apps.googleusercontent.com');
  teams.inbox.asked = 0;
});

afterEach(() => {
  cleanup();
  teams.store.clear();
  vi.unstubAllEnvs();
});

describe('the Library’s Mentions dot', () => {
  it('lights for a mention newer than the one last looked at', async () => {
    const button = await openLibrary(OLDER, NEWER);
    await waitFor(() => expect(dot(button)).not.toBeNull());
  });

  it('lights for a first mention nobody has looked at', async () => {
    const button = await openLibrary(null, OLDER);
    await waitFor(() => expect(dot(button)).not.toBeNull());
  });

  it('stays dark when the last one seen is deleted and an older one tops the list', async () => {
    const button = await openLibrary(NEWER, OLDER);
    /* A tick for the answer to reach the sidebar before saying it did nothing. */
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(dot(button)).toBeNull();
  });
});
