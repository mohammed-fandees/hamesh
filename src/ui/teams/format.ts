import type { Lang } from '../i18n';

/** A server timestamp (ms) as a plain date in the reader's language. */
export function formatDate(ms: number, lang: Lang): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(ms));
}

/**
 * A price, from the minor units and currency the server sent — never a
 * currency or an amount written into the extension.
 */
export function formatMoney(amountMinor: number, currency: string, lang: Lang): string {
  try {
    return new Intl.NumberFormat(lang, { style: 'currency', currency }).format(amountMinor / 100);
  } catch {
    // An unknown currency code must not take the page down with it.
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

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
