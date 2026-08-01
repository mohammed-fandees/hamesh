import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'Hamesh — هامش',
    version: '1.2.1',
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
    // alarms: a periodic no-op heartbeat in the background service worker
    //   (see background.ts) — works around a well-documented Chromium bug
    //   where a dormant MV3 service worker doesn't reliably wake back up for
    //   an incoming chrome.commands.onCommand event, silently dropping the
    //   Alt+H/Alt+V keyboard shortcut. No user data involved.
    permissions: ['storage', 'activeTab', 'favicon', 'alarms'],
    action: {
      default_title: 'Hamesh — add a note (Alt+H)',
    },
    commands: {
      'activate-hamesh': {
        suggested_key: { default: 'Alt+H' },
        description: 'Add a note with Hamesh',
      },
      'activate-hamesh-video': {
        suggested_key: { default: 'Alt+V' },
        description: 'Add a video note with Hamesh',
      },
    },
  },
});
