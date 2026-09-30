import { describe, it, expect, vi } from 'vitest';
import { isTeamsDevSignIn } from '@/teams/messages';
import { createTeamsService } from '@/teams/service';
import { CONFIG, memorySessions, respond } from './support';

/**
 * Handing the worker a session the local server already issued.
 *
 * What matters is what it is *not*: it mints nothing, it trusts nothing, and it
 * skips no check the server makes. A token put in this way is used exactly as
 * one from a Google sign-in, and the server refuses it on the first request if
 * it never issued it.
 */

const TOKEN = 'x'.repeat(43);

const ME = {
  user: { id: '01J0000000000000000000000Z', email: 'you@example.test', displayName: 'You' },
  entitlement: { state: 'none', plan: null, until: null, limits: null, sources: [] },
  subscription: { state: 'none', canceled: false, pendingPayment: null },
  teams: [],
  serverTime: 1,
};

function setup(opts: { permitted?: boolean; fetch?: ReturnType<typeof respond> } = {}) {
  const sessions = memorySessions(null);
  const fetch = opts.fetch ?? respond(200, ME);
  const api = {
    me: vi.fn(async () => ME),
    run: vi.fn(),
    signOut: vi.fn(),
    signInWithGoogle: vi.fn(),
    call: vi.fn(),
  };
  const service = createTeamsService({
    config: CONFIG,
    sessions,
    api: api as never,
    hasPermissions: async () => opts.permitted ?? true,
    auth: () => ({ redirectUri: '', launchWebAuthFlow: async () => '' }),
  });
  void fetch;
  return { service, sessions, api };
}

describe('the shape a local session must have', () => {
  it('is the one the server issues, and nothing else', () => {
    expect(isTeamsDevSignIn({ type: 'TEAMS_DEV_SIGN_IN', token: TOKEN })).toBe(true);
    for (const message of [
      { type: 'TEAMS_DEV_SIGN_IN', token: 'too-short' },
      { type: 'TEAMS_DEV_SIGN_IN', token: `${'x'.repeat(42)}/` },
      { type: 'TEAMS_DEV_SIGN_IN', token: 42 },
      { type: 'TEAMS_DEV_SIGN_IN' },
      { type: 'TEAMS', token: TOKEN },
      null,
    ]) {
      expect(isTeamsDevSignIn(message), JSON.stringify(message)).toBe(false);
    }
  });
});

describe('taking a local session', () => {
  it('keeps it exactly as a sign-in would, and then reports the account', async () => {
    const { service, sessions } = setup();
    const reply = await service.devSignIn(TOKEN);

    expect(sessions.current?.token).toBe(TOKEN);
    expect(reply.status).toEqual({ state: 'signed_in', me: ME });
  });

  it('refuses without the Teams permissions, and keeps nothing', async () => {
    const { service, sessions } = setup({ permitted: false });
    const reply = await service.devSignIn(TOKEN);

    expect(sessions.current).toBeNull();
    expect(reply.error).toBe('permission_missing');
  });

  it('grants nothing by itself: a token the server does not know is dropped on use', async () => {
    const { service, sessions, api } = setup();
    await service.devSignIn(TOKEN);
    expect(sessions.current).not.toBeNull();

    // What a 401 does inside the API client — the session goes, as for any other.
    api.me.mockImplementation(async () => {
      await sessions.clear();
      throw new Error('unauthenticated');
    });
    const reply = await service.status();

    expect(reply.status).toEqual({ state: 'signed_out' });
    expect(sessions.current).toBeNull();
  });
});
