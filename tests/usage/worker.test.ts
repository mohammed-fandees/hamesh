import { describe, expect, it, vi } from 'vitest';
import { emptyLedger, type UsageLedger } from '@/domain/usage';
import { createUsageWorker, type UsageWorkerDeps } from '@/usage/worker';

const NOW = Date.UTC(2026, 10, 17, 9, 30);
const DAY = 86_400_000;

function setup(overrides: Partial<UsageWorkerDeps> = {}) {
  let stored: UsageLedger = emptyLedger(NOW);
  const clock = { now: NOW };
  const sent: { url: string; init: RequestInit }[] = [];
  const deps: UsageWorkerDeps = {
    apiOrigin: 'https://api.example.test',
    // A no-cors answer is opaque: the worker never sees its status.
    fetch: vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      sent.push({ url: String(url), init: init ?? {} });
      return new Response(null);
    }) as unknown as typeof fetch,
    now: () => clock.now,
    context: async () => ({ version: '2.2.0', browser: 'firefox', lang: 'en' }),
    sharing: async () => true,
    read: async () => stored,
    write: async (ledger) => {
      stored = ledger;
    },
    clear: async () => {
      stored = emptyLedger(clock.now);
    },
    ...overrides,
  };
  return { worker: createUsageWorker(deps), clock, sent, ledger: () => stored };
}

describe('the usage worker', () => {
  it('keeps every count when several arrive at once', async () => {
    const { worker, ledger } = setup();
    await Promise.all(Array.from({ length: 25 }, () => worker.count('library.opened')));
    expect(ledger().counts).toEqual({ 'library.opened': 25 });
  });

  it('counts and sends nothing while sharing is off', async () => {
    const { worker, ledger, sent, clock } = setup({ sharing: async () => false });
    await worker.count('library.opened');
    clock.now += DAY;
    await worker.flush();
    expect(ledger().counts).toEqual({});
    expect(sent).toEqual([]);
  });

  it('takes one shortcut press caught twice as one use', async () => {
    const { worker, ledger, clock } = setup();
    await worker.count('open.shortcut.h');
    clock.now += 200;
    await worker.count('open.shortcut.h');
    clock.now += 5000;
    await worker.count('open.shortcut.h');
    expect(ledger().counts['open.shortcut.h']).toBe(2);
  });

  it('sends a finished day once, as plain text, with nothing that identifies anyone', async () => {
    const { worker, clock, sent, ledger } = setup();
    await worker.count('note.created.text');
    clock.now += DAY;
    await worker.flush();
    await worker.flush();
    expect(sent).toHaveLength(1);
    const [{ url, init }] = sent;
    expect(url).toBe('https://api.example.test/v1/usage');
    expect(init).toMatchObject({
      method: 'POST',
      mode: 'no-cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'content-type': 'text/plain' },
    });
    expect(JSON.parse(String(init.body))).toEqual({
      day: '2026-11-17',
      version: '2.2.0',
      browser: 'firefox',
      lang: 'en',
      counts: { 'note.created.text': 1 },
    });
    expect(ledger().pending).toBeNull();
  });

  it('sends nothing for today, which is not over yet', async () => {
    const { worker, sent } = setup();
    await worker.count('note.created.text');
    await worker.flush();
    expect(sent).toEqual([]);
  });

  it('keeps a report it could not send, and sends it when the network is back', async () => {
    let online = false;
    const { worker, clock, ledger } = setup({
      fetch: vi.fn(async () => {
        if (!online) throw new TypeError('Failed to fetch');
        return new Response(null);
      }) as unknown as typeof fetch,
    });
    await worker.count('open.popup');
    clock.now += DAY;
    await worker.flush();
    expect(ledger().pending?.counts).toEqual({ 'open.popup': 1 });
    online = true;
    await worker.flush();
    expect(ledger().pending).toBeNull();
  });
});
