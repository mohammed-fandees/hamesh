import { browser } from 'wxt/browser';
import type { UsageEvent } from '@/domain/usage';

/** The message a page or the content script sends for one use of a feature. */
export interface UsageCountMessage {
  type: 'USAGE_COUNT';
  event: UsageEvent;
}

/**
 * One use of `event`, told to the background, which counts it only if the
 * reader turned sharing on. Fire and forget: counting never holds anything up,
 * and a build without a server to send to drops the call entirely.
 */
export function countUse(event: UsageEvent): void {
  if (!import.meta.env.WXT_TEAMS_API_ORIGIN) return;
  const message: UsageCountMessage = { type: 'USAGE_COUNT', event };
  // Counting must never get in the way of what was counted: a worker that is
  // waking, or a browser without one, simply loses this one.
  try {
    void Promise.resolve(browser.runtime.sendMessage(message)).catch(() => {});
  } catch {
    /* nothing to count with */
  }
}
