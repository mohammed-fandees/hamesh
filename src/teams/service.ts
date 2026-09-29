import type { TeamsConfig } from './config';
import type { SessionStore } from './session-store';
import type { TeamsApi } from './api';
import { authorizeWithGoogle, type GoogleAuthDeps } from './google-auth';
import { TeamsError, codeOf } from './errors';
import type { ResultFor, TeamsOp, TeamsReply, TeamsStatus } from './messages';
import type { TeamsOpName } from './operation-names';
import { operations, type ParamsOf } from './operations';

/**
 * What the background service worker does for Teams, independent of the
 * browser APIs it is wired to (see ./background.ts), so it can be tested as
 * plain code.
 */
export interface TeamsServiceDeps {
  config: TeamsConfig | null;
  sessions: SessionStore;
  api: TeamsApi | null;
  /** Whether the user has granted the Teams permissions right now. */
  hasPermissions: () => Promise<boolean>;
  /** Read at sign-in time: `identity` only exists once the permission is granted. */
  auth: () => Omit<GoogleAuthDeps, 'config'>;
}

export function createTeamsService(deps: TeamsServiceDeps) {
  let signingIn: Promise<TeamsReply> | null = null;

  async function status(): Promise<TeamsReply> {
    if (!deps.config || !deps.api) return { status: { state: 'unavailable' } };
    if (!(await deps.hasPermissions())) return { status: { state: 'permission_needed' } };
    if (!(await deps.sessions.get())) return { status: { state: 'signed_out' } };
    try {
      return { status: { state: 'signed_in', me: await deps.api.me() } };
    } catch (err) {
      // A 401 has already dropped the session; report whatever is true now.
      const now: TeamsStatus = (await deps.sessions.get())
        ? { state: 'signed_in', me: null }
        : { state: 'signed_out' };
      return { status: now, error: codeOf(err) };
    }
  }

  async function signIn(): Promise<TeamsReply> {
    const config = deps.config;
    const api = deps.api;
    if (!config || !api) return { status: { state: 'unavailable' }, error: 'not_configured' };
    if (!(await deps.hasPermissions())) {
      return { status: { state: 'permission_needed' }, error: 'permission_missing' };
    }
    try {
      const request = await authorizeWithGoogle({ ...deps.auth(), config });
      await api.signInWithGoogle(request);
    } catch (err) {
      return { ...(await status()), error: codeOf(err) };
    }
    return status();
  }

  async function signOut(): Promise<TeamsReply> {
    if (deps.api) await deps.api.signOut();
    else await deps.sessions.clear();
    return status();
  }

  /** One Google window at a time: a second click joins the first attempt. */
  function signInOnce(): Promise<TeamsReply> {
    signingIn ??= signIn().finally(() => {
      signingIn = null;
    });
    return signingIn;
  }

  /**
   * Performs one listed operation for a page. The params are checked against
   * that operation's own schema first: the worker holds the session, so it
   * sends the server only what the contract allows, whatever a page asked for.
   */
  async function perform<K extends TeamsOpName>(name: K, params: unknown): Promise<ResultFor<K>> {
    if (!deps.api) return { ok: false, error: 'not_configured' };
    if (!(await deps.hasPermissions())) return { ok: false, error: 'permission_missing' };
    const checked = operations()[name].params.safeParse(params);
    if (!checked.success) {
      return {
        ok: false,
        error: 'invalid_request',
        fields: checked.error.issues.map((i) => i.path.join('.')).filter(Boolean),
      };
    }
    try {
      return { ok: true, data: await deps.api.run(name, checked.data as ParamsOf<K>) };
    } catch (err) {
      const fields = err instanceof TeamsError ? err.fields : undefined;
      return { ok: false, error: codeOf(err), ...(fields ? { fields } : {}) };
    }
  }

  return {
    status,
    perform,
    signIn: signInOnce,
    signOut,
    /**
     * Some permission was removed. If Teams can no longer run, the user turned
     * it off: forget the session on this device too.
     */
    async permissionsRemoved(): Promise<void> {
      if (!(await deps.hasPermissions())) await deps.sessions.clear();
    },
    handle(op: TeamsOp): Promise<TeamsReply> {
      switch (op) {
        case 'status':
          return status();
        case 'signIn':
          return signInOnce();
        case 'signOut':
          return signOut();
      }
    },
  };
}

export type TeamsService = ReturnType<typeof createTeamsService>;
