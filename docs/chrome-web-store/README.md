# Hamesh — Chrome Web Store Submission Package

This directory contains Hamesh's Chrome Web Store submission package, kept in sync with the codebase — see `SUBMISSION_GUIDE.md` for what the owner does manually with it.

> **Status as of 2026-07-11: Hamesh is live on the Chrome Web Store.** This package was originally written before the first submission (against `v0.1.0`) and is now refreshed for `v0.2.0`. The framing below has been corrected accordingly — package upload, in particular, is now an update to the existing item, not a new-item submission (see `SUBMISSION_GUIDE.md` §0). Everything else about the package's purpose (a reviewed, version-controlled record of exactly what's submitted) is unchanged.

## Package index

| File                           | Purpose                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `SUBMISSION_GUIDE.md`          | **Start here.** Dashboard-order walkthrough with exact values/files for every field.                    |
| `STORE_LISTING.md`             | Product name, summary, detailed description (English + Arabic), category, language strategy.            |
| `SINGLE_PURPOSE.md`            | The single-purpose statement for the Privacy practices tab.                                             |
| `PERMISSION_JUSTIFICATIONS.md` | Every manifest permission/host-access surface, traced to code, with reviewer-facing justification text. |
| `PRIVACY_PRACTICES.md`         | Code-audited answer sheet for the dashboard's data-usage checkboxes and certifications.                 |
| `PRIVACY_POLICY.md`            | The public privacy policy text (also live, bilingually, at `landing/privacy.html`).                     |
| `REVIEWER_NOTES.md`            | Testing instructions for the Chrome reviewer — no login required.                                       |
| `ASSET_MANIFEST.md`            | Every screenshot/promo/icon asset: how it was made, dimensions, QA status.                              |
| `RELEASE_CHECKLIST.md`         | Audit of the actual `.zip` package that would be uploaded.                                              |
| `screenshots/`                 | 5 product screenshots, 1280×800, from the real running extension.                                       |
| `promotional/`                 | Small tile (440×280) and marquee (1400×560).                                                            |
| `icons/`                       | Store + manifest icon set, copied from `public/icon/`.                                                  |
| `source/`                      | Editable HTML sources used to generate the demo page and promotional images.                            |

## How current requirements were verified

Chrome Web Store requirements change over time, so nothing below was taken from memory — each was checked against official documentation as of this package's preparation date.

| Requirement                                                                                                          | Verified value                                        | Mandatory?                                   | Source                                                                      |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| Store icon                                                                                                           | 128×128 PNG                                           | Mandatory                                    | `developer.chrome.com/docs/webstore/best-listing`                           |
| Screenshot size                                                                                                      | 1280×800 (640×400 also accepted)                      | At least 1, up to 5                          | `developer.chrome.com/docs/webstore/best-listing`                           |
| Screenshot count                                                                                                     | 1 minimum, 5 maximum                                  | 1 mandatory, 5 recommended                   | `developer.chrome.com/docs/webstore/program-policies/listing-requirements/` |
| Small promotional tile                                                                                               | 440×280                                               | Commonly required by dashboard               | `developer.chrome.com/docs/webstore/best-listing`                           |
| Marquee promotional image                                                                                            | 1400×560                                              | Optional (featured placement only)           | `developer.chrome.com/docs/webstore/best-listing`                           |
| Summary/short description limit                                                                                      | 132 characters                                        | Mandatory field                              | `developer.chrome.com/docs/webstore/best-listing`                           |
| Blank description/missing icon or screenshots                                                                        | Rejected                                              | —                                            | `developer.chrome.com/docs/webstore/program-policies/listing-requirements/` |
| Privacy practices tab fields (single purpose, permission justification, remote code, data usage, privacy policy URL) | Present, structure confirmed                          | Mandatory if extension handles any user data | `developer.chrome.com/docs/webstore/cws-dashboard-privacy`                  |
| Privacy policy required whenever data (even local-only) is handled                                                   | Confirmed                                             | Mandatory for Hamesh                         | `developer.chrome.com/docs/webstore/program-policies/user-data-faq`         |
| Data-in-transit must use HTTPS/WSS if data is transmitted                                                            | Confirmed (not applicable — Hamesh transmits nothing) | Conditional                                  | `developer.chrome.com/docs/webstore/program-policies/user-data-faq`         |
| Limited Use certifications (purpose limitation, no ad use, no unauthorized access, no selling)                       | Confirmed, all satisfiable                            | Mandatory                                    | `developer.chrome.com/docs/webstore/program-policies/user-data-faq`         |

**Not independently confirmed from public documentation** (flagged for manual verification at submission time, per `SUBMISSION_GUIDE.md`):

- Exact current category taxonomy option labels (recommended "Productivity" as the closest durable fit).
- Verbatim wording of the data-usage checkbox list and certification checkboxes (the category _meanings_ were confirmed via multiple sources; exact live UI copy should be matched by meaning, not string, in-dashboard).
- Any character limit on the Privacy practices tab's permission-justification text fields (none found in public docs).

## Final status

| Area                                          | Status                                       | File(s)                                                    | Manual action required                                                                                                                      |
| --------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Listing copy (EN)                             | Ready                                        | `STORE_LISTING.md`                                         | Paste into dashboard                                                                                                                        |
| Listing copy (AR)                             | Ready, not yet submitted                     | `STORE_LISTING.md`                                         | Add as a second listing language after EN goes live                                                                                         |
| Screenshots                                   | Ready                                        | `screenshots/*.png` (5, verified 1280×800)                 | Upload in order                                                                                                                             |
| Promotional assets                            | Ready (small tile), Ready/Optional (marquee) | `promotional/*.png`                                        | Upload                                                                                                                                      |
| Icons                                         | Ready                                        | `icons/*.png`                                              | Package already includes them; no separate action unless the flow asks                                                                      |
| Single purpose statement                      | Ready                                        | `SINGLE_PURPOSE.md`                                        | Paste into dashboard                                                                                                                        |
| Permission justifications                     | Ready, with one open recommendation          | `PERMISSION_JUSTIFICATIONS.md`                             | **Owner decision:** keep or remove the apparently-unused `activeTab` permission before submitting                                           |
| Privacy practices (data usage/certifications) | Ready                                        | `PRIVACY_PRACTICES.md`                                     | Match live checkbox wording by meaning                                                                                                      |
| Privacy policy                                | Ready, needs hosting confirmation            | `PRIVACY_POLICY.md`, `landing/privacy.html`                | **Owner action:** deploy the landing page (if not already) and confirm `/privacy.html` resolves publicly; paste that URL into the dashboard |
| Reviewer notes                                | Ready                                        | `REVIEWER_NOTES.md`                                        | Paste into dashboard                                                                                                                        |
| Release package                               | Ready                                        | `.output/hamesh-0.2.0-chrome.zip` (rebuild via `pnpm zip`) | Upload as an update to the existing item                                                                                                    |
| Release audit                                 | Ready                                        | `RELEASE_CHECKLIST.md`                                     | None — clean                                                                                                                                |

**No Critical or High blockers remain.** The one open item is a judgment call, not a defect: whether to remove the currently-unused `activeTab` permission before submitting (see `PERMISSION_JUSTIFICATIONS.md`) — still open across both releases so far. Everything else is submission-ready pending the owner's manual dashboard actions listed above.

## What this package does NOT do

Per this refresh's scope: nothing in this repository (or this refresh pass) has uploaded, submitted, or changed anything in the Chrome Web Store Developer Dashboard, created or requested Chrome Web Store credentials, or modified the production release for marketing purposes. (Separately, and outside any automation, the owner has already manually submitted and published Hamesh to the Chrome Web Store using an earlier version of this package — see the status note at the top of this file. Automating the upload/submission steps themselves is tracked in `docs/releases/` once that work lands.) All product code changes (if any become necessary, e.g. removing `activeTab`) are left to the owner's discretion and a normal reviewed PR.
