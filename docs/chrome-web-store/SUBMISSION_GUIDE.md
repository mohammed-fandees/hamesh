# Chrome Web Store Submission Guide

Follow this in order. Every value below is ready to copy/paste from the referenced file. This guide does not upload, publish, or submit anything — it tells the owner exactly what to do manually in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

Before starting, re-run the release audit if any code has changed since this package was prepared: `pnpm check && pnpm zip` (see `RELEASE_CHECKLIST.md`).

> **Refreshed 2026-07-11 for v0.2.0.** This guide was originally written before Hamesh's first submission, when the item didn't exist yet. **Hamesh is now live on the Chrome Web Store** (see `README.md`'s corrected "Final status", and `landing/index.html`'s install link) — so "0. Package upload" below is now an **update to the existing item**, not a new-item creation flow. The rest of the steps (Store Listing tab, Privacy practices tab, Distribution tab, reviewer notes) still apply the same way to an update as to the original submission.

---

## 0. Package upload

**Dashboard section:** "Items" → select the existing, already-published Hamesh item → "Package" tab → upload a new package version.

**Upload:** `.output/hamesh-0.2.0-chrome.zip` (run `pnpm zip` first if it doesn't exist — see `RELEASE_CHECKLIST.md` for its exact contents and checksum).

---

## 1. Store Listing tab

### Item name

**Exact value:**

```
Hamesh — Contextual Notes
```

Source: `STORE_LISTING.md` → "Product name". Alternative also provided there if this doesn't fit the field or availability check fails.

### Description → Summary (short description)

**Exact value (103/132 characters):**

```
Attach a note to any element on a page. Find it restored there when you return. Local-only, no account.
```

Source: `STORE_LISTING.md` → "Short description / summary — English — recommended".

### Description → Detailed description

Use the full English block from `STORE_LISTING.md` → "Detailed description → English". Copy the text inside the fenced code block exactly (it's pre-formatted with line breaks for readability in the dashboard's plain-text field).

### Category

**Recommended selection:** Productivity

**Action required:** open the live category dropdown and confirm this exact label still exists — it could not be verified against the current dashboard UI from public documentation alone (see `README.md`'s sourcing table). If the dropdown offers a more specific note-taking/annotation category, prefer it.

### Language

**Initial submission language:** English (see `STORE_LISTING.md` → "Language / localization strategy" for the rationale and the prepared Arabic copy to add later via the dashboard's localization feature).

### Screenshots

Upload all five, in this exact order (the dashboard preserves upload order for display order):

1. `screenshots/01-contextual-notes.png`
2. `screenshots/02-select-element.png`
3. `screenshots/03-write-in-context.png`
4. `screenshots/04-return-and-restore.png`
5. `screenshots/05-edit-your-note.png`

All are exactly 1280×800 (verified — see `ASSET_MANIFEST.md`).

### Promotional images

- **Small promotional tile (440×280):** `promotional/small-tile-440x280.png` — required by most submission flows.
- **Marquee promotional image (1400×560):** `promotional/marquee-1400x560.png` — optional; only relevant if Google features the extension. Upload it anyway since it's already prepared, at no cost if unused.

### Icon

The 128×128 icon is read directly from the uploaded package (`icon/128.png` inside the zip) — no separate icon upload field exists in most current flows. If a standalone icon upload field is present, use `icons/store-icon-128.png` (byte-identical to the one in the package).

### Official website / homepage

**If the landing page is deployed at a stable URL** (e.g. `https://hamesh.fandees.tech`): enter that URL here.
**If not yet deployed:** leave this field blank rather than entering a URL that doesn't resolve.

### Support / contact

Use the repository's issue tracker: `https://github.com/mohammed-fandees/hamesh/issues` (there is no separate support email configured — see `PRIVACY_POLICY.md`'s Contact section; add one there first if you want a different contact method reflected consistently).

---

## 2. Privacy practices tab

### Single purpose description

**Exact value:**

```
Hamesh lets a user attach a short text note to a specific element on a web page, save that note locally in the browser, and see it restored — as a small marker — when the user returns to that page. The extension's single purpose is creating, persisting, and restoring these page-anchored notes.
```

Source: `SINGLE_PURPOSE.md` (shorter alternative also provided there).

### Permission justifications

The dashboard will list each permission from the manifest (`storage`, `activeTab`) plus the host-access surface. Paste the corresponding "Reviewer-facing justification (final text)" block from `PERMISSION_JUSTIFICATIONS.md` for each:

| Dashboard entry                         | Justification text source                                             |
| --------------------------------------- | --------------------------------------------------------------------- |
| `storage`                               | `PERMISSION_JUSTIFICATIONS.md` → "storage" section                    |
| `activeTab`                             | `PERMISSION_JUSTIFICATIONS.md` → "activeTab" section                  |
| Host permission / content script access | `PERMISSION_JUSTIFICATIONS.md` → "Content script host access" section |

**Before this step:** re-read `PERMISSION_JUSTIFICATIONS.md`'s note about `activeTab` appearing unused in the current build — decide whether to remove it before submitting (recommended) or submit as-is with the justification provided.

### Remote code

**Answer: No.** See `PRIVACY_PRACTICES.md` → "Remote code" for the evidence.

### Data usage — "What user data does your extension collect?"

Check/uncheck exactly per the table in `PRIVACY_PRACTICES.md` → "Data usage disclosure". Summary: **only "Website content" should be checked**; every other category (personal info, health, financial, authentication, communications, location, web history, user activity) stays unchecked.

**Action required:** the exact live checkbox wording could not be independently verified from public documentation — match by meaning against `PRIVACY_PRACTICES.md`'s table, not by exact string.

### Certifications

Check all four certification boxes — `PRIVACY_PRACTICES.md` → "Certification checkboxes" confirms Hamesh can truthfully satisfy each one, with evidence.

### Privacy policy URL

**Value:** the public URL where `landing/privacy.html` is hosted once the landing site is deployed (expected `https://hamesh.fandees.tech/privacy.html`).

**Action required:** confirm the URL actually resolves (returns the policy page, not a 404) before pasting it into the dashboard — Chrome Web Store review will check this.

---

## 3. Distribution tab

### Visibility

**No longer applicable as a first-submission gate** — Hamesh's listing is already Public. This section is kept for reference in case a future item (e.g. a separate browser's listing) needs the original first-submission pattern: Private/Unlisted until reviewed end-to-end, then switch to Public.

### Regions

No region restriction is necessary — Hamesh has no legal/licensing constraints tied to geography. Default to "All regions" unless the owner has a specific reason to restrict.

### Pricing

Free. Hamesh has no payment code (`RELEASE_CHECKLIST.md` confirms no payment-related files in the package).

---

## 4. Reviewer notes / additional information

Paste the full contents of `REVIEWER_NOTES.md` into whatever field the current submission flow provides for reviewer guidance (field name varies — look for "Notes for reviewers," "Additional information," or similar during submission).

---

## 5. Before clicking "Submit for review"

Run through this final check:

- [ ] `pnpm check` passes (typecheck, lint, format, unit tests, build) — see main repo `README.md`.
- [ ] `pnpm zip` produced the artifact actually being uploaded, and its version matches what's entered in the dashboard.
- [ ] Privacy policy URL resolves publicly.
- [ ] Decision made on the `activeTab` permission (kept with justification, or removed — see `PERMISSION_JUSTIFICATIONS.md`).
- [ ] All five screenshots uploaded in order.
- [ ] Single purpose statement, permission justifications, and data-usage checkboxes all pasted from the files above (not paraphrased from memory).
- [ ] Reviewer notes pasted.
- [ ] ~~Visibility set to Private/Unlisted for a first internal review pass before going Public~~ — not applicable; the item is already Public.

This task's scope ends here — the owner performs the actual submission.
