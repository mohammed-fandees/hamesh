# Release Package Audit

Audited the actual artifact a Chrome Web Store submission would upload — **not modified or repackaged**; this documents what `pnpm zip` produces today.

> **Refreshed 2026-08-01 for v1.2.1.** The previous version of this audit was against `v1.2.0`; every claim below was re-verified from scratch against the current build — a patch release with three bug fixes (keyboard shortcut delivery, the favicon "no favicon" fallback, and composer/video-note textarea autofocus) — rather than copied forward.

## Build & package commands run

```
pnpm build   →  .output/chrome-mv3/
pnpm zip     →  .output/hamesh-1.2.1-chrome.zip
```

Both completed successfully with no errors.

## Package identity

| Field             | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Artifact          | `hamesh-1.2.1-chrome.zip`                                          |
| Size              | 172.51 kB (zipped), 556.37 kB (unpacked)                           |
| SHA-256           | `84c4c46fe329a0174310fac0a6268dee4616fac53b9024b3cce0f6e92def7497` |
| Manifest version  | 3                                                                  |
| Extension version | 1.2.1 (matches `package.json`)                                     |

## Contents (complete list, 17 files)

```
background.js
manifest.json
notes.html
popup.html
assets/notes-Blv0M0GS.css
assets/popup-BoOrHY-h.css
assets/tokens-DqYgEPhP.css
content-scripts/content.css
content-scripts/content.js
chunks/notes-G9LyOdgY.js
chunks/popup-DlHK3yJY.js
chunks/tokens-CU7ETJo4.js
icon/128.png  icon/16.png  icon/32.png  icon/48.png  icon/96.png
```

Same file structure as the `v1.2.0` audit (hashes differ — every JS/CSS bundle changed since all three fixes touch shipped code — but no file was added or removed). `src/domain/shortcut.ts` (new) and the `GET_SHORTCUTS` message relay land inside `background.js`/`content-scripts/content.js`; the favicon and autofocus fixes land inside the existing `chunks/notes-*.js` bundle and `content-scripts/content.js` respectively. Every file is a build output (JS/CSS bundles, the manifest, the popup and notes page shells, icons). **Nothing else is present.**

## Checklist

| Check                                     | Result                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builds successfully                       | ✅ `pnpm build` exit 0                                                                                                                                                                                                                                                  |
| Manifest V3                               | ✅ `"manifest_version": 3`                                                                                                                                                                                                                                              |
| Version correct                           | ✅ `1.2.1`, matches `package.json`                                                                                                                                                                                                                                      |
| Permissions match audited manifest        | ⚠️ now `["storage", "activeTab", "favicon", "alarms"]` — `alarms` added this release, confirmed by `pnpm release:validate --tag=v1.2.1 --previous-ref=v1.2.0`; see `PERMISSION_JUSTIFICATIONS.md`'s `alarms` section for the full justification. No `host_permissions`. |
| Commands match audited manifest           | ✅ `activate-hamesh` (Alt+H) and `activate-hamesh-video` (Alt+V) — unchanged from `v1.2.0`; note both now also have a content-script `keydown` primary path, but that changes no manifest field                                                                         |
| Name correct                              | ✅ `Hamesh — هامش`                                                                                                                                                                                                                                                      |
| Description present and accurate          | ✅ matches actual local-only behavior                                                                                                                                                                                                                                   |
| Icons present at all declared sizes       | ✅ 16/32/48/96/128, all referenced in `manifest.icons`                                                                                                                                                                                                                  |
| No source maps                            | ✅ re-verified — `find .output/chrome-mv3 -name "*.map"` returns nothing                                                                                                                                                                                                |
| No tests included                         | ✅ re-verified — no `tests/`, `e2e/`, or `*.test.*` files in the zip listing                                                                                                                                                                                            |
| No docs included                          | ✅ re-verified — no `README`, `docs/`, or `*.md` files in the zip listing                                                                                                                                                                                               |
| No `.env` or secrets                      | ✅ re-verified — no env files in the zip listing; targeted secret-pattern scan (`sk-`, `AKIA`, `api_key`, `secret`) across all bundled JS found nothing                                                                                                                 |
| No development-only config                | ✅ re-verified — no `tsconfig`, `vite.config`, `eslint.config`, etc. in the zip listing                                                                                                                                                                                 |
| No localhost references                   | ✅ re-verified — grepped all bundled JS files (`background.js`, `content.js`, `chunks/popup-*.js`, `chunks/notes-*.js`, `chunks/tokens-*.js`) for `localhost`, zero matches                                                                                             |
| No debug logging exposes note contents    | ✅ see below — re-audited including the shortcut relay, favicon fetch, and autofocus code changed this release                                                                                                                                                          |
| No remote-code policy violation           | ✅ confirmed — see `PRIVACY_PRACTICES.md`'s "Remote code" section; no `<script src="http…">`, no remote `eval`/`import()`                                                                                                                                               |
| Package structure suitable for CWS upload | ✅ standard WXT/Vite MV3 output, flat root with `manifest.json` at top level                                                                                                                                                                                            |

### Debug/logging audit detail

Grepping all bundled scripts (`background.js`, `content.js`, `chunks/popup-*.js`, `chunks/notes-*.js`, `chunks/tokens-*.js`) for `console.warn`/`console.error`/`console.debug`/`console.log` found the exact same counts as the `v1.2.0` audit — no new logging was introduced by the shortcut relay, the favicon byte-comparison fetch, or the autofocus fix:

- `console.warn` (1, in `background.js`) — traced to **WXT's own framework code**, a generic diagnostic ("The background's main() function return a promise, but it must be synchronous"). Not Hamesh application code, references no user data.
- `console.error` calls (7 in `content.js`, 7 in the shared `tokens` chunk — the same underlying React-internals code duplicated across the two bundles, since `content.js` statically inlines what `notes.html` loads as a separate chunk) — traced to **React's own production bundle** (`unstable_forceFrameRate`, `checkDCE`, generic `uncaughtException`/error-boundary reporting) plus one `@wxt-dev/storage` migration-failure logger (`Migration failed for ${e}`, where `e` is a storage key name, not note content). None reference note content or user data.
- `console.debug` calls (3 in `content.js`, 3 in the shared `tokens` chunk, same duplication reason as above) — traced to `@wxt-dev/storage`'s internal migration logging, gated behind a `debug` option that **defaults to `false`** (confirmed in the bundled default). Hamesh's own storage code (`notes-repository.ts`, `preferences-repository.ts`, `folders-repository.ts`) calls `storage.getItem`/`setItem`/`watch` directly and never passes `debug: true` or uses `storage.defineItem()`'s migration API, so this code path is unreachable in Hamesh's actual usage.
- `chunks/notes-*.js` and `chunks/popup-*.js` themselves contain **zero** `console.*` calls — all logging traces to the shared `tokens` chunk (React/WXT internals) and `content.js`, not to any Hamesh-authored page code, including the new `GET_SHORTCUTS` relay, the rewritten `Favicon.tsx`, and `useFloating.ts`'s new focus effect.

**Conclusion: no code path in the shipped package logs note content, preference values, page content, or any user data to the console.**

## What changed since the v1.2.0 audit

- **Keyboard shortcut reliability fix** — `chrome.commands.onCommand` has a confirmed Chromium MV3 reliability gap (event delivery to the background service worker can silently fail). Shortcut handling now primarily lives in a `keydown` listener in the content script, which asks the background for the actual configured bindings via a new `GET_SHORTCUTS` runtime message (`chrome.commands` is not available in a content script's own execution context). Adds the `alarms` permission for a secondary keep-alive measure on the retained `commands.onCommand` fallback path — see `PERMISSION_JUSTIFICATIONS.md`.
- **Favicon "no favicon" fallback fix** — Chrome's `_favicon` endpoint returns its own generic placeholder image (HTTP 200, not an error) when it has no cached favicon; `Favicon.tsx` now detects this by byte-comparing against a live probe and shows a globe icon instead. Still the same `_favicon` endpoint, zero network requests.
- **Composer/video quick-note autofocus fix** — both textareas now actually receive focus on open (`src/content/useFloating.ts`); purely an interaction fix, no storage or permission changes.
- Package file count and console-logging profile are **unchanged** from `v1.2.0` (every bundle's hash differs, since all three fixes touch shipped code, but no file was added or removed) — confirmed above, not assumed. The permission set **did** change (`alarms` added) — see the Permissions row above and `pnpm release:validate` output.

## Not modified

Per this task's restriction, the release artifact above was **audited only** — nothing was changed, repackaged, or re-uploaded. The `activeTab` permission recommendation from earlier audits remains open and untouched this cycle — see `PERMISSION_JUSTIFICATIONS.md`'s `activeTab` section; do not re-attempt its removal without first identifying the actual dependency documented there. If it is ever removed, this checklist (manifest snapshot, SHA-256, and package contents) must be regenerated against the new build before submission.
