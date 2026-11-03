import { describe, expect, it, vi } from 'vitest';
import type { TeamsEvent } from '@/teams/messages';
import { createTeamsService } from '@/teams/service';
import { CONFIG, memorySessions } from './support';

const TEAM = '01J0000000000000000000000A';
const ME = {
  user: { id: 'u', email: 'a@example.test', displayName: 'A' },
  entitlement: { state: 'none', plan: null, until: null, limits: null, sources: [] },
  subscription: { state: 'none', canceled: false, pendingPayment: null },
  teams: [],
  serverTime: 1,
};

function setup(changed: boolean) {
  const events: TeamsEvent[] = [];
  const syncTeam = vi.fn(async () => ({ rounds: 1, resynced: false, folders: [], changed }));
  const service = createTeamsService({
    config: CONFIG,
    sessions: memorySessions({ token: 't', expiresAt: Date.now() + 1000 }),
    api: { me: vi.fn(async () => ME) } as never,
    hasPermissions: async () => true,
    auth: () => ({ redirectUri: '', launchWebAuthFlow: async () => '' }),
    shared: {
      sync: {
        syncTeam,
        reconcile: vi.fn(async () => []),
        forgetTeam: vi.fn(),
        snapshot: vi.fn(),
      } as never,
      realtime: { follow: vi.fn(async () => {}), stopAll: vi.fn() } as never,
      writeIndex: vi.fn(async () => {}),
      clearCache: vi.fn(async () => {}),
      notify: (event) => events.push(event),
      now: () => 1,
    },
  });
  return { service, events };
}

describe('telling Hamesh’s pages something moved on', () => {
  it('says so once a pull brought something in', async () => {
    const { service, events } = setup(true);
    await service.changed(TEAM);
    expect(events).toEqual([{ type: 'TEAMS_EVENT', event: 'notes', teamId: TEAM }]);
  });

  it('stays quiet when there was nothing new, so no page re-reads for nothing', async () => {
    const { service, events } = setup(false);
    await service.changed(TEAM);
    expect(events).toEqual([]);
  });

  it('says so when the account may have changed', async () => {
    const { service, events } = setup(false);
    await service.accountChanged();
    expect(events).toEqual([{ type: 'TEAMS_EVENT', event: 'account' }]);
  });
});
