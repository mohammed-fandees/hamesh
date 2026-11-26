import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RealtimeDeps } from '@/teams/realtime';
import { createService } from '@/teams/worker';
import { CONFIG } from './support';

const TEAM = '01J0000000000000000000000A';
const NOTE = '01J0000000000000000000000N';

const wired = vi.hoisted(() => ({
  deps: null as unknown,
  sendMessage: vi.fn(() => Promise.resolve()),
}));

vi.mock('wxt/browser', () => ({
  browser: { runtime: { sendMessage: wired.sendMessage } },
}));

vi.mock('@/teams/realtime', () => ({
  createRealtime: (deps: unknown) => {
    wired.deps = deps;
    return { follow: vi.fn(), stop: vi.fn(), stopAll: vi.fn(), connected: () => [] };
  },
}));

/** What the worker handed the socket link, as the link would call it. */
function link(): RealtimeDeps {
  createService(CONFIG);
  return wired.deps as RealtimeDeps;
}

beforeEach(() => wired.sendMessage.mockClear());

describe('what a poke becomes for Hamesh’s own pages', () => {
  it('says the mention inbox may have moved', () => {
    link().onMentioned();
    expect(wired.sendMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'TEAMS_EVENT',
      event: 'mentions',
    });
  });

  it('names the note whose discussion moved on', () => {
    link().onComments(TEAM, NOTE);
    expect(wired.sendMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'TEAMS_EVENT',
      event: 'comments',
      teamId: TEAM,
      noteId: NOTE,
    });
  });
});
