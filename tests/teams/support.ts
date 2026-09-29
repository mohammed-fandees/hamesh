import { vi } from 'vitest';
import type { SessionStore, StoredSession } from '@/teams/session-store';
import { TeamsError } from '@/teams/errors';

export const CONFIG = {
  apiOrigin: 'https://api.example.com',
  googleClientId: 'cid.apps.googleusercontent.com',
};

export const ME = {
  user: { id: '01J0000000000000000000000A', email: 'a@example.com', displayName: 'A' },
  entitlement: { state: 'none', plan: null, until: null, limits: null, sources: [] },
  subscription: { state: 'none', canceled: false, pendingPayment: null },
  teams: [],
  serverTime: 1,
} as const;

export type MemorySessions = SessionStore & { current: StoredSession | null };

export function memorySessions(initial: StoredSession | null = null): MemorySessions {
  const s: MemorySessions = {
    current: initial,
    async get() {
      return s.current;
    },
    async set(v) {
      s.current = v;
    },
    async clear() {
      s.current = null;
    },
  };
  return s;
}

export const LIVE = { token: 'tok', expiresAt: 9e15 };

/** A fetch that answers every call with `status` and `body` (none for undefined). */
export function respond(status: number, body?: unknown) {
  return vi.fn(async (_url: string, _init?: RequestInit) =>
    body === undefined
      ? new Response(null, { status })
      : new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
  );
}

/** The `TeamsError` code a promise rejects with, or 'resolved'. */
export async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    return err instanceof TeamsError ? err.code : String(err);
  }
  return 'resolved';
}
