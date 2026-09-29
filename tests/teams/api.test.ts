import { describe, it, expect, vi } from 'vitest';
import { createTeamsApi } from '@/teams/api';
import { TeamsError } from '@/teams/errors';
import { CONFIG, LIVE, ME, codeOf, memorySessions, respond } from './support';

describe('Teams API client', () => {
  it('sends the bearer token to the configured origin only, with no cookies or redirects', async () => {
    const fetch = respond(200, ME);
    const api = createTeamsApi({ config: CONFIG, sessions: memorySessions(LIVE), fetch });
    await api.me();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://api.example.com/v1/me');
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(init!.credentials).toBe('omit');
    expect(init!.redirect).toBe('error');
  });

  it('does not call the server at all without a session', async () => {
    const fetch = respond(200, ME);
    const api = createTeamsApi({ config: CONFIG, sessions: memorySessions(), fetch });
    expect(await codeOf(api.me())).toBe('signed_out');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forgets the session when the server answers 401', async () => {
    const sessions = memorySessions(LIVE);
    const api = createTeamsApi({
      config: CONFIG,
      sessions,
      fetch: respond(401, { error: 'unauthenticated' }),
    });
    expect(await codeOf(api.me())).toBe('unauthenticated');
    expect(sessions.current).toBeNull();
  });

  it('keeps the session on other errors', async () => {
    const sessions = memorySessions(LIVE);
    const api = createTeamsApi({
      config: CONFIG,
      sessions,
      fetch: respond(429, { error: 'rate_limited' }),
    });
    expect(await codeOf(api.me())).toBe('rate_limited');
    expect(sessions.current).not.toBeNull();
  });

  it('never trusts an answer that does not match the contract', async () => {
    const sessions = memorySessions(LIVE);
    // A client-visible "isPremium" (or any field outside the contract) is refused.
    const extra = createTeamsApi({
      config: CONFIG,
      sessions,
      fetch: respond(200, { ...ME, isPremium: true }),
    });
    expect(await codeOf(extra.me())).toBe('bad_response');
    const html = createTeamsApi({
      config: CONFIG,
      sessions,
      fetch: vi.fn(async () => new Response('<html>', { status: 200 })),
    });
    expect(await codeOf(html.me())).toBe('bad_response');
  });

  it('maps unknown error codes to bad_response and keeps only field names', async () => {
    const sessions = memorySessions(LIVE);
    const unknown = createTeamsApi({
      config: CONFIG,
      sessions,
      fetch: respond(500, { error: 'boom' }),
    });
    expect(await codeOf(unknown.me())).toBe('bad_response');

    const invalid = createTeamsApi({
      config: CONFIG,
      sessions,
      fetch: respond(400, { error: 'invalid_request', fields: ['code', 3, { x: 1 }] }),
    });
    const err = await invalid.me().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TeamsError);
    expect((err as TeamsError).code).toBe('invalid_request');
    expect((err as TeamsError).fields).toEqual(['code']);
  });

  it('reports a failed request as network', async () => {
    const api = createTeamsApi({
      config: CONFIG,
      sessions: memorySessions(LIVE),
      fetch: vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    });
    expect(await codeOf(api.me())).toBe('network');
  });

  it('keeps the session from a sign-in, and sends no bearer token or identity for it', async () => {
    const sessions = memorySessions();
    const fetch = respond(201, { token: 'new-token', expiresAt: 123 });
    const api = createTeamsApi({ config: CONFIG, sessions, fetch });
    await api.signInWithGoogle({
      code: 'c',
      codeVerifier: 'v'.repeat(43),
      redirectUri: 'https://id.chromiumapp.org/',
      nonce: 'n'.repeat(16),
    });
    expect(sessions.current).toEqual({ token: 'new-token', expiresAt: 123 });
    const init = fetch.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
    expect(Object.keys(JSON.parse(init.body as string)).sort()).toEqual([
      'code',
      'codeVerifier',
      'nonce',
      'redirectUri',
    ]);
  });

  it('does not keep a sign-in answer that is not a session', async () => {
    const sessions = memorySessions();
    const api = createTeamsApi({
      config: CONFIG,
      sessions,
      fetch: respond(200, { token: 'x', expiresAt: 1, role: 'owner' }),
    });
    expect(
      await codeOf(
        api.signInWithGoogle({
          code: 'c',
          codeVerifier: 'v'.repeat(43),
          redirectUri: 'https://id.chromiumapp.org/',
          nonce: 'n'.repeat(16),
        }),
      ),
    ).toBe('bad_response');
    expect(sessions.current).toBeNull();
  });

  it('signs out on the server, and locally even when the server cannot be reached', async () => {
    const online = memorySessions(LIVE);
    const fetch = respond(204);
    await createTeamsApi({ config: CONFIG, sessions: online, fetch }).signOut();
    expect(fetch.mock.calls[0]![0]).toBe('https://api.example.com/v1/auth/signout');
    expect(online.current).toBeNull();

    const offline = memorySessions(LIVE);
    await createTeamsApi({
      config: CONFIG,
      sessions: offline,
      fetch: vi.fn(async () => {
        throw new TypeError('offline');
      }),
    }).signOut();
    expect(offline.current).toBeNull();
  });

  it('only ever calls API paths on the configured origin', async () => {
    const api = createTeamsApi({
      config: CONFIG,
      sessions: memorySessions(LIVE),
      fetch: respond(204),
    });
    await expect(api.call('GET', '//evil.example/x', { schema: null })).rejects.toThrow(/API path/);
    await expect(api.call('GET', '/v1/../admin', { schema: null })).rejects.toThrow(/API path/);
  });
});
