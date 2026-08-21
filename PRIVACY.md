# Privacy Statement

**Hamesh does not collect, transmit, or share any user data.**

## Data Storage

All notes you create are stored exclusively in your browser's local storage using `chrome.storage.local`. This data never leaves your device.

Hamesh has no backend servers, no external APIs, no analytics services, and no telemetry. The extension makes no network requests of any kind.

## Permissions

| Permission                  | Purpose                                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `storage`                   | Save and retrieve notes locally via `chrome.storage.local`                                                                                                                                             |
| `activeTab`                 | Reach the current tab's content script **only when you invoke Hamesh** (toolbar icon, Alt+H, Alt+V, or Alt+T)                                                                                          |
| `favicon`                   | Show each website's favicon in the Notes Library, read from Chrome's own local favicon cache — no network request is made                                                                              |
| `alarms`                    | A periodic no-op background alarm that keeps the extension's background process from going idle, working around a Chrome reliability issue with keyboard-shortcut delivery — no data is read or stored |
| content script `<all_urls>` | Inject the note-taking UI and restore your saved markers on the pages you visit                                                                                                                        |

The content script runs on all pages so previously-saved notes can be restored
in context. It reads page structure only to anchor and restore notes, and only
acts on what you explicitly select. It never reads or stores input field values
or passwords, never transmits page content or browsing history, and never logs
note contents.

**When you attach a note to selected text**, Hamesh stores a copy of exactly
the words you selected, plus a short run of text (about 32 characters) either
side of them. It needs both to find those same words again when you return to
the page. This is stored locally with the note, like everything else, and is
only ever the text you yourself selected — never the rest of the page.

## What Hamesh Does NOT Do

- Does not collect personal information
- Does not track browsing history
- Does not send data to any server
- Does not use analytics or crash reporting
- Does not share data with third parties
- Does not use cookies

If you uninstall the extension, all stored notes remain in `chrome.storage.local` until cleared via the browser's extension data management tools.

## Backup

Settings → Backup writes your notes and folders to a JSON file, and reads one
back. The file is written by your browser to wherever you choose to save it, on
your own device. Hamesh does not upload it, does not send it anywhere, and has
nowhere to send it to. Once the file exists it is an ordinary file you own — if
you later put it somewhere shared, that is your choice and outside Hamesh's
control.
