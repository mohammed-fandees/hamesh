# Release Package Audit

Audited the actual artifact a Chrome Web Store submission would upload — **not modified or repackaged**; this documents what `pnpm zip` produces today.

> **Refreshed 2026-07-14 for v1.0.0.** The previous version of this audit was against `v0.2.0`; every claim below was re-verified from scratch against the current build (which now includes the Notes Library) rather than copied forward.

## Build & package commands run

```
pnpm build   →  .output/chrome-mv3/
pnpm zip     →  .output/hamesh-1.0.0-chrome.zip
```

Both completed successfully with no errors.

## Package identity

| Field             | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Artifact          | `hamesh-1.0.0-chrome.zip`                                          |
| Size              | 159.94 kB (zipped), 501.29 kB (unpacked)                           |
| SHA-256           | `4ac5ac43c986e21b913f3c252589d4e6a653223ff9b04d4e6b1da4b256b8bd55` |
| Manifest version  | 3                                                                  |
| Extension version | 1.0.0 (matches `package.json`)                                     |

## Contents (complete list, 21 entries)

```
background.js
manifest.json
notes.html
popup.html
assets/notes-CIZ97c1B.css
assets/popup-BoOrHY-h.css
assets/tokens-YG0Xe_y1.css
content-scripts/content.css
content-scripts/content.js
chunks/notes-DD5KFsKB.js
chunks/popup-CybTsg9v.js
chunks/tokens-DoQF8Oxr.js
icon/128.png  icon/16.png  icon/32.png  icon/48.png  icon/96.png
```

Grew from 16 to 21 entries versus `v0.2.0`: the Notes Library page adds `notes.html`, its own JS chunk and CSS asset, and a new shared `tokens` chunk/stylesheet (design tokens factored out now that two extension pages use them). Every file is a build output (JS/CSS bundles, the manifest, the popup and notes page shells, icons). **Nothing else is present.**

## Checklist

| Check                                     | Result                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Builds successfully                       | ✅ `pnpm build` exit 0                                                                                                                                                               |
| Manifest V3                               | ✅ `"manifest_version": 3`                                                                                                                                                           |
| Version correct                           | ✅ `1.0.0`, matches `package.json`                                                                                                                                                   |
| Permissions match audited manifest        | ✅ exactly `["storage", "activeTab", "favicon"]`, no `host_permissions` — confirmed by diff, not assumed. `favicon` is new since `v0.2.0`, audited in `PERMISSION_JUSTIFICATIONS.md` |
| Name correct                              | ✅ `Hamesh — هامش`                                                                                                                                                                   |
| Description present and accurate          | ✅ matches actual local-only behavior                                                                                                                                                |
| Icons present at all declared sizes       | ✅ 16/32/48/96/128, all referenced in `manifest.icons`                                                                                                                               |
| No source maps                            | ✅ re-verified — `find .output/chrome-mv3 -name "*.map"` returns nothing                                                                                                             |
| No tests included                         | ✅ re-verified — no `tests/`, `e2e/`, or `*.test.*` files in the zip listing                                                                                                         |
| No docs included                          | ✅ re-verified — no `README`, `docs/`, or `*.md` files in the zip listing                                                                                                            |
| No `.env` or secrets                      | ✅ re-verified — no env files in the zip listing; repo-wide secret scan found nothing (see main repo audit)                                                                          |
| No development-only config                | ✅ re-verified — no `tsconfig`, `vite.config`, `eslint.config`, etc. in the zip listing                                                                                              |
| No localhost references                   | ✅ re-verified — grepped all bundled JS files (`background.js`, `content.js`, `chunks/popup-*.js`, `chunks/notes-*.js`, `chunks/tokens-*.js`) for `localhost`, zero matches          |
| No debug logging exposes note contents    | ✅ see below — re-audited including the new `notes` and `tokens` chunks                                                                                                              |
| No remote-code policy violation           | ✅ confirmed — see `PRIVACY_PRACTICES.md`'s "Remote code" section; no `<script src="http…">`, no remote `eval`/`import()`                                                            |
| Package structure suitable for CWS upload | ✅ standard WXT/Vite MV3 output, flat root with `manifest.json` at top level                                                                                                         |

### Debug/logging audit detail

Grepping all bundled scripts (`background.js`, `content.js`, `chunks/popup-*.js`, `chunks/notes-*.js`, `chunks/tokens-*.js`) for `console.` found:

- `console.warn` (1, in `background.js`) — traced to **WXT's own framework code**, a generic diagnostic ("The background's main() function return a promise, but it must be synchronous"). Not Hamesh application code, references no user data.
- `console.error` calls (7, in `content.js` and the shared `tokens` chunk) — traced to **React's own production bundle** (`unstable_forceFrameRate`, `checkDCE`, generic `uncaughtException`/error-boundary reporting) plus one `@wxt-dev/storage` migration-failure logger (`Migration failed for ${e}`, where `e` is a storage key name, not note content). None reference note content or user data.
- `console.debug` calls (3, in `content.js` and the shared `tokens` chunk) — traced to `@wxt-dev/storage`'s internal migration logging, gated behind a `debug` option that **defaults to `false`** (confirmed in the bundled default). Hamesh's own storage code (`src/storage/notes-repository.ts`, `src/storage/preferences-repository.ts`) calls `storage.getItem`/`setItem` directly and never passes `debug: true` or uses `storage.defineItem()`'s migration API, so this code path is unreachable in Hamesh's actual usage.
- `chunks/notes-*.js` and `chunks/popup-*.js` themselves contain **zero** `console.*` calls — all logging traces to the shared `tokens` chunk (React/WXT internals) and `content.js`, not to any Hamesh-authored page code.

**Conclusion: no code path in the shipped package logs note content, preference values, page content, or any user data to the console.**

## What changed since the v0.2.0 audit

- **Notes Library** page added (`notes.html`, `chunks/notes-*.js`, `assets/notes-*.css`) — a new extension-owned page, not a new content-script surface. It reads existing `chrome.storage.local` notes/preferences (already-audited `storage` permission) and adds one new permission, `favicon`, to read website favicons from Chrome's local cache — see `PERMISSION_JUSTIFICATIONS.md` for the full justification. No network requests, no new host access.
- A shared `tokens` chunk/stylesheet was factored out (design tokens now used by both the popup and the Notes Library page) — a build-output reorganization only, not a behavior change.
- A CSS-only fix to `NoteViewer`'s card padding (`src/ui/tokens.css`, `.hm-viewer-card`) so the pin-toggle and close buttons no longer render on top of the note's own text — found by manually driving the built extension during this release's stability check, not by the automated test suites. See `CHANGELOG.md`'s `[1.0.0]` entry.
- No other behavior change affects this checklist's conclusions.

## Not modified

Per this task's restriction, the release artifact above was **audited only** — nothing was changed, repackaged, or re-uploaded. The `activeTab` permission recommendation from earlier audits was investigated this cycle but a removal attempt surfaced a functional regression, so it remains in the manifest — see `PERMISSION_JUSTIFICATIONS.md`'s `activeTab` section. If it is ever removed, this checklist (manifest snapshot, SHA-256, and package contents) must be regenerated against the new build before submission.
