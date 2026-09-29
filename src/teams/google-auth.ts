import type { GoogleSignInRequest } from '@hamesh/teams-contract';
import type { TeamsConfig } from './config';
import { TeamsError } from './errors';

/**
 * "Sign in with Google": the authorization-code flow with PKCE, run through
 * `identity.launchWebAuthFlow`.
 *
 * The extension only ever holds a one-time code and the PKCE verifier; the
 * server exchanges them with Google (it keeps the client secret), verifies the
 * ID token — including the `nonce` minted here — and issues a Hamesh session.
 * The extension never tells the server who the user is.
 *
 * `state` ties the answer to this attempt: a redirect carrying any other state
 * is refused, so a code planted by someone else can't sign this browser into
 * their account.
 */
const GOOGLE_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';

export interface GoogleAuthDeps {
  config: TeamsConfig;
  /** `identity.getRedirectURL()` — `https://<extension-id>.chromiumapp.org/` on Chrome. */
  redirectUri: string;
  /** `identity.launchWebAuthFlow({ url, interactive: true })`. */
  launchWebAuthFlow: (url: string) => Promise<string | undefined>;
  randomBytes?: (n: number) => Uint8Array;
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const defaultRandom = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function authorizeUrl(p: {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
  nonce: string;
}): string {
  const url = new URL(GOOGLE_AUTHORIZE);
  url.search = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: p.challenge,
    code_challenge_method: 'S256',
    state: p.state,
    nonce: p.nonce,
    prompt: 'select_account',
  }).toString();
  return url.href;
}

/** Pulls the code out of Google's redirect, refusing anything unexpected. */
export function codeFromRedirect(
  responseUrl: string | undefined,
  expected: { redirectUri: string; state: string },
): string {
  if (!responseUrl) throw new TeamsError('cancelled');
  let url: URL;
  let want: URL;
  try {
    url = new URL(responseUrl);
    want = new URL(expected.redirectUri);
  } catch {
    throw new TeamsError('unauthenticated');
  }
  if (url.origin !== want.origin || url.pathname !== want.pathname) {
    throw new TeamsError('unauthenticated');
  }
  const params = url.searchParams;
  const error = params.get('error');
  if (error) throw new TeamsError(error === 'access_denied' ? 'cancelled' : 'unauthenticated');
  if (params.get('state') !== expected.state) throw new TeamsError('unauthenticated');
  const code = params.get('code');
  if (!code || code.length > 2048) throw new TeamsError('unauthenticated');
  return code;
}

/**
 * Runs the Google window and returns what the server needs to finish signing
 * in. Throws `cancelled` when the user closes the window.
 */
export async function authorizeWithGoogle(deps: GoogleAuthDeps): Promise<GoogleSignInRequest> {
  const random = deps.randomBytes ?? defaultRandom;
  const codeVerifier = base64url(random(32)); // 43 chars, the PKCE minimum
  const state = base64url(random(24));
  const nonce = base64url(random(24));
  const url = authorizeUrl({
    clientId: deps.config.googleClientId,
    redirectUri: deps.redirectUri,
    challenge: await pkceChallenge(codeVerifier),
    state,
    nonce,
  });

  let responseUrl: string | undefined;
  try {
    responseUrl = await deps.launchWebAuthFlow(url);
  } catch {
    // The user closed the window, or the browser refused to open one.
    throw new TeamsError('cancelled');
  }
  const code = codeFromRedirect(responseUrl, { redirectUri: deps.redirectUri, state });
  return { code, codeVerifier, redirectUri: deps.redirectUri, nonce };
}
