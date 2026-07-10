import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'Hamesh — هامش',
    version: '0.2.0',
    description:
      'Leave a note exactly where it belongs on a web page, and find it there when you return. Local-only.',
    // storage: persist notes via chrome.storage.local (no network, no sync).
    // activeTab: reach the current tab's content script only when the user
    //   invokes Hamesh (toolbar icon or shortcut) — no broad tabs access.
    permissions: ['storage', 'activeTab'],
    action: {
      default_title: 'Hamesh — add a note (Alt+H)',
    },
    commands: {
      'activate-hamesh': {
        suggested_key: { default: 'Alt+H' },
        description: 'Add a note with Hamesh',
      },
    },
  },
});
