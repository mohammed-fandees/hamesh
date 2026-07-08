import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';

/**
 * The background worker's only job: forward the keyboard command to the active
 * tab's content script to start selection mode. All note storage lives in the
 * content script, which owns the page context.
 */
export default defineBackground(() => {
  browser.commands?.onCommand.addListener(async (command) => {
    if (command !== 'activate-hamesh') return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) {
      try {
        await browser.tabs.sendMessage(tab.id, { type: 'ENABLE_SELECTION' });
      } catch {
        /* content script not present on this page (e.g. chrome:// URLs) */
      }
    }
  });
});
