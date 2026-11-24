// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Note } from '@/domain/note';

const HEALTH = 'local:hamesh:anchor-health';
const PAGE = 'https://maktaba.site/bennabi';

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
    watch: vi.fn((key: string, cb: (v: unknown) => void) => {
      if (!watchers.has(key)) watchers.set(key, new Set());
      watchers.get(key)!.add(cb);
      return () => watchers.get(key)?.delete(cb);
    }),
    snapshot: vi.fn((area: string) =>
      Promise.resolve(
        Object.fromEntries(
          [...store.entries()]
            .filter(([k]) => k.startsWith(`${area}:`))
            .map(([k, v]) => [k.slice(area.length + 1), v]),
        ),
      ),
    ),
  };
  (globalThis as unknown as { storage: unknown }).storage = api;
  return { store, api };
});

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      id: 'test-extension-id',
      getURL: (path: string) => `chrome-extension://test-extension-id${path}`,
      getManifest: () => ({ version: '1.2.3' }),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
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

const note = (id: string, content: string): Note => ({
  id,
  schemaVersion: 1,
  pageKey: PAGE,
  originalUrl: PAGE,
  content,
  anchor: {
    type: 'text',
    version: 1,
    exact: `words of ${id}`,
    context: { prefix: '', suffix: '' },
    textPosition: { start: 0, end: 10 },
  },
  workspaceId: 'default',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const entry = (status: string) => ({
  status,
  misses: 2,
  lastCheckedAt: '2026-11-01T00:00:00.000Z',
  pageKey: PAGE,
});

describe('Notes Library — notes that lost their place', () => {
  beforeEach(() => {
    vi.resetModules();
    fakeStorage.store.clear();
    fakeStorage.api.setItem.mockClear();
    cleanup();
    fakeStorage.store.set(`local:hamesh:notes:${PAGE}`, [
      note('lost', 'the colonisable mind'),
      note('kept', 'man, soil and time'),
      note('fine', 'an idea that moves'),
    ]);
    fakeStorage.store.set(HEALTH, {
      lost: entry('lost'),
      kept: entry('kept-without-place'),
      deleted: entry('lost'),
    });
  });

  it('marks the lost note, filters to it, and drops health of a deleted note', async () => {
    const { App } = await import('@/entrypoints/notes/App');
    render(<App />);

    const filter = await screen.findByRole('button', { name: 'Lost their place · 1' });
    await waitFor(() =>
      expect(Object.keys(fakeStorage.store.get(HEALTH) as object).sort()).toEqual(['kept', 'lost']),
    );

    fireEvent.click(filter);
    expect(filter).toHaveAttribute('aria-pressed', 'true');
    const rows = document.querySelectorAll('[data-note-id]');
    expect([...rows].map((r) => r.getAttribute('data-note-id'))).toEqual(['lost']);
    expect(within(rows[0] as HTMLElement).getByText('Lost its place')).toBeInTheDocument();
  });
});
