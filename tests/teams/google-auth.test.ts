import { describe, it, expect, vi } from 'vitest';
import { authorizeWithGoogle, codeFromRedirect, pkceChallenge } from '@/teams/google-auth';
import { TeamsError } from '@/teams/errors';
import { CONFIG, codeOf } from './support';

const REDIRECT = 'https://abcdefgh.chromiumapp.org/';

/** Answers the Google window the way Google does, echoing this attempt's state. */
const approve = async (url: string) =>
  `${REDIRECT}?state=${new URL(url).searchParams.get('state')}&code=the-code`;

describe('PKCE', () => {
  it('computes the RFC 7636 S256 challenge', async () => {
    // RFC 7636, Appendix B.
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('Google sign-in', () => {
  it('opens Google with PKCE, state and nonce, and returns what the server needs', async () => {
    let opened = '';
    const request = await authorizeWithGoogle({
      config: CONFIG,
      redirectUri: REDIRECT,
      launchWebAuthFlow: async (url) => {
        opened = url;
        return approve(url);
      },
    });
    const url = new URL(opened);
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe(CONFIG.googleClientId);
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(await pkceChallenge(request.codeVerifier));
    expect(url.searchParams.get('nonce')).toBe(request.nonce);
    expect(request).toMatchObject({ code: 'the-code', redirectUri: REDIRECT });
    expect(request.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(request.nonce.length).toBeGreaterThanOrEqual(16);
  });

  it('uses fresh randomness for every attempt', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const r = await authorizeWithGoogle({
        config: CONFIG,
        redirectUri: REDIRECT,
        launchWebAuthFlow: approve,
      });
      seen.add(r.codeVerifier).add(r.nonce);
    }
    expect(seen.size).toBe(6);
  });

  it('refuses a redirect carrying another attempt’s state', async () => {
    const attempt = authorizeWithGoogle({
      config: CONFIG,
      redirectUri: REDIRECT,
      launchWebAuthFlow: async () => `${REDIRECT}?state=someone-elses&code=planted`,
    });
    expect(await codeOf(attempt)).toBe('unauthenticated');
  });

  it('reports a closed window as cancelled', async () => {
    const attempt = authorizeWithGoogle({
      config: CONFIG,
      redirectUri: REDIRECT,
      launchWebAuthFlow: vi.fn(async () => {
        throw new Error('The user did not approve access.');
      }),
    });
    expect(await codeOf(attempt)).toBe('cancelled');
  });
});

describe('codeFromRedirect', () => {
  const expected = { redirectUri: REDIRECT, state: 's1' };

  it('refuses a redirect to anywhere but the extension’s own redirect URL', () => {
    for (const url of [
      'https://evil.example/?state=s1&code=c',
      'https://abcdefgh.chromiumapp.org/other?state=s1&code=c',
      'not a url',
    ]) {
      expect(() => codeFromRedirect(url, expected)).toThrow(TeamsError);
    }
  });

  it('maps Google’s errors', () => {
    expect(() => codeFromRedirect(`${REDIRECT}?error=access_denied&state=s1`, expected)).toThrow(
      expect.objectContaining({ code: 'cancelled' }),
    );
    expect(() => codeFromRedirect(`${REDIRECT}?error=server_error&state=s1`, expected)).toThrow(
      expect.objectContaining({ code: 'unauthenticated' }),
    );
    expect(() => codeFromRedirect(undefined, expected)).toThrow(
      expect.objectContaining({ code: 'cancelled' }),
    );
  });

  it('requires a code', () => {
    expect(() => codeFromRedirect(`${REDIRECT}?state=s1`, expected)).toThrow(TeamsError);
    expect(codeFromRedirect(`${REDIRECT}?state=s1&code=abc`, expected)).toBe('abc');
  });
});
