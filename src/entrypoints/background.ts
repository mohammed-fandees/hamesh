import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';

/**
 * The background worker's only job: forward a keyboard command to the active
 * tab's content script. Two separate commands, two separate messages — no
 * hover/focus guessing about "is the user looking at a video" happens here
 * or in the content script's dispatch; that heuristic proved unreliable on
 * real sites (real players layer overlay UI that defeats DOM-based and even
 * coordinate-based hover checks in ways that are hard to fully account for).
 * A dedicated shortcut for video notes sidesteps the guess entirely: it
 * always targets whatever video the page's adapter currently considers
 * active, regardless of pointer position. All note storage lives in the
 * content script, which owns the page context.
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
});
