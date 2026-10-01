/**
 * The token out of an invite link. The token sits in the fragment, so this
 * accepts the whole link, or just the token pasted on its own.
 */
export function inviteTokenFrom(pasted: string): string | null {
  const text = pasted.trim();
  if (!text) return null;
  const token = text.includes('#') ? text.slice(text.lastIndexOf('#') + 1) : text;
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
