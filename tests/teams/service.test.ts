import { describe, it, expect, vi } from 'vitest';
import { createTeamsApi } from '@/teams/api';
import { createTeamsService } from '@/teams/service';
import { CONFIG, LIVE, ME, memorySessions, respond, type MemorySessions } from './support';

const REDIRECT = 'https://abcdefgh.chromiumapp.org/';

function setup(
  opts: {
    session?: typeof LIVE | null;
    permitted?: boolean;
    fetch?: ReturnType<typeof respond>;
    launch?: (url: string) => Promise<string | undefined>;
    configured?: boolean;
  } = {},
) {
  const sessions: MemorySessions = memorySessions(opts.session ?? null);
  const fetch = opts.fetch ?? respond(200, ME);
  const permitted = { value: opts.permitted ?? true };
  const launch =
    opts.launch ??
    vi.fn(
      async (url: string) => `${REDIRECT}?state=${new URL(url).searchParams.get('state')}&code=c`,
    );
  const configured = opts.configured ?? true;
  const service = createTeamsService({
    config: configured ? CONFIG : null,
    sessions,
    api: configured ? createTeamsApi({ config: CONFIG, sessions, fetch }) : null,
    hasPermissions: async () => permitted.value,
    auth: () => ({ redirectUri: REDIRECT, launchWebAuthFlow: launch }),
  });
  return { service, sessions, fetch, permitted, launch };
}

describe('Teams service', () => {
  it('is unavailable in a build without Teams', async () => {
    const { service } = setup({ configured: false });
    expect(await service.status()).toEqual({ status: { state: 'unavailable' } });
    expect((await service.signIn()).error).toBe('not_configured');
  });

  it('asks for permissions before anything else, and makes no request without them', async () => {
    const { service, fetch, launch } = setup({ permitted: false, session: LIVE });
    expect(await service.status()).toEqual({ status: { state: 'permission_needed' } });
    expect((await service.signIn()).error).toBe('permission_missing');
    expect(fetch).not.toHaveBeenCalled();
    expect(launch).not.toHaveBeenCalled();
  });

  it('reports signed out without a session, and the server’s account once signed in', async () => {
    const { service } = setup();
    expect((await service.status()).status).toEqual({ state: 'signed_out' });

    const signedIn = setup({ session: LIVE });
    expect((await signedIn.service.status()).status).toEqual({ state: 'signed_in', me: ME });
  });

  it('signs in through Google and the server, then reports the account', async () => {
    const fetch = vi.fn(async (url: string) =>
      url.endsWith('/v1/auth/google')
        ? Response.json({ token: 'fresh', expiresAt: 9e15 })
        : Response.json(ME),
    );
    const { service, sessions } = setup({ fetch: fetch as never });
    const reply = await service.signIn();
    expect(reply).toEqual({ status: { state: 'signed_in', me: ME } });
    expect(sessions.current?.token).toBe('fresh');
  });

  it('stays signed out when the user closes the Google window', async () => {
    const { service, sessions, fetch } = setup({
      launch: vi.fn(async () => {
        throw new Error('closed');
      }),
    });
    expect(await service.signIn()).toEqual({ status: { state: 'signed_out' }, error: 'cancelled' });
    expect(sessions.current).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('opens one Google window for two quick clicks', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const launch = vi.fn(async (url: string) => {
      await gate;
      return `${REDIRECT}?state=${new URL(url).searchParams.get('state')}&code=c`;
    });
    const fetch = vi.fn(async (url: string) =>
      url.endsWith('/v1/auth/google')
        ? Response.json({ token: 'fresh', expiresAt: 9e15 })
        : Response.json(ME),
    );
    const { service } = setup({ launch, fetch: fetch as never });
    const a = service.signIn();
    const b = service.signIn();
    release();
    expect(await a).toEqual(await b);
    expect(launch).toHaveBeenCalledTimes(1);
  });

  it('shows signed out when the server has ended the session', async () => {
    const { service, sessions } = setup({
      session: LIVE,
      fetch: respond(401, { error: 'unauthenticated' }),
    });
    expect(await service.status()).toEqual({
      status: { state: 'signed_out' },
      error: 'unauthenticated',
    });
    expect(sessions.current).toBeNull();
  });

  it('stays signed in, without inventing an account, when the server is unreachable', async () => {
    const { service } = setup({
      session: LIVE,
      fetch: vi.fn(async () => {
        throw new TypeError('offline');
      }) as never,
    });
    expect(await service.status()).toEqual({
      status: { state: 'signed_in', me: null },
      error: 'network',
    });
  });

  it('signs out', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    const { service, sessions } = setup({ session: LIVE, fetch: fetch as never });
    expect((await service.signOut()).status).toEqual({ state: 'signed_out' });
    expect(sessions.current).toBeNull();
  });

  it('forgets the session when Teams permissions are taken away, and only then', async () => {
    const { service, sessions, permitted } = setup({ session: LIVE });
    await service.permissionsRemoved();
    expect(sessions.current).not.toBeNull(); // some other permission went
    permitted.value = false;
    await service.permissionsRemoved();
    expect(sessions.current).toBeNull();
  });
});
