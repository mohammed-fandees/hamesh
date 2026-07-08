import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { browser } from 'wxt/browser';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { HameshMessage } from '@/messaging/types';
import { createNotesRepository } from '@/storage/notes-repository';
import { generatePageKey } from '@/domain/page-key';
import { HameshApp } from '@/content/HameshApp';
import { getStrings, resolveLang, dirForLang } from '@/ui/i18n';
import '@/ui/tokens.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const repo = createNotesRepository();
    const lang = resolveLang(browser.i18n?.getUILanguage?.());
    const strings = getStrings(lang);
    const dir = dirForLang(lang);

    // Exposed by the React app so the toolbar/shortcut can start selection mode.
    let activate: (() => void) | null = null;

    const ui = await createShadowRootUi<Root>(ctx, {
      name: 'hamesh-ui',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      // Max 32-bit z-index so the whole Hamesh layer out-ranks any host stacking
      // context. Internal ordering (marker < overlay < composer) is handled by
      // the z-index tokens within the shadow root.
      zIndex: 2147483647,
      isolateEvents: true,
      onMount(uiContainer) {
        // Host stacking (position + max z-index) is enforced by a `:host` rule
        // in tokens.css — it's injected after WXT's `:host{all:initial}` reset,
        // so it wins the cascade, which an outer inline style cannot.
        uiContainer.style.pointerEvents = 'none';
        const root = createRoot(uiContainer);
        root.render(
          createElement(HameshApp, {
            repo,
            lang,
            strings,
            dir,
            registerActivate: (fn: () => void) => {
              activate = fn;
            },
          }),
        );
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();

    // Deterministic activation hook for E2E automation. Dispatching a custom
    // DOM event is far more reliable in headless Chrome than simulating the
    // toolbar click or OS-level command. It only *starts selection mode* — the
    // same thing the toolbar does — so it grants no capability the user doesn't
    // already have, and carries no payload. Production activation remains the
    // toolbar icon and Alt+H shortcut.
    window.addEventListener('hamesh:activate', () => activate?.());

    browser.runtime.onMessage.addListener(
      (message: HameshMessage, _sender, sendResponse): boolean | undefined => {
        switch (message.type) {
          case 'ENABLE_SELECTION':
            activate?.();
            return undefined;
          case 'GET_PAGE_STATE': {
            const pageKey = generatePageKey(location.href);
            repo
              .getForPage(pageKey)
              .then((notes) => sendResponse({ type: 'PAGE_STATE', count: notes.length }))
              .catch(() => sendResponse({ type: 'PAGE_STATE', count: 0 }));
            return true; // async response
          }
          default:
            return undefined;
        }
      },
    );
  },
});
