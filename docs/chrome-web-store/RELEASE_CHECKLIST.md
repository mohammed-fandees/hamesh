# Release Package Audit

Audited the actual artifact a Chrome Web Store submission would upload — **not modified or repackaged**; this documents what `pnpm zip` produces today.

> **Refreshed 2026-07-11 for v0.2.0.** The previous version of this audit was against `v0.1.0`; every claim below was re-verified from scratch against the current build rather than copied forward. See `README.md`'s note on why this refresh happened.

## Build & package commands run

```
pnpm build   →  .output/chrome-mv3/
pnpm zip     →  .output/hamesh-0.2.0-chrome.zip
```

Both completed successfully with no errors.

## Package identity

| Field             | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Artifact          | `hamesh-0.2.0-chrome.zip`                                          |
| Size              | 150.49 kB (zipped), 473.03 kB (unpacked)                           |
| SHA-256           | `f1d2302bf99dd0f70557eec4a5ad4e577b645618c55c73dbfb8ab5af1e20ad8f` |
| Manifest version  | 3                                                                  |
| Extension version | 0.2.0 (matches `package.json`)                                     |

## Contents (complete list, 16 entries)

```
background.js
manifest.json
popup.html
assets/popup-BbECuqha.css
content-scripts/content.css
content-scripts/content.js
chunks/popup-DKcQDjf2.js
icon/128.png  icon/16.png  icon/32.png  icon/48.png  icon/96.png
```

Same structure and entry count as `v0.1.0` — only the content-hashed filenames changed (expected, different build). Every file is a build output (JS/CSS bundles, the manifest, the popup shell, icons). **Nothing else is present.**

## Checklist

| Check                                     | Result                                                                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Builds successfully                       | ✅ `pnpm build` exit 0                                                                                                                       |
| Manifest V3                               | ✅ `"manifest_version": 3`                                                                                                                   |
| Version correct                           | ✅ `0.2.0`, matches `package.json`                                                                                                           |
| Permissions unchanged from v0.1.0         | ✅ still exactly `["storage", "activeTab"]`, no `host_permissions` — confirmed by diff, not assumed                                          |
| Name correct                              | ✅ `Hamesh — هامش`                                                                                                                           |
| Description present and accurate          | ✅ matches actual local-only behavior                                                                                                        |
| Icons present at all declared sizes       | ✅ 16/32/48/96/128, all referenced in `manifest.icons`                                                                                       |
| No source maps                            | ✅ re-verified — `find .output/chrome-mv3 -name "*.map"` returns nothing                                                                     |
| No tests included                         | ✅ re-verified — no `tests/`, `e2e/`, or `*.test.*` files in the zip listing                                                                 |
| No docs included                          | ✅ re-verified — no `README`, `docs/`, or `*.md` files in the zip listing                                                                    |
| No `.env` or secrets                      | ✅ re-verified — no env files in the zip listing; repo-wide secret scan found nothing (see main repo audit)                                  |
| No development-only config                | ✅ re-verified — no `tsconfig`, `vite.config`, `eslint.config`, etc. in the zip listing                                                      |
| No localhost references                   | ✅ re-verified — grepped all three bundled JS files (`background.js`, `content.js`, `chunks/popup-*.js`) for `localhost`, zero matches       |
| No debug logging exposes note contents    | ✅ see below (re-audited, including the popup chunk, which the v0.1.0 audit's write-up didn't explicitly call out even though it checked it) |
| No remote-code policy violation           | ✅ confirmed — see `PRIVACY_PRACTICES.md`'s "Remote code" section; no `<script src="http…">`, no remote `eval`/`import()`                    |
| Package structure suitable for CWS upload | ✅ standard WXT/Vite MV3 output, flat root with `manifest.json` at top level                                                                 |

### Debug/logging audit detail

Grepping all three bundled scripts (`background.js`, `content.js`, `chunks/popup-*.js`) for `console.` found:

- `console.warn` (1, in `background.js`) — traced to **WXT's own framework code**, a generic diagnostic ("The background's main() function return a promise, but it must be synchronous"). Not Hamesh application code, references no user data.
- `console.error` calls — traced to **React's own production bundle** (`unstable_forceFrameRate`, `checkDCE`, generic `uncaughtException`/error-boundary reporting) plus one `@wxt-dev/storage` migration-failure logger (`Migration failed for ${e}`, where `e` is a storage key name, not note content). None reference note content or user data.
- `console.debug` calls — traced to `@wxt-dev/storage`'s internal migration logging, gated behind a `debug` option that **defaults to `false`** (confirmed in the bundled default). Hamesh's own storage code (`src/storage/notes-repository.ts`, `src/storage/preferences-repository.ts`) calls `storage.getItem`/`setItem` directly and never passes `debug: true` or uses `storage.defineItem()`'s migration API, so this code path is unreachable in Hamesh's actual usage — same conclusion as `v0.1.0`, re-confirmed against the current storage code including the new preferences repository.

**Conclusion: no code path in the shipped package logs note content, preference values, page content, or any user data to the console.**

## What changed since the v0.1.0 audit

- Settings screen (language + appearance preferences) was added — it's a new UI surface, not a new data-collection surface. `src/storage/preferences-repository.ts` writes to `chrome.storage.local` under a separate key (`local:hamesh:preferences`), using the same `storage` permission already audited; no new permission, no network code, no new host access. See `PERMISSION_JUSTIFICATIONS.md` and `PRIVACY_POLICY.md` for the corresponding updates.
- No other behavior change affects this checklist's conclusions.

## Not modified

Per this task's restriction, the release artifact above was **audited only** — nothing was changed, repackaged, or re-uploaded. If the `activeTab` permission is removed per the recommendation in `PERMISSION_JUSTIFICATIONS.md`, this checklist (manifest snapshot, SHA-256, and package contents) must be regenerated against the new build before submission — same as noted in the original v0.1.0 audit, still unresolved.
