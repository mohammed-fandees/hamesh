import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import type { HameshMessage, ShortcutsResponse } from '@/messaging/types';

/** Secondary keep-alive for the `commands.onCommand` path below. Chrome tears
 *  down an idle MV3 service worker ~30s after its last event or API call
 *  (https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle),
 *  and a dormant worker isn't reliably woken by an incoming onCommand event —
 *  a periodic no-op alarm resets the idle timer so the worker stays warm more
 *  often. This narrows, but does not close, the gap; see the primary path in
 *  content.ts for why `onCommand` is not relied on alone. */
const KEEP_ALIVE_ALARM = 'hamesh-keep-alive';

/**
 * Forwards a keyboard command to the active tab's content script. This is a
 * *secondary* path for the Alt+H / Alt+V shortcuts — the primary path is a
 * `keydown` listener directly in the content script (content.ts), added
 * after direct testing showed `chrome.commands.onCommand` can fail to fire
 * at all in real usage (confirmed correctly registered via
 * `chrome.commands.getAll()`, yet never delivered), a known, still-open
 * Chromium MV3 service-worker reliability gap. This listener is kept as a
 * fallback for contexts where no content script runs (e.g. chrome:// pages),
 * and costs nothing to leave in place.
 *
 * Two separate commands, two separate messages — no hover/focus guessing
 * about "is the user looking at a video" happens here or in the content
 * script's dispatch; that heuristic proved unreliable on real sites (real
 * players layer overlay UI that defeats DOM-based and even coordinate-based
 * hover checks in ways that are hard to fully account for). A dedicated
 * shortcut for video notes sidesteps the guess entirely: it always targets
 * whatever video the page's adapter currently considers active, regardless
 * of pointer position. All note storage lives in the content script, which
 * owns the page context.
 */
export default defineBackground(() => {
  browser.commands?.onCommand.addListener(async (command) => {
    if (command !== 'activate-hamesh' && command !== 'activate-hamesh-video') return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) {
      try {
        await browser.tabs.sendMessage(tab.id, {
          type: command === 'activate-hamesh-video' ? 'ENABLE_VIDEO_NOTE' : 'ENABLE_SELECTION',
        });
      } catch {
        /* content script not present on this page (e.g. chrome:// URLs) */
      }
    }
  });

  // `chrome.commands` is not available in a content script's execution
  // context (Chrome restricts it to background/extension pages), so the
  // content script's `keydown` listener can't call `commands.getAll()`
  // itself to learn the user's actual configured bindings — it asks the
  // background here instead, which does have access to the API.
  browser.runtime.onMessage.addListener(
    (message: HameshMessage, _sender, sendResponse): boolean | undefined => {
      if (message.type !== 'GET_SHORTCUTS') return undefined;
      browser.commands
        ?.getAll()
        .then((commands) => {
          const response: ShortcutsResponse = {
            type: 'SHORTCUTS',
            addNote: commands.find((c) => c.name === 'activate-hamesh')?.shortcut || null,
            addVideoNote:
              commands.find((c) => c.name === 'activate-hamesh-video')?.shortcut || null,
          };
          sendResponse(response);
        })
        .catch(() => sendResponse({ type: 'SHORTCUTS', addNote: null, addVideoNote: null }));
      return true; // async response
    },
  );

  // See KEEP_ALIVE_ALARM above. `create` with an existing name just resets
  // that alarm's schedule, so re-registering on every service-worker
  // (re)start (including the very first) is idempotent — no duplicate-alarm
  // risk. The listener itself does nothing; merely handling the alarm event
  // is what resets the idle timer.
  browser.alarms?.create(KEEP_ALIVE_ALARM, { periodInMinutes: 0.5 });
  browser.alarms?.onAlarm.addListener((alarm) => {
    if (alarm.name !== KEEP_ALIVE_ALARM) return;
  });
});
