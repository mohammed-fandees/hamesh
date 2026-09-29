/**
 * Build-time configuration for Hamesh Teams.
 *
 * Teams is optional and off unless a build is given both values below
 * (through `WXT_TEAMS_API_ORIGIN` and `WXT_GOOGLE_CLIENT_ID`, e.g. in a local
 * `.env.local`). Neither is a secret: the API origin is where the extension
 * connects, and a Google OAuth client id is public by design. Nothing else
 * about Teams (plans, prices, limits, who may do what) is configured here —
 * the server decides all of that and the extension only shows what it says.
 *
 * A build without them is exactly the local-only Hamesh: no Teams UI, no
 * optional permissions in the manifest, no network code reachable.
 */
export interface TeamsConfig {
  /** Origin of the Teams API, e.g. `https://api.hamesh.app` — no path. */
  apiOrigin: string;
  /** Google OAuth client id used for "Sign in with Google". */
  googleClientId: string;
}

export interface RawTeamsConfig {
  apiOrigin?: string;
  googleClientId?: string;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const GOOGLE_CLIENT_ID =
  /^[A-Za-z0-9-]{1,120}(\.[A-Za-z0-9-]{1,60})*\.apps\.googleusercontent\.com$/;

/**
 * Validates raw values. Returns `null` when Teams is simply not configured
 * (both empty), and throws when it is configured wrongly — a half-set or
 * malformed config must fail the build, never ship a Teams UI that talks to
 * the wrong place.
 */
export function parseTeamsConfig(raw: RawTeamsConfig): TeamsConfig | null {
  const apiOrigin = raw.apiOrigin?.trim() ?? '';
  const googleClientId = raw.googleClientId?.trim() ?? '';
  if (!apiOrigin && !googleClientId) return null;
  if (!apiOrigin || !googleClientId) {
    throw new Error(
      'Teams config is incomplete: set both WXT_TEAMS_API_ORIGIN and WXT_GOOGLE_CLIENT_ID, or neither.',
    );
  }

  let url: URL;
  try {
    url = new URL(apiOrigin);
  } catch {
    throw new Error('WXT_TEAMS_API_ORIGIN is not a URL.');
  }
  if (url.origin !== apiOrigin) {
    throw new Error('WXT_TEAMS_API_ORIGIN must be a bare origin, e.g. https://api.example.com');
  }
  // Plain http only ever reaches a server on this machine; anything else must
  // be https, or a session token would cross the network in the clear.
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))
  ) {
    throw new Error('WXT_TEAMS_API_ORIGIN must use https (http is allowed for localhost only).');
  }
  if (!GOOGLE_CLIENT_ID.test(googleClientId)) {
    throw new Error('WXT_GOOGLE_CLIENT_ID is not a Google OAuth client id.');
  }
  return { apiOrigin, googleClientId };
}

/** The match pattern the optional host permission asks for. */
export function hostPermissionFor(config: TeamsConfig): string {
  return `${config.apiOrigin}/*`;
}

/** The permissions "Turn on Teams" requests, and "Turn off Teams" gives back. */
export function teamsPermissions(config: TeamsConfig): {
  permissions: 'identity'[];
  origins: string[];
} {
  return { permissions: ['identity'], origins: [hostPermissionFor(config)] };
}

let cached: TeamsConfig | null | undefined;

/**
 * This build's Teams config, or `null` when Teams is not part of it. The
 * values are inlined by the bundler; the build already validated them.
 */
export function teamsConfig(): TeamsConfig | null {
  if (cached === undefined) {
    const env = import.meta.env as Record<string, string | undefined> | undefined;
    try {
      cached = parseTeamsConfig({
        apiOrigin: env?.WXT_TEAMS_API_ORIGIN,
        googleClientId: env?.WXT_GOOGLE_CLIENT_ID,
      });
    } catch {
      cached = null;
    }
  }
  return cached;
}
