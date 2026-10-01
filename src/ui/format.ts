import type { Lang } from './i18n';

/**
 * Every way Hamesh turns a value into words for the reader — a moment, a date,
 * an amount — in one place, in the reader's language.
 *
 * A moment arrives in two shapes: ISO strings from this device's notes, epoch
 * milliseconds from the Teams server. Both are accepted as they are, so no
 * caller converts one into the other first.
 */
export type Moment = string | number | Date;

const toTime = (when: Moment): number =>
  when instanceof Date ? when.getTime() : new Date(when).getTime();

/** An Arabic count of a unit, as it is said: "دقيقة", "دقيقتين", "3 دقائق", "11 دقيقة". */
function arabicCount(n: number, one: string, two: string, few: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${one}`;
}

/** Compact relative time — "just now", "5m ago", "منذ 3 ساعات". */
export function relativeTime(when: Moment, lang: Lang): string {
  const then = toTime(when);
  if (Number.isNaN(then)) return String(when);
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  const hr = Math.round(diffMs / 3600000);
  const day = Math.round(diffMs / 86400000);
  if (lang === 'ar') {
    if (min < 1) return 'الآن';
    if (min < 60) return `منذ ${arabicCount(min, 'دقيقة', 'دقيقتين', 'دقائق')}`;
    if (hr < 24) return `منذ ${arabicCount(hr, 'ساعة', 'ساعتين', 'ساعات')}`;
    return `منذ ${arabicCount(day, 'يوم', 'يومين', 'أيام')}`;
  }
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  return `${day}d ago`;
}

/** A plain date in the reader's language. */
export function formatDate(when: Moment, lang: Lang): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(toTime(when)));
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
