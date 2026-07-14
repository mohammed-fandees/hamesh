import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'Hamesh — هامش',
    version: '1.0.0',
    description:
      'Leave a note exactly where it belongs on a web page, and find it there when you return. Local-only.',
    // storage: persist notes via chrome.storage.local (no network, no sync).
    // activeTab: reach the current tab's content script only when the user
    //   invokes Hamesh (toolbar icon or shortcut) — no broad tabs access.
    // favicon: read a site's favicon from Chrome's own local favicon cache
    //   (chrome-extension://<id>/_favicon/?pageUrl=...) for the Notes Library
    //   page — required by Chrome as of the current Favicon API docs
    //   (https://developer.chrome.com/docs/extensions/how-to/ui/favicons).
    //   No network request Hamesh makes itself; used only from the extension's
    //   own notes.html page, never a content script, so no additional
    //   web_accessible_resources entry is needed.
    permissions: ['storage', 'activeTab', 'favicon'],
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
