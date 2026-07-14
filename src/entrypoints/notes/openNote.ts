import { browser } from 'wxt/browser';
import type { HameshMessage } from '@/messaging/types';

/** How long to wait for the newly opened tab's content script to report
 *  CONTENT_READY before giving up and removing the listeners. This is a
 *  leak-prevention safety net, not the readiness signal itself — that's the
 *  CONTENT_READY message this function actually waits for below. It only
 *  ever matters for a page Hamesh can never run on (e.g. a `chrome://` URL)
 *  or a tab closed before it finishes loading. */
const RESTORE_HANDSHAKE_TIMEOUT_MS = 15000;

/**
 * Opens a note's original page in a new tab and, once that tab's content
 * script signals it's ready (`CONTENT_READY` — see `src/entrypoints/content.ts`),
 * asks it to restore the note: scroll to it, highlight it, open it.
 * Deterministic and event-driven — no polling, no fixed "the page has
 * probably loaded by now" delay. If the page never signals readiness (or
 * the tab is closed first), the listeners clean themselves up and the tab
 * is simply left open with no restore, rather than hanging forever.
 */
export async function openNoteAndRestore(originalUrl: string, noteId: string): Promise<void> {
  const tab = await browser.tabs.create({ url: originalUrl });
  if (tab.id == null) return;
  // Narrowed into its own binding: TypeScript doesn't carry a `const`
  // null-check's narrowing into nested closures across function boundaries.
  const tabId: number = tab.id;

  let timeoutId: ReturnType<typeof setTimeout>;
  let settled = false;

  const cleanup = () => {
    if (settled) return;
    settled = true;
    browser.runtime.onMessage.removeListener(onMessage);
    browser.tabs.onRemoved.removeListener(onRemoved);
    clearTimeout(timeoutId);
  };

  function onMessage(message: HameshMessage, sender: { tab?: { id?: number } }): undefined {
    if (message?.type !== 'CONTENT_READY' || sender.tab?.id !== tabId) return undefined;
    cleanup();
    browser.tabs.sendMessage(tabId, { type: 'RESTORE_NOTE', noteId }).catch(() => {});
    return undefined;
  }

  function onRemoved(removedTabId: number): void {
    if (removedTabId === tabId) cleanup();
  }

  browser.runtime.onMessage.addListener(onMessage);
  browser.tabs.onRemoved.addListener(onRemoved);
  timeoutId = setTimeout(cleanup, RESTORE_HANDSHAKE_TIMEOUT_MS);
}

/** True for an unmodified left-click — the case we intercept to drive the
 *  restore handshake via `openNoteAndRestore`. A modified click (ctrl/cmd,
 *  shift, middle-button) is left to the browser's native `target="_blank"`
 *  handling (open in background tab, new window, etc.) — those still work,
 *  they just don't get the scroll/highlight/reopen behavior. */
export function isPlainLeftClick(e: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
