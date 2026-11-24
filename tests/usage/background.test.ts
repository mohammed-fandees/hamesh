import { store, resetStorage } from '../teams/fake-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { utcDay } from '@/domain/usage';
import { registerUsage } from '@/usage/background';

const { on, fire, listeners } = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => unknown;
  const listeners: Record<string, Listener[]> = {};
  return {
    listeners,
    on: (name: string) => ({
      addListener: (fn: Listener) => (listeners[name] ??= []).push(fn),
    }),
    fire: (name: string, ...args: unknown[]) =>
      (listeners[name] ?? []).forEach((fn) => fn(...args)),
  };
});

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { id: 'self', getManifest: () => ({ version: '2.2.0' }), onMessage: on('message') },
    commands: { onCommand: on('command') },
    storage: { onChanged: on('changed') },
    alarms: { create: vi.fn(), onAlarm: on('alarm') },
    permissions: { onRemoved: on('removed') },
    i18n: { getUILanguage: () => 'ar-EG' },
  },
}));

const PREFS = 'local:hamesh:preferences';
const LEDGER = 'local:hamesh:usage';
const counts = () => (store.get(LEDGER) as { counts?: Record<string, number> } | undefined)?.counts;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  resetStorage();
  for (const key of Object.keys(listeners)) delete listeners[key];
  store.set(PREFS, { usage: { sharing: 'on' } });
  registerUsage('https://api.example.test');
});

describe('usage counts in the background', () => {
  it('counts what a page of this extension says happened', async () => {
    fire('message', { type: 'USAGE_COUNT', event: 'library.opened' }, { id: 'self' });
    await settle();
    expect(counts()).toEqual({ 'library.opened': 1 });
  });

  it('ignores another sender, and names not on the list', async () => {
    fire('message', { type: 'USAGE_COUNT', event: 'library.opened' }, { id: 'someone-else' });
    fire('message', { type: 'USAGE_COUNT', event: 'page.visited' }, { id: 'self' });
    await settle();
    expect(counts()).toBeUndefined();
  });

  it('counts a note by its kind from what storage holds, never from the page', async () => {
    const note = { id: 'n1', createdAt: new Date().toISOString(), anchor: { type: 'video' } };
    fire('changed', { 'hamesh:notes:example.com/': { oldValue: [], newValue: [note] } }, 'local');
    await settle();
    expect(counts()).toEqual({ 'note.created.video': 1 });
  });

  it('counts nothing while sharing is off', async () => {
    store.set(PREFS, { usage: { sharing: 'off' } });
    fire('message', { type: 'USAGE_COUNT', event: 'library.opened' }, { id: 'self' });
    fire('command', 'activate-hamesh');
    await settle();
    expect(counts()).toBeUndefined();
  });

  it('forgets every count the moment sharing is turned off, from anywhere', async () => {
    store.set(LEDGER, { day: utcDay(Date.now()), counts: { 'open.popup': 4 }, pending: null });
    store.set(PREFS, { usage: { sharing: 'off' } });
    fire('changed', { 'hamesh:preferences': { newValue: { usage: { sharing: 'off' } } } }, 'local');
    await settle();
    expect(store.has(LEDGER)).toBe(false);
  });

  it('says the moment sharing is turned on, once', async () => {
    const posted = vi.fn(async (_url: string, _init: RequestInit) => new Response(null));
    vi.stubGlobal('fetch', posted);
    try {
      const turnedOn = { usage: { sharing: 'on' } };
      fire(
        'changed',
        {
          'hamesh:preferences': { oldValue: { usage: { sharing: 'unasked' } }, newValue: turnedOn },
        },
        'local',
      );
      await settle();
      const enabled = posted.mock.calls.filter(([, init]) =>
        String(init.body).includes('usage.enabled'),
      );
      expect(enabled).toHaveLength(1);

      fire(
        'changed',
        { 'hamesh:preferences': { oldValue: turnedOn, newValue: { ...turnedOn, language: 'en' } } },
        'local',
      );
      await settle();
      expect(
        posted.mock.calls.filter(([, init]) => String(init.body).includes('usage.enabled')),
      ).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
