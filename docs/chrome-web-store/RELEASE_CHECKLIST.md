# Release Package Audit

Audited the actual artifact a Chrome Web Store submission would upload — **not modified or repackaged**; this documents what `pnpm zip` produces today.

> **Refreshed 2026-08-01 for v1.1.0.** The previous version of this audit was against `v1.0.0`; every claim below was re-verified from scratch against the current build (which now includes Video Notes, Folders, and the Settings/Shortcuts page) rather than copied forward.

## Build & package commands run

```
pnpm build   →  .output/chrome-mv3/
pnpm zip     →  .output/hamesh-1.1.0-chrome.zip
```

Both completed successfully with no errors.

## Package identity

| Field             | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Artifact          | `hamesh-1.1.0-chrome.zip`                                          |
| Size              | 170.31 kB (zipped), 547.27 kB (unpacked)                           |
| SHA-256           | `2340fe8a50bf50877c00f57d7ae13462c41fd080457cd288bbc8abfb297f71ac` |
| Manifest version  | 3                                                                  |
| Extension version | 1.1.0 (matches `package.json`)                                     |

## Contents (complete list, 21 entries)

```
background.js
manifest.json
notes.html
popup.html
assets/notes-DvUxhqfu.css
assets/popup-BoOrHY-h.css
assets/tokens-DqYgEPhP.css
content-scripts/content.css
content-scripts/content.js
chunks/notes-CHaj49Ud.js
chunks/popup-IdiJ09nO.js
chunks/tokens-CuovRE5R.js
icon/128.png  icon/16.png  icon/32.png  icon/48.png  icon/96.png
```

Same 21 entries as the `v1.0.0` audit — Video Notes, Folders, and the Settings/Shortcuts page all landed inside the existing `content-scripts/content.js` and `chunks/notes-*.js` bundles (both grew: `content.js` now includes the video-adapter/quick-note/marker code, `chunks/notes-*.js` now includes the Sidebar, LibrarySettingsView, FolderTree, and MoveToFolderMenu components), not as new top-level files. Every file is a build output (JS/CSS bundles, the manifest, the popup and notes page shells, icons). **Nothing else is present.**

## Checklist

| Check                                     | Result                                                                                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builds successfully                       | ✅ `pnpm build` exit 0                                                                                                                                                                          |
| Manifest V3                               | ✅ `"manifest_version": 3`                                                                                                                                                                      |
| Version correct                           | ✅ `1.1.0`, matches `package.json`                                                                                                                                                              |
| Permissions match audited manifest        | ✅ still exactly `["storage", "activeTab", "favicon"]`, no `host_permissions` — unchanged since `v1.0.0`, confirmed by diff, not assumed. See `PERMISSION_JUSTIFICATIONS.md`'s `v1.1.0` refresh |
| Commands match audited manifest           | ✅ `activate-hamesh` (Alt+H) and a new `activate-hamesh-video` (Alt+V) — both are `commands`, not a permission, and change nothing else in this checklist                                       |
| Name correct                              | ✅ `Hamesh — هامش`                                                                                                                                                                              |
| Description present and accurate          | ✅ matches actual local-only behavior                                                                                                                                                           |
| Icons present at all declared sizes       | ✅ 16/32/48/96/128, all referenced in `manifest.icons`                                                                                                                                          |
| No source maps                            | ✅ re-verified — `find .output/chrome-mv3 -name "*.map"` returns nothing                                                                                                                        |
| No tests included                         | ✅ re-verified — no `tests/`, `e2e/`, or `*.test.*` files in the zip listing                                                                                                                    |
| No docs included                          | ✅ re-verified — no `README`, `docs/`, or `*.md` files in the zip listing                                                                                                                       |
| No `.env` or secrets                      | ✅ re-verified — no env files in the zip listing; targeted secret-pattern scan (`sk-`, `AKIA`, `api_key`, `secret`) across all bundled JS found nothing                                         |
| No development-only config                | ✅ re-verified — no `tsconfig`, `vite.config`, `eslint.config`, etc. in the zip listing                                                                                                         |
| No localhost references                   | ✅ re-verified — grepped all bundled JS files (`background.js`, `content.js`, `chunks/popup-*.js`, `chunks/notes-*.js`, `chunks/tokens-*.js`) for `localhost`, zero matches                     |
| No debug logging exposes note contents    | ✅ see below — re-audited including the video-notes and folders code now inside `content.js`/`chunks/notes-*.js`                                                                                |
| No remote-code policy violation           | ✅ confirmed — see `PRIVACY_PRACTICES.md`'s "Remote code" section; no `<script src="http…">`, no remote `eval`/`import()`                                                                       |
| Package structure suitable for CWS upload | ✅ standard WXT/Vite MV3 output, flat root with `manifest.json` at top level                                                                                                                    |

### Debug/logging audit detail

Grepping all bundled scripts (`background.js`, `content.js`, `chunks/popup-*.js`, `chunks/notes-*.js`, `chunks/tokens-*.js`) for `console.` found the exact same counts as the `v1.0.0` audit — no new logging was introduced by Video Notes, Folders, or the Settings/Shortcuts work:

- `console.warn` (1, in `background.js`) — traced to **WXT's own framework code**, a generic diagnostic ("The background's main() function return a promise, but it must be synchronous"). Not Hamesh application code, references no user data.
- `console.error` calls (7, in `content.js` and the shared `tokens` chunk) — traced to **React's own production bundle** (`unstable_forceFrameRate`, `checkDCE`, generic `uncaughtException`/error-boundary reporting) plus one `@wxt-dev/storage` migration-failure logger (`Migration failed for ${e}`, where `e` is a storage key name, not note content). None reference note content or user data.
- `console.debug` calls (3, in `content.js` and the shared `tokens` chunk) — traced to `@wxt-dev/storage`'s internal migration logging, gated behind a `debug` option that **defaults to `false`** (confirmed in the bundled default). Hamesh's own storage code (`notes-repository.ts`, `preferences-repository.ts`, and the new `folders-repository.ts`) calls `storage.getItem`/`setItem`/`watch` directly and never passes `debug: true` or uses `storage.defineItem()`'s migration API, so this code path is unreachable in Hamesh's actual usage.
- `chunks/notes-*.js` and `chunks/popup-*.js` themselves contain **zero** `console.*` calls — all logging traces to the shared `tokens` chunk (React/WXT internals) and `content.js`, not to any Hamesh-authored page code, including the new Sidebar/LibrarySettingsView/FolderTree/MoveToFolderMenu/video-adapter/video-ui code.

**Conclusion: no code path in the shipped package logs note content, preference values, page content, or any user data to the console.**

## What changed since the v1.0.0 audit

- **Video Notes** — a new `Anchor` variant (timestamps instead of DOM elements), video player adapters, timeline markers, and a dedicated `commands` entry (`activate-hamesh-video`, Alt+V). All storage still goes through the already-audited `storage` permission (`notes-repository.ts`, unchanged key format); no new permission, no network requests, no new host access.
- **Folders** — a new storage entity (`folders-repository.ts`, single key `local:hamesh:folders`) and a `folderId` field on stored notes, both still within the already-audited `storage` permission.
- **Settings** moved from popup-only into a permanent Notes Library page, with a Shortcuts section that only _reads_ `chrome.commands.getAll()` and links out to `chrome://extensions/shortcuts` — no new permission (`commands` needs none beyond the `commands` manifest key already present since `v1.0.0`).
- Package entry count, permission set, and console-logging profile are all **unchanged** from `v1.0.0` — confirmed above, not assumed.

## Not modified

Per this task's restriction, the release artifact above was **audited only** — nothing was changed, repackaged, or re-uploaded. The `activeTab` permission recommendation from earlier audits remains open and untouched this cycle — see `PERMISSION_JUSTIFICATIONS.md`'s `activeTab` section; do not re-attempt its removal without first identifying the actual dependency documented there. If it is ever removed, this checklist (manifest snapshot, SHA-256, and package contents) must be regenerated against the new build before submission.
