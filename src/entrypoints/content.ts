import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { browser } from 'wxt/browser';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { HameshMessage } from '@/messaging/types';
import { createNotesRepository } from '@/storage/notes-repository';
import { createPreferencesRepository } from '@/storage/preferences-repository';
import { generatePageKey } from '@/domain/page-key';
import { HameshApp } from '@/content/HameshApp';
import { resolveLang } from '@/ui/i18n';
import '@/ui/tokens.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const repo = createNotesRepository();
    const prefsRepo = createPreferencesRepository();
    // Resolved once, synchronously, from the browser's UI language — the
    // initial paint before the (async) stored preference loads, and exactly
    // today's behavior for users who never open Settings. HameshApp takes it
    // from here and stays subscribed to preference changes.
    const initialLang = resolveLang(browser.i18n?.getUILanguage?.());

    // Exposed by the React app so the toolbar/shortcut can start selection mode,
    // and so the Notes Library's "open note" flow can restore a specific note
    // once this tab is ready (see registerRestoreNote below).
    let activate: (() => void) | null = null;
    let restoreNote: ((noteId: string) => void) | null = null;

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
            prefsRepo,
            initialLang,
            registerActivate: (fn: () => void) => {
              activate = fn;
              // Signals that the activation hook below is now wired up. React
              // mounts and wires `activate` via a `useEffect`, which fires a
              // tick after the shadow root attaches — dispatching
              // `hamesh:activate` before this point is silently dropped.
              // `dispatchEvent` crosses the content-script isolated-world
              // boundary for listeners (unlike a plain property assignment,
              // which would only be visible inside this isolated world).
              window.dispatchEvent(new CustomEvent('hamesh:ready'));
              // Same milestone, broadcast as a runtime message instead of a DOM
              // event: the Notes Library's "open note" flow (a different
              // extension context, in a different tab, with no access to this
              // page's `window`) listens for this to know precisely when it's
              // safe to send `RESTORE_NOTE` — no polling or fixed delay. If
              // nothing is listening (the overwhelmingly common case — a
              // normal page load with no pending open-note request), Chrome
              // rejects with "Could not establish connection", which is
              // expected and harmless here.
              browser.runtime.sendMessage({ type: 'CONTENT_READY' }).catch(() => {});
            },
            registerRestoreNote: (fn: (noteId: string) => void) => {
              restoreNote = fn;
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
          case 'RESTORE_NOTE':
            restoreNote?.(message.noteId);
            return undefined;
          default:
            return undefined;
        }
      },
    );
  },
});
