# Hamesh Privacy Policy

**Last updated:** [OWNER: insert publish date]
**Applies to:** Hamesh browser extension, version 0.1.0 and later versions with the same data-handling behavior described below.

> **Canonical, publicly hosted version:** `landing/privacy.html` — a bilingual (Arabic/English, matching the landing page's design system and language toggle) rendering of this exact policy, deployed alongside the landing page. Once the landing site is live, its public URL (e.g. `https://hamesh.fandees.tech/privacy.html`) is what goes in the Chrome Web Store dashboard's "Privacy policy URL" field — see `SUBMISSION_GUIDE.md`. This Markdown file is the same content kept as a plain-text reference inside the repo; if the two ever diverge, `landing/privacy.html` is source of truth for what's actually public.

This policy describes exactly what the Hamesh browser extension ("Hamesh," "the extension," "we") does and does not do with your data. It is written to match the extension's actual, current implementation — not aspirational or planned behavior.

## Summary

Hamesh stores the notes you create entirely on your own device. It does not have a server, does not create an account for you, does not transmit any data over the network, and does not use analytics, advertising, or tracking of any kind.

## What Hamesh does

Hamesh lets you attach a short text note to a specific element on a web page (for example, a paragraph, heading, or button). When you return to that page, Hamesh shows a small marker next to that element so you can reopen, edit, or delete the note.

## What information Hamesh accesses

When you explicitly activate Hamesh (via the toolbar icon or the Alt+H keyboard shortcut) and click an element to annotate, Hamesh reads:

- that element's tag name, `id`, `aria-label`, CSS classes, `href`/`src`/`alt`/`role` attributes, and up to 200 characters of its visible text;
- that element's on-screen position.

This information is used only to help Hamesh find the same element again later, so your note can be shown in the right place. Hamesh does not read the rest of the page, does not read other elements, and does not read the contents of form fields or password fields — even if you click near one, the underlying code path only inspects element attributes, never input values.

On every page you visit, Hamesh also computes a normalized version of that page's URL (removing tracking parameters and the URL fragment) so it can look up notes you previously saved for that page. This lookup happens entirely on your device against your own locally stored notes; Hamesh does not record, log, or transmit your browsing history, and does not build any history of pages you've visited.

## What information Hamesh stores

- **The text you type into a note.**
- **The element information described above** (used to re-find the element).
- **The page's normalized URL**, so notes can be grouped by page.
- **Timestamps** (created/updated) for each note.

All of this is stored using your browser's built-in local extension storage (`chrome.storage.local`). It stays on your device.

## What Hamesh does NOT do

- Hamesh does **not** have a backend server of any kind.
- Hamesh does **not** transmit any data over the network — this includes no analytics, no crash reporting, no telemetry, no advertising SDKs, and no third-party API calls. (You can verify this yourself: the extension's source is available, and it contains no networking code.)
- Hamesh does **not** require or support an account, login, or authentication.
- Hamesh does **not** read passwords or other form input values.
- Hamesh does **not** collect or infer your location.
- Hamesh does **not** track your browsing history.
- Hamesh does **not** sell, rent, or share your data with anyone, because your data never leaves your device.
- Hamesh does **not** use your data for advertising, personalization, or profiling of any kind.

## Where your data lives, and for how long

Your notes live in `chrome.storage.local`, a storage area Chrome (or another Chromium-based browser) provides to each extension, isolated from web pages and other extensions. Notes are retained until you:

- delete a specific note using Hamesh's own delete action, or
- uninstall the extension and separately clear its stored data via your browser's extension data management, or
- clear your browser's local storage/profile data.

Hamesh provides no built-in export or transmission mechanism for this data — it is designed to stay local.

## Children's privacy

Hamesh does not knowingly collect personal information from anyone, including children, because it does not collect personal information from any user in the first place — all data is user-authored note text and page-element metadata, stored locally.

## Permissions this extension requests, and why

| Permission              | Why                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`               | To save your notes locally so they persist across browser sessions.                                                                                  |
| `activeTab`             | To identify the tab you're currently viewing when you invoke Hamesh from the toolbar or keyboard shortcut.                                           |
| Running on all websites | So previously-saved notes can be automatically restored when you return to a page, without you having to manually re-activate Hamesh on every visit. |

See `PERMISSION_JUSTIFICATIONS.md` in this package for the full technical justification of each permission.

## Security

Because Hamesh does not transmit data, there is no data-in-transit to secure. Data at rest is protected by your browser's own extension storage sandboxing, the same mechanism used by Chrome for all extensions' local storage.

## Changes to this policy

If Hamesh's data handling changes in a future version (for example, if a cloud-sync feature were ever added), this policy will be updated first, the change will be clearly described, and the update will ship in a new version with an updated "Last updated" date above. We will not silently expand data collection without updating this document.

## Contact

Questions about this policy or Hamesh's data practices can be raised via GitHub Issues:
**https://github.com/mohammed-fandees/hamesh/issues**

[OWNER: if you want a direct support email instead of/in addition to GitHub Issues, add it here before publishing.]
