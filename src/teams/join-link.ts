/**
 * Hamesh's join page, where an invitation link lands:
 * `https://hamesh.fandees.tech/join#<token>`.
 *
 * Zod-free and contract-free: the content script, which ships in every build,
 * reads it to recognise that one page and nothing else, and the worker uses the
 * same check against the URL the browser reports for the sender.
 */

const JOIN_ORIGIN = 'https://hamesh.fandees.tech';
const JOIN_PATHS = new Set(['/join', '/join.html']);
const TOKEN = /^#([A-Za-z0-9_-]{43})$/;

/** Whether `url` is the join page itself: this origin and path exactly. */
export function isJoinPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === JOIN_ORIGIN && JOIN_PATHS.has(parsed.pathname);
  } catch {
    return false;
  }
}

/** The invitation token, if the fragment is one and nothing else. */
export function joinTokenFrom(hash: string): string | null {
  return TOKEN.exec(hash)?.[1] ?? null;
}
