import type { z } from 'zod';
import { MeResponse, SessionResponse, type GoogleSignInRequest } from '@hamesh/teams-contract';
import type { TeamsConfig } from './config';
import type { SessionStore } from './session-store';
import { TeamsError, errorFromBody } from './errors';

/**
 * The Teams API client. Runs only in the background service worker, the one
 * place the session token is read.
 *
 * Every answer is checked against the public contract before anything uses
 * it; an answer that doesn't match is a `bad_response`, never partially
 * trusted. A 401 means the server no longer honours this session, so it is
 * forgotten here at once.
 */
export interface TeamsApiDeps {
  config: TeamsConfig;
  sessions: SessionStore;
  /** Always called with a full URL string; injectable for tests. */
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  timeoutMs?: number;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface CallOptions<S extends z.ZodType | null> {
  body?: unknown;
  /** The expected success body; `null` for 204 No Content. */
  schema: S;
  /** `false` only for the sign-in exchange itself. */
  auth?: boolean;
}

export function createTeamsApi(deps: TeamsApiDeps) {
  const doFetch = deps.fetch ?? ((url: string, init: RequestInit) => fetch(url, init));
  const timeoutMs = deps.timeoutMs ?? 15_000;

  async function call<S extends z.ZodType | null>(
    method: Method,
    path: string,
    opts: CallOptions<S>,
  ): Promise<S extends z.ZodType ? z.infer<S> : undefined> {
    if (!path.startsWith('/v1/') || path.includes('..')) {
      throw new Error(`not an API path: ${path}`);
    }
    const headers: Record<string, string> = { accept: 'application/json' };
    if (opts.auth !== false) {
      const session = await deps.sessions.get();
      if (!session) throw new TeamsError('signed_out');
      headers.authorization = `Bearer ${session.token}`;
    }
    if (opts.body !== undefined) headers['content-type'] = 'application/json';

    let res: Response;
    try {
      res = await doFetch(`${deps.config.apiOrigin}${path}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        // No cookies, no cache, and never follow a redirect: the token is
        // only ever sent to the configured origin.
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new TeamsError('network');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      if (res.status === 401 && opts.auth !== false) await deps.sessions.clear();
      throw errorFromBody(body);
    }

    if (opts.schema === null) {
      return undefined as S extends z.ZodType ? z.infer<S> : undefined;
    }
    const json = await res.json().catch(() => {
      throw new TeamsError('bad_response');
    });
    const parsed = opts.schema.safeParse(json);
    if (!parsed.success) throw new TeamsError('bad_response');
    return parsed.data as S extends z.ZodType ? z.infer<S> : undefined;
  }

  return {
    call,
    /** Exchanges a Google authorization code for a session, and keeps it. */
    async signInWithGoogle(request: GoogleSignInRequest): Promise<void> {
      const session = await call('POST', '/v1/auth/google', {
        body: request,
        schema: SessionResponse,
        auth: false,
      });
      await deps.sessions.set({ token: session.token, expiresAt: session.expiresAt });
    },
    /**
     * Ends the session on the server, then forgets it here. The local copy is
     * forgotten even if the server can't be reached: signing out on this
     * device must always work.
     */
    async signOut(): Promise<void> {
      try {
        await call('POST', '/v1/auth/signout', { schema: null });
      } catch {
        /* best effort; the local session goes regardless */
      } finally {
        await deps.sessions.clear();
      }
    },
    me(): Promise<MeResponse> {
      return call('GET', '/v1/me', { schema: MeResponse });
    },
  };
}

export type TeamsApi = ReturnType<typeof createTeamsApi>;
