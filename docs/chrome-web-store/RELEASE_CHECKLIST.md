# Release Package Audit

Audited the actual artifact a Chrome Web Store submission would upload — **not modified or repackaged**; this documents what `pnpm zip` produces today.

## Build & package commands run

```
pnpm build   →  .output/chrome-mv3/
pnpm zip     →  .output/hamesh-0.1.0-chrome.zip
```

Both completed successfully with no errors.

## Package identity

| Field             | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Artifact          | `hamesh-0.1.0-chrome.zip`                                          |
| Size              | 143.58 kB (zipped), 448.8 kB (unpacked)                            |
| SHA-256           | `f59cccf3dc2d4822e1557c62016b385efb85d34e146bc42ca775b3464b0c62e2` |
| Manifest version  | 3                                                                  |
| Extension version | 0.1.0 (matches `package.json`)                                     |

## Contents (complete list, 16 entries)

```
background.js
manifest.json
popup.html
assets/popup-7Kn2XQVQ.css
content-scripts/content.css
content-scripts/content.js
chunks/popup-BalcHW6d.js
icon/128.png  icon/16.png  icon/32.png  icon/48.png  icon/96.png
```

Every file is a build output (JS/CSS bundles, the manifest, the popup shell, icons). **Nothing else is present.**

## Checklist

| Check                                     | Result                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Builds successfully                       | ✅ `pnpm build` exit 0                                                                                                    |
| Manifest V3                               | ✅ `"manifest_version": 3`                                                                                                |
| Version correct                           | ✅ `0.1.0`, matches `package.json`                                                                                        |
| Name correct                              | ✅ `Hamesh — هامش`                                                                                                        |
| Description present and accurate          | ✅ matches actual local-only behavior                                                                                     |
| Icons present at all declared sizes       | ✅ 16/32/48/96/128, all referenced in `manifest.icons`                                                                    |
| No source maps                            | ✅ confirmed — no `.map` files in the archive                                                                             |
| No tests included                         | ✅ confirmed — no `tests/`, `e2e/`, or `*.test.*` files                                                                   |
| No docs included                          | ✅ confirmed — no `README`, `docs/`, or `*.md` files                                                                      |
| No `.env` or secrets                      | ✅ confirmed — no env files; repo-wide secret scan found nothing (see main repo audit)                                    |
| No development-only config                | ✅ confirmed — no `tsconfig`, `vite.config`, `eslint.config`, etc.                                                        |
| No localhost references                   | ✅ grepped both bundled JS files for `localhost` — zero matches                                                           |
| No debug logging exposes note contents    | ✅ see below                                                                                                              |
| No remote-code policy violation           | ✅ confirmed — see `PRIVACY_PRACTICES.md`'s "Remote code" section; no `<script src="http…">`, no remote `eval`/`import()` |
| Package structure suitable for CWS upload | ✅ standard WXT/Vite MV3 output, flat root with `manifest.json` at top level                                              |

### Debug/logging audit detail

Grepping both bundled scripts (`content.js`, `background.js`) for `console.` found:

- `console.error` calls — all traced to **React's own production bundle** (internal scheduler/error-boundary reporting), not Hamesh application code. They report uncaught exceptions generically; none reference note content or user data.
- `console.debug` calls — traced to `@wxt-dev/storage`'s internal migration logging, gated behind a `debug` option that **defaults to `false`** (confirmed by reading the bundled default: `debug: g = !1`). Hamesh's own storage code (`src/storage/notes-repository.ts`) calls `storage.getItem`/`setItem` directly and never passes `debug: true` or uses `storage.defineItem()`'s migration API, so this code path is unreachable in Hamesh's actual usage.

**Conclusion: no code path in the shipped package logs note content, page content, or any user data to the console.**

## Not modified

Per this task's restriction, the release artifact above was **audited only** — nothing was changed, repackaged, or re-uploaded. If the `activeTab` permission is removed per the recommendation in `PERMISSION_JUSTIFICATIONS.md`, this checklist (manifest snapshot, SHA-256, and package contents) must be regenerated against the new build before submission.
