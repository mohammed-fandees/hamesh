# Privacy Statement

**Hamesh does not collect, transmit, or share any user data.**

## Data Storage

All notes you create are stored exclusively in your browser's local storage using `chrome.storage.local`. This data never leaves your device.

Hamesh has no backend servers, no external APIs, no analytics services, and no telemetry. The extension makes no network requests of any kind.

## Permissions

| Permission                  | Purpose                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `storage`                   | Save and retrieve notes locally via `chrome.storage.local`                                     |
| `activeTab`                 | Reach the current tab's content script **only when you invoke Hamesh** (toolbar icon or Alt+H) |
| content script `<all_urls>` | Inject the note-taking UI and restore your saved markers on the pages you visit                |

The content script runs on all pages so previously-saved notes can be restored
in context. It reads page structure only to anchor and restore notes, and only
acts on the elements you explicitly select. It never reads or stores input
field values or passwords, never transmits page content or browsing history, and
never logs note contents.

## What Hamesh Does NOT Do

- Does not collect personal information
- Does not track browsing history
- Does not send data to any server
- Does not use analytics or crash reporting
- Does not share data with third parties
- Does not use cookies

If you uninstall the extension, all stored notes remain in `chrome.storage.local` until cleared via the browser's extension data management tools. Hamesh provides no mechanism to export or transmit this data.
