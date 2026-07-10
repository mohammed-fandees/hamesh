# Single Purpose Statement

Source: `docs/chrome-web-store/cws-dashboard-privacy` field "Single purpose description."
Verified against actual code in `src/entrypoints/`, `src/domain/`, `src/storage/` (see `PERMISSION_JUSTIFICATIONS.md` and `PRIVACY_PRACTICES.md` for the code-level evidence trail).

## Recommended statement (paste into the dashboard)

> Hamesh lets a user attach a short text note to a specific element on a web page, save that note locally in the browser, and see it restored — as a small marker — when the user returns to that page. The extension's single purpose is creating, persisting, and restoring these page-anchored notes.

Character count: 317 (well within any reasonable single-purpose field length; no official CWS character cap is published for this field).

## Shorter alternative

> Hamesh's single purpose is to let users attach short notes to specific elements on web pages and have those notes restored, in place, when they revisit the page.

Character count: 176.

## Why this matches the actual implementation

| Claim in the statement                                   | Code evidence                                                                                                                                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "attach a short text note to a specific element"         | `src/domain/anchor.ts:buildElementAnchor()` captures signals from the exact clicked `Element`; `src/ui/Composer.tsx` collects plain text only (no rich text, no attachments)                                                     |
| "save that note locally in the browser"                  | `src/storage/notes-repository.ts` writes exclusively to `chrome.storage.local` (via WXT's `storage.setItem('local:…')`) — no network client exists anywhere in `src/`                                                            |
| "restored ... when the user returns"                     | `src/content/HameshApp.tsx` calls `resolveAnchor()` (`src/domain/anchor-resolution.ts`) on load and on SPA navigation to re-attach the marker                                                                                    |
| "single purpose ... creating, persisting, and restoring" | The entire `src/` tree implements exactly these three operations plus edit/delete of the same notes — there is no unrelated feature surface (no bookmarking, no page capture, no reading mode, no unrelated tab/history tooling) |

## What the statement deliberately excludes

Per the audit, the following are **not** implemented and are not claimed:

- cloud sync / cross-device access;
- accounts or authentication;
- sharing or collaboration;
- analytics or usage tracking;
- any feature unrelated to attaching/restoring page-anchored notes.

Do not broaden this statement to describe roadmap ideas. If a future version adds an unrelated capability, the single-purpose statement must be revisited — Chrome Web Store review treats a single extension serving multiple unrelated purposes as a policy violation.
