import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetStorage, store } from './fake-storage';
import { isJoinPage, joinTokenFrom } from '@/teams/join-link';
import {
  PENDING_JOIN_TTL_MS,
  clearPendingJoin,
  readPendingJoin,
  savePendingJoin,
} from '@/teams/join-pending';

const TOKEN = 'Ab3_-'.repeat(8) + 'xyz';

describe('the join page', () => {
  it('is Hamesh’s own join page, and nothing else', () => {
    expect(isJoinPage(`https://hamesh.fandees.tech/join#${TOKEN}`)).toBe(true);
    expect(isJoinPage('https://hamesh.fandees.tech/join.html')).toBe(true);
    for (const url of [
      'http://hamesh.fandees.tech/join',
      'https://evil.example/join',
      'https://hamesh.fandees.tech.evil.example/join',
      'https://hamesh.fandees.tech/join/extra',
      'https://hamesh.fandees.tech/',
      'https://hamesh.fandees.tech:8443/join',
      'not a url',
    ]) {
      expect(isJoinPage(url), url).toBe(false);
    }
  });

  it('carries a token only as the whole fragment', () => {
    expect(joinTokenFrom(`#${TOKEN}`)).toBe(TOKEN);
    for (const hash of ['', '#', `#${TOKEN}x`, `#${TOKEN.slice(1)}`, `${TOKEN}`, `#a=${TOKEN}`]) {
      expect(joinTokenFrom(hash), hash).toBeNull();
    }
  });
});

describe('an invitation waiting to be shown', () => {
  beforeEach(() => resetStorage());

  it('is kept in session storage, out of reach of web pages', async () => {
    await savePendingJoin(TOKEN, 1_000);
    expect([...store.keys()]).toEqual(['session:hamesh:join-pending']);
    expect(await readPendingJoin(1_000)).toBe(TOKEN);
  });

  it('waits ten minutes at most', async () => {
    await savePendingJoin(TOKEN, 1_000);
    expect(await readPendingJoin(1_000 + PENDING_JOIN_TTL_MS - 1)).toBe(TOKEN);
    expect(await readPendingJoin(1_000 + PENDING_JOIN_TTL_MS)).toBeNull();
    // An expired one is forgotten, not just ignored.
    expect(store.size).toBe(0);
  });

  it('is read as many times as asked, until it is cleared', async () => {
    await savePendingJoin(TOKEN, 1_000);
    expect(await readPendingJoin(1_001)).toBe(TOKEN);
    expect(await readPendingJoin(1_002)).toBe(TOKEN);
    await clearPendingJoin();
    expect(await readPendingJoin(1_003)).toBeNull();
  });

  it('ignores anything stored there that is not a token', async () => {
    store.set('session:hamesh:join-pending', { token: 'nope', savedAt: 1 });
    expect(await readPendingJoin(2)).toBeNull();
    store.set('session:hamesh:join-pending', 'just a string');
    expect(await readPendingJoin(2)).toBeNull();
    vi.restoreAllMocks();
  });
});
