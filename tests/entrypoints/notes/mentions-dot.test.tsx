// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor, act } from '@testing-library/react';
import type { TeamsEvent } from '@/teams/messages';

const TEAM = '01J0000000000000000000000A';
const NOTE = '01J0000000000000000000000N';

const teams = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  (globalThis as unknown as { storage: unknown }).storage = {
    getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItem: (key: string, value: unknown) => Promise.resolve(void store.set(key, value)),
    watch: () => () => {},
    snapshot: () => Promise.resolve({}),
  };
  const listeners = new Set<(event: unknown) => void>();
  const request = vi.fn((op: string) =>
    Promise.resolve(
      op === 'mentions.list'
        ? { ok: true, data: { mentions: [], nextBefore: null } }
        : { ok: false, error: 'not_found' },
    ),
  );
  return { listeners, request };
});

vi.mock('@/teams/client', () => ({
  createTeamsClient: () => ({
    request: teams.request,
    send: () => Promise.resolve({ status: { state: 'signed_out' } }),
    cache: () => Promise.resolve({ ok: false, error: 'not_configured' }),
    onEvent: (listener: (event: unknown) => void) => {
      teams.listeners.add(listener);
      return () => teams.listeners.delete(listener);
    },
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

const asked = () => teams.request.mock.calls.filter(([op]) => op === 'mentions.list').length;
const poke = (event: TeamsEvent) =>
  act(async () => {
    for (const listener of teams.listeners) listener(event);
  });

beforeEach(() => {
  vi.stubEnv('WXT_TEAMS_API_ORIGIN', 'https://api.example.com');
  vi.stubEnv('WXT_GOOGLE_CLIENT_ID', 'test.apps.googleusercontent.com');
  teams.request.mockClear();
  teams.listeners.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('the Library’s Mentions dot', () => {
  it('asks the server only when this account’s inbox may have moved', async () => {
    const { App } = await import('@/entrypoints/notes/App');
    render(<App />);
    await waitFor(() => expect(asked()).toBe(1));

    await poke({ type: 'TEAMS_EVENT', event: 'comments', teamId: TEAM, noteId: NOTE });
    await poke({ type: 'TEAMS_EVENT', event: 'notes', teamId: TEAM });
    expect(asked()).toBe(1);

    await poke({ type: 'TEAMS_EVENT', event: 'mentions' });
    expect(asked()).toBe(2);

    await poke({ type: 'TEAMS_EVENT', event: 'account' });
    expect(asked()).toBe(3);
  });
});
