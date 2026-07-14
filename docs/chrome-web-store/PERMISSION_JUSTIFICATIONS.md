# Permission Justifications

Audited against the actual **generated production manifest** (`pnpm build` → `.output/chrome-mv3/manifest.json`, version 0.2.0), not just `wxt.config.ts`. Every declared permission and host-access surface is listed below with its exact code usage. Nothing is assumed.

> **Refreshed 2026-07-14 for the Notes Library (PR1).** `favicon` was added — the first new permission since v0.1.0. All other entries are unchanged from the v0.2.0 audit.

## Generated manifest (verbatim, permission-relevant excerpt)

```json
{
  "permissions": ["storage", "activeTab", "favicon"],
  "content_scripts": [
    { "matches": ["<all_urls>"], "run_at": "document_idle", "js": ["content-scripts/content.js"] }
  ],
  "web_accessible_resources": [
    {
      "resources": ["content-scripts/content.css"],
      "use_dynamic_url": true,
      "matches": ["<all_urls>"]
    }
  ]
}
```

No `host_permissions`, no `optional_permissions`, no `externally_connectable`, no custom `content_security_policy`, no `declarativeNetRequest`.

---

## `storage`

- **Declared:** `wxt.config.ts` → `manifest.permissions`.
- **Used at:** `src/storage/notes-repository.ts` — every method (`getForPage`, `create`, `update`, `delete`, `getAll`) calls WXT's `storage.getItem`/`setItem`/`snapshot` against the `local:` area only. **New in v0.2.0:** `src/storage/preferences-repository.ts` also uses `storage.getItem`/`setItem`/`watch` (same `local:` area, a separate key `local:hamesh:preferences`) to persist the Settings screen's language and appearance choices. No other file touches `chrome.storage`.
- **Why required:** This is the extension's entire persistence layer — both user notes and UI preferences. Without it, neither notes nor Settings choices could survive a page reload or browser restart.
- **Narrower alternative considered:** None exists; `storage` is already Chrome's narrowest storage permission (as opposed to requesting `unlimitedStorage`, which is _not_ requested).
- **Reviewer-facing justification (final text):**
  > Hamesh saves user-created notes and Settings preferences (language, appearance) locally using `chrome.storage.local` so they persist across page reloads and browser restarts. This is the only persistence mechanism in the extension.

## `activeTab`

- **Declared:** `wxt.config.ts` → `manifest.permissions`.
- **Used at:** _(finding — see below)_. `browser.tabs.query({ active: true, currentWindow: true })` in `src/entrypoints/background.ts` and `src/entrypoints/popup/App.tsx`, followed by `browser.tabs.sendMessage(tab.id, …)`.
- **Audit finding:** `tabs.query({ active, currentWindow })` returns tab `id`/`index`/etc. without any permission; only the tab's **`url`** field is gated. Grepping `src/entrypoints/background.ts` and `src/entrypoints/popup/` confirms **`tab.url` is never read** — only `tab.id` is used, to address `tabs.sendMessage`. The content script is _already_ persistently injected on `<all_urls>` via `content_scripts.matches`, so `activeTab` grants no additional script-injection capability the extension doesn't already have.
- **Conclusion: `activeTab` appears to be an unused permission in the current implementation.** It was likely carried over from an earlier design where the popup injected a script on demand (`scripting.executeScript`) instead of messaging an always-on content script. **Re-checked for v0.2.0** (the Settings screen didn't change this code path — `src/entrypoints/background.ts` and `src/entrypoints/popup/App.tsx` still only read `tab.id`, never `tab.url`): the finding is unchanged.
- **Recommendation (not applied — see restriction below):** Remove `activeTab` from `wxt.config.ts` in a follow-up PR and re-verify `pnpm build` + `pnpm test:e2e` still pass. This is a genuine permission-surface reduction that Chrome Web Store reviewers favor, and it removes a justification field reviewers might otherwise question. **Still open as of v0.2.0** — this recommendation was made during the v0.1.0 audit and has not been acted on across two releases since.
- **Per this task's scope, no code was changed** — permission architecture changes belong in a reviewed product PR, not a store-submission-prep pass, and doing so silently while writing store copy risks describing a manifest that doesn't match what's actually shipped. The justification text below covers the _current_ v0.2.0 manifest so the submission is accurate as of the artifact being uploaded.
- **Reviewer-facing justification (final text, matches current v0.2.0 build):**
  > Hamesh's background service worker and popup query the currently active tab (by id only, no URL access) to relay a "start note" message to that tab's content script when the user clicks the toolbar icon, opens the popup, or presses the keyboard shortcut. No page content or tab URL is read via this permission.
- **If the owner removes `activeTab` before submission:** update this file, `wxt.config.ts`, `PRIVACY.md`, and re-run `pnpm build`/`pnpm zip` before uploading, and update `RELEASE_CHECKLIST.md`'s manifest snapshot.

## `favicon`

- **Declared:** `wxt.config.ts` → `manifest.permissions`.
- **Used at:** `src/ui/Favicon.tsx`, from the Notes Library extension page only (`src/entrypoints/notes/`) — never from the content script. Renders `chrome-extension://<id>/_favicon/?pageUrl=<url>&size=32`.
- **Why required:** The Notes Library groups notes by website and shows each group's favicon. Chrome's `_favicon` API reads favicons already cached locally by the browser — it makes no network request of its own and exposes no data beyond what Chrome already fetched while the user was browsing. Per Chrome's current Favicon API docs (https://developer.chrome.com/docs/extensions/how-to/ui/favicons), the `"favicon"` permission is required to use this API; there is no way to request it more narrowly.
- **Narrower alternative considered:** A third-party favicon service (e.g. a `google.com/s2/favicons` request) would need no manifest permission at all but would send every domain a user has notes on to an external server — a direct violation of Hamesh's "no network requests of any kind" privacy commitment (see `PRIVACY.md`). Chrome's local favicon cache was chosen specifically to avoid that. A generated monogram (initial + deterministic color) is used as the fallback when no cached favicon exists, so the feature degrades gracefully without ever making a request.
- **Scope note:** Only used from the extension's own `notes.html` page, so — per the same Chrome docs — no `web_accessible_resources` entry for `_favicon/*` is needed (that's only required when fetching favicons from a content script).
- **Reviewer-facing justification (final text):**
  > The Notes Library page shows a favicon next to each website a user has notes on, read from Chrome's own local favicon cache via `chrome-extension://<id>/_favicon/`. This makes no network request and exposes no data beyond what Chrome has already cached while the user browsed; the `favicon` permission is required by Chrome to use this API. When no cached favicon exists, a generated monogram is shown instead.

## Content script host access — `matches: ["<all_urls>"]`

This is not a `permissions` entry but is the broadest access surface in the manifest and CWS reviewers scrutinize it identically to a host permission.

- **Used at:** `src/entrypoints/content.ts` (`defineContentScript({ matches: ['<all_urls>'], runAt: 'document_idle', … })`).
- **Why required:** Hamesh's core promise is "attach a note to _any_ page you visit, find it when you return." The user chooses which element on which page to annotate — the extension does not know in advance which pages will matter to a given user, so it cannot use a narrower static match list.
- **What the content script actually does on every page (verified in code):**
  1. On load, computes a normalized page key (`src/domain/page-key.ts`) and fetches only _this extension's own_ stored notes for that key from `chrome.storage.local` — no page content is sent anywhere.
  2. Mounts one inert, invisible (`pointer-events: none`) React tree in a Shadow DOM root. It does nothing further unless the user explicitly activates selection mode (toolbar/shortcut) or clicks a previously-placed marker.
  3. Only after the user clicks an element in selection mode does it read that one element's attributes/text (`src/domain/anchor.ts`) to build an anchor — never full-page content, never other elements, never form/password field values (verified: no `.value` reads outside `anchor.ts`'s attribute enumeration, which never touches `<input>` value properties).
- **Narrower alternative considered:** A "click-to-inject" model (`activeTab` + on-demand `scripting.executeScript`, no persistent content script) was considered but rejected: it cannot restore markers automatically when a user simply navigates to a page — the user would have to manually re-invoke Hamesh on every page to see if a note exists there, defeating the "find it when you return" promise. This is a legitimate product-driven reason recorded here for reviewer context.
- **Reviewer-facing justification (final text):**
  > The content script must run on all pages because the user decides, per page and per element, where to place a note, and expects previously-saved notes to reappear automatically on return visits without re-activating the extension. The script is inert until the user explicitly interacts with it; it does not read, store, or transmit page content beyond the specific element the user selects, and it makes no network requests.

## `web_accessible_resources` (content-scripts/content.css, `matches: <all_urls>`, `use_dynamic_url: true`)

- **Why present:** WXT's `cssInjectionMode: 'ui'` (set in `src/entrypoints/content.ts`) ships the Shadow-DOM stylesheet as a web-accessible resource so it can be fetched into the shadow root without leaking into the host page's own stylesheets. `use_dynamic_url: true` is WXT's default hardening — it randomizes the resource URL per browser session so host pages cannot fingerprint the extension by probing for a static resource path.
- **Data exposed:** A static CSS file (design tokens/component styles) with no user data, no dynamic content, and no note contents.
- **Reviewer-facing justification (final text):**
  > A single CSS file (visual styling only, no user data) is declared web-accessible so it can be loaded into the extension's isolated Shadow DOM UI, per the standard pattern for the WXT extension framework. Its URL is randomized per session and it contains no user or page data.

## Permissions **not** requested (confirms least-privilege posture)

`tabs`, `scripting`, `webRequest`, `webNavigation`, `cookies`, `history`, `bookmarks`, `downloads`, `identity`, `notifications`, `clipboardRead/Write`, `geolocation`, `unlimitedStorage`, any `host_permissions` beyond the content-script match, and any `optional_permissions` — none appear in the manifest and none are used in code.

## Summary table for the dashboard

| Permission                                  | Keep as-is for next submission   | Justification field text                       |
| ------------------------------------------- | -------------------------------- | ---------------------------------------------- |
| `storage`                                   | Yes                              | See "storage" section above                    |
| `activeTab`                                 | Yes (flagged for future removal) | See "activeTab" section above                  |
| `favicon`                                   | Yes (new, Notes Library)         | See "favicon" section above                    |
| Host access via content script `<all_urls>` | Yes                              | See "Content script host access" section above |
