import { describe, it, expect, vi } from 'vitest';
import { createTeamsApi } from '@/teams/api';
import { createTeamsService } from '@/teams/service';
import { CONFIG, LIVE, memorySessions, respond } from './support';

const TEAM = '01J0000000000000000000000A';
const USER = '01J0000000000000000000000B';

const TEAM_BODY = {
  team: { id: TEAM, name: 'Alpha', role: 'owner', state: 'active', readOnlyUntil: null },
  capabilities: ['team.view'],
  serverTime: 1,
};

function setup(opts: { permitted?: boolean; fetch?: ReturnType<typeof respond> } = {}) {
  const sessions = memorySessions(LIVE);
  const fetch = opts.fetch ?? respond(200, TEAM_BODY);
  const service = createTeamsService({
    config: CONFIG,
    sessions,
    api: createTeamsApi({ config: CONFIG, sessions, fetch }),
    hasPermissions: async () => opts.permitted ?? true,
    auth: () => ({ redirectUri: 'https://x.chromiumapp.org/', launchWebAuthFlow: async () => '' }),
  });
  return { service, fetch, sessions };
}

describe('performing an operation for a page', () => {
  it('calls the server and hands back what it said', async () => {
    const { service, fetch } = setup();
    const result = await service.perform('team.get', { teamId: TEAM });
    expect(result).toEqual({ ok: true, data: TEAM_BODY });
    expect(fetch.mock.calls[0]![0]).toBe(`https://api.example.com/v1/teams/${TEAM}`);
  });

  it('checks the params before the network, and names what was wrong', async () => {
    const { service, fetch } = setup();
    const result = await service.perform('team.get', { teamId: '../../admin' });
    expect(result).toEqual({ ok: false, error: 'invalid_request', fields: ['teamId'] });
    expect(fetch, 'nothing should have been sent').not.toHaveBeenCalled();
  });

  it('refuses a field the operation never asked for', async () => {
    const { service, fetch } = setup();
    // A page cannot smuggle its own idea of a role past the operation.
    const result = await service.perform('members.setRole', {
      teamId: TEAM,
      userId: USER,
      role: 'owner',
    } as never);
    expect(result.ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does nothing at all without the Teams permissions', async () => {
    const { service, fetch } = setup({ permitted: false });
    expect(await service.perform('team.get', { teamId: TEAM })).toEqual({
      ok: false,
      error: 'permission_missing',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports the server’s refusal by its code', async () => {
    const { service } = setup({ fetch: respond(403, { error: 'forbidden' }) });
    expect(await service.perform('team.delete', { teamId: TEAM })).toEqual({
      ok: false,
      error: 'forbidden',
    });
  });

  it('refuses an answer that does not match the contract', async () => {
    const { service } = setup({
      fetch: respond(200, { ...TEAM_BODY, team: { ...TEAM_BODY.team, isPremium: true } }),
    });
    expect(await service.perform('team.get', { teamId: TEAM })).toEqual({
      ok: false,
      error: 'bad_response',
    });
  });

  it('accepts an empty answer where the contract has none', async () => {
    const { service } = setup({ fetch: respond(204) });
    expect(await service.perform('members.remove', { teamId: TEAM, userId: USER })).toEqual({
      ok: true,
      data: undefined,
    });
  });

  it('forgets the session when the server says the caller is not signed in', async () => {
    const { service, sessions } = setup({ fetch: respond(401, { error: 'unauthenticated' }) });
    expect((await service.perform('team.get', { teamId: TEAM })).ok).toBe(false);
    expect(sessions.current).toBeNull();
  });

  it('reports a failed request as network, without a session being lost', async () => {
    const sessions = memorySessions(LIVE);
    const service = createTeamsService({
      config: CONFIG,
      sessions,
      api: createTeamsApi({
        config: CONFIG,
        sessions,
        fetch: vi.fn(async () => {
          throw new TypeError('offline');
        }),
      }),
      hasPermissions: async () => true,
      auth: () => ({ redirectUri: '', launchWebAuthFlow: async () => '' }),
    });
    expect(await service.perform('team.get', { teamId: TEAM })).toEqual({
      ok: false,
      error: 'network',
    });
    expect(sessions.current).not.toBeNull();
  });
});
