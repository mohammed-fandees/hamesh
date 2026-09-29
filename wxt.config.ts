import { defineConfig } from 'wxt';
import { hostPermissionFor, parseTeamsConfig } from './src/teams/config';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'Hamesh — هامش',
    version: '1.4.0',
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
      'activate-hamesh-text': {
        suggested_key: { default: 'Alt+T' },
        description: 'Add a note to the selected text',
      },
    },
  },
  hooks: {
    /**
     * Optional Teams. Only a build given WXT_TEAMS_API_ORIGIN and
     * WXT_GOOGLE_CLIENT_ID (see docs/teams-client.md) gets these, and both are
     * *optional* permissions: nothing is granted at install, and Hamesh asks
     * only when the user turns Teams on in Settings.
     *   identity: the "Sign in with Google" window (launchWebAuthFlow).
     *   the API origin: the one server Teams talks to, and no other.
     * Done here rather than in `manifest` above because WXT reads the .env
     * files after this file is evaluated; the `manifest` literal stays static
     * so release tooling can read it without running it.
     */
    'build:manifestGenerated': (wxt, manifest) => {
      const teams = parseTeamsConfig({
        apiOrigin: process.env.WXT_TEAMS_API_ORIGIN,
        googleClientId: process.env.WXT_GOOGLE_CLIENT_ID,
      });
      if (!teams) return;
      const optional = new Set(manifest.optional_permissions ?? []);
      optional.add('identity');
      if (wxt.config.manifestVersion === 2) {
        // MV2 has no optional_host_permissions: origins go in the same list.
        optional.add(hostPermissionFor(teams));
      } else {
        manifest.optional_host_permissions = [hostPermissionFor(teams)];
      }
      manifest.optional_permissions = [...optional] as typeof manifest.optional_permissions;
      manifest.description =
        'Leave a note exactly where it belongs on a web page, and find it there when you return. Share with your team, optionally.';
    },
  },
});
