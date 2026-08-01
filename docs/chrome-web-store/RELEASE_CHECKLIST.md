# Release Package Audit

Audited the actual artifact a Chrome Web Store submission would upload — **not modified or repackaged**; this documents what `pnpm zip` produces today.

> **Refreshed 2026-08-01 for v1.2.0.** The previous version of this audit was against `v1.1.0`; every claim below was re-verified from scratch against the current build (which adds the note actions menu — pin/edit/delete/move from any Notes Library view — plus a round of Folders bug fixes) rather than copied forward.

## Build & package commands run

```
pnpm build   →  .output/chrome-mv3/
pnpm zip     →  .output/hamesh-1.2.0-chrome.zip
```

Both completed successfully with no errors.

## Package identity

| Field             | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Artifact          | `hamesh-1.2.0-chrome.zip`                                          |
| Size              | 171.76 kB (zipped), 554.19 kB (unpacked)                           |
| SHA-256           | `616efbc0571ca19609bd76b97c8c7f82572733d1780784b89f85acf65d5b2017` |
| Manifest version  | 3                                                                  |
| Extension version | 1.2.0 (matches `package.json`)                                     |

## Contents (complete list, 21 entries)

```
background.js
manifest.json
notes.html
popup.html
assets/notes-DY-UnFEq.css
assets/popup-BoOrHY-h.css
assets/tokens-DqYgEPhP.css
content-scripts/content.css
content-scripts/content.js
chunks/notes-C8pDiUNM.js
chunks/popup-DlHK3yJY.js
chunks/tokens-CU7ETJo4.js
icon/128.png  icon/16.png  icon/32.png  icon/48.png  icon/96.png
```

Same 21 entries as the `v1.1.0` audit — the note actions menu (`NoteActionsMenu.tsx`, replacing the older `MoveToFolderMenu.tsx`) and the Folders bug fixes all landed inside the existing `chunks/notes-*.js` bundle, not as new top-level files. Every file is a build output (JS/CSS bundles, the manifest, the popup and notes page shells, icons). **Nothing else is present.**

## Checklist

| Check                                     | Result                                                                                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builds successfully                       | ✅ `pnpm build` exit 0                                                                                                                                                                         |
| Manifest V3                               | ✅ `"manifest_version": 3`                                                                                                                                                                     |
| Version correct                           | ✅ `1.2.0`, matches `package.json`                                                                                                                                                             |
| Permissions match audited manifest        | ✅ still exactly `["storage", "activeTab", "favicon"]`, no `host_permissions` — unchanged since `v1.0.0`, confirmed by `pnpm release:validate --tag=v1.2.0 --previous-ref=v1.1.0`, not assumed |
| Commands match audited manifest           | ✅ `activate-hamesh` (Alt+H) and `activate-hamesh-video` (Alt+V) — unchanged from `v1.1.0`                                                                                                     |
| Name correct                              | ✅ `Hamesh — هامش`                                                                                                                                                                             |
| Description present and accurate          | ✅ matches actual local-only behavior                                                                                                                                                          |
| Icons present at all declared sizes       | ✅ 16/32/48/96/128, all referenced in `manifest.icons`                                                                                                                                         |
| No source maps                            | ✅ re-verified — `find .output/chrome-mv3 -name "*.map"` returns nothing                                                                                                                       |
| No tests included                         | ✅ re-verified — no `tests/`, `e2e/`, or `*.test.*` files in the zip listing                                                                                                                   |
| No docs included                          | ✅ re-verified — no `README`, `docs/`, or `*.md` files in the zip listing                                                                                                                      |
| No `.env` or secrets                      | ✅ re-verified — no env files in the zip listing; targeted secret-pattern scan (`sk-`, `AKIA`, `api_key`, `secret`) across all bundled JS found nothing                                        |
| No development-only config                | ✅ re-verified — no `tsconfig`, `vite.config`, `eslint.config`, etc. in the zip listing                                                                                                        |
| No localhost references                   | ✅ re-verified — grepped all bundled JS files (`background.js`, `content.js`, `chunks/popup-*.js`, `chunks/notes-*.js`, `chunks/tokens-*.js`) for `localhost`, zero matches                    |
| No debug logging exposes note contents    | ✅ see below — re-audited including the note-actions-menu code now inside `chunks/notes-*.js`                                                                                                  |
| No remote-code policy violation           | ✅ confirmed — see `PRIVACY_PRACTICES.md`'s "Remote code" section; no `<script src="http…">`, no remote `eval`/`import()`                                                                      |
| Package structure suitable for CWS upload | ✅ standard WXT/Vite MV3 output, flat root with `manifest.json` at top level                                                                                                                   |

### Debug/logging audit detail

Grepping all bundled scripts (`background.js`, `content.js`, `chunks/popup-*.js`, `chunks/notes-*.js`, `chunks/tokens-*.js`) for `console.` found the same counts as the `v1.1.0` audit — no new logging was introduced by the note actions menu or the Folders bug fixes:

- `console.warn` (1, in `background.js`) — traced to **WXT's own framework code**, a generic diagnostic ("The background's main() function return a promise, but it must be synchronous"). Not Hamesh application code, references no user data.
- `console.error` calls (7 in `content.js`, 7 in the shared `tokens` chunk — the same underlying React-internals code duplicated across the two bundles, since `content.js` statically inlines what `notes.html` loads as a separate chunk) — traced to **React's own production bundle** (`unstable_forceFrameRate`, `checkDCE`, generic `uncaughtException`/error-boundary reporting) plus one `@wxt-dev/storage` migration-failure logger (`Migration failed for ${e}`, where `e` is a storage key name, not note content). None reference note content or user data.
- `console.debug` calls (3 in `content.js`, 3 in the shared `tokens` chunk, same duplication reason as above) — traced to `@wxt-dev/storage`'s internal migration logging, gated behind a `debug` option that **defaults to `false`** (confirmed in the bundled default). Hamesh's own storage code (`notes-repository.ts`, `preferences-repository.ts`, `folders-repository.ts`) calls `storage.getItem`/`setItem`/`watch` directly and never passes `debug: true` or uses `storage.defineItem()`'s migration API, so this code path is unreachable in Hamesh's actual usage.
- `chunks/notes-*.js` and `chunks/popup-*.js` themselves contain **zero** `console.*` calls — all logging traces to the shared `tokens` chunk (React/WXT internals) and `content.js`, not to any Hamesh-authored page code, including the note-actions-menu (`NoteActionsMenu.tsx`, `PinnedSection.tsx`, `WebsiteGroup.tsx`, `FolderTree.tsx`) code.

**Conclusion: no code path in the shipped package logs note content, preference values, page content, or any user data to the console.**

## What changed since the v1.1.0 audit

- **Note actions menu** — pin/unpin, edit, and delete a note directly from any Notes Library view (domain-grouped, folder-tree, and Pinned), not just the on-page viewer. `MoveToFolderMenu.tsx` was generalized into `NoteActionsMenu.tsx`; all four actions (including the pre-existing move-to-folder) still go through the already-audited `storage` permission (`notes-repository.ts`/`folders-repository.ts`, unchanged key formats) — no new permission, no network requests, no new host access.
- **Folders bug fixes** — collapse-animation clipping, menu-clipping, and row-click-target fixes to the `v1.1.0` Folders feature. Purely presentational/interaction fixes; no storage schema or permission changes.
- Package entry count, permission set, and console-logging profile are all **unchanged** from `v1.1.0` — confirmed above, not assumed.

## Not modified

Per this task's restriction, the release artifact above was **audited only** — nothing was changed, repackaged, or re-uploaded. The `activeTab` permission recommendation from earlier audits remains open and untouched this cycle — see `PERMISSION_JUSTIFICATIONS.md`'s `activeTab` section; do not re-attempt its removal without first identifying the actual dependency documented there. If it is ever removed, this checklist (manifest snapshot, SHA-256, and package contents) must be regenerated against the new build before submission.
