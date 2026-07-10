# Reviewer Notes / Testing Instructions

Paste into the dashboard's reviewer notes / "notes for the reviewer" field (exact field name/availability varies by submission flow — see `SUBMISSION_GUIDE.md`).

## What the extension does

Hamesh lets a user attach a short text note to a specific element on any web page. The note is saved locally and automatically restored (as a small marker next to that element) when the user revisits the page.

## No login, no account, no test credentials needed

Hamesh has no authentication of any kind. **No test account or credentials are required to review this extension.** Every feature is available immediately after installation on any regular web page.

## Exact steps to test the primary interaction

1. Install the extension and visit any normal web page (e.g., a Wikipedia article, a blog post, or any content page — avoid `chrome://` pages, which extensions cannot run on by design).
2. Activate Hamesh either by:
   - clicking the toolbar icon and then the **"+ Add a note"** button in the popup, or
   - pressing **Alt+H** directly on the page.
3. The page enters selection mode: hovering shows a thin accent-colored outline around the element under the cursor, plus a small instruction pill near the cursor.
4. Click any element (e.g., a heading or paragraph). A small note-composer card appears attached to that element.
5. Type a short note (e.g., "test note") and click **Save**.
6. **Verify persistence:** a small margin-mark icon (⌇-shaped, clay-colored) appears next to the element you selected. This is the marker.

## Verify persistence across reload

7. Reload the page (F5 / Ctrl+R). The marker should reappear next to the same element within roughly a second of the page loading.

## Verify edit

8. Click the marker. A card opens showing the note's text.
9. Click **Edit**, change the text, click **Save changes**. The card updates immediately.
10. Reload the page again and reopen the marker — the edited text should persist.

## Verify delete

11. Open the marker again, click **Delete**, then confirm by clicking **Delete** again in the confirmation step.
12. The marker disappears immediately.
13. Reload the page — the marker should not reappear (the note was permanently removed from local storage).

## Keyboard behavior

- **Alt+H** anywhere on a normal page: starts selection mode (same as the toolbar button).
- **Escape**: cancels selection mode, or closes an open note card, or steps back from a delete-confirmation prompt.
- **Ctrl/Cmd+Enter** while writing a note: saves it (same as clicking Save).
- All interactive elements (buttons, textareas) are reachable via Tab and have visible focus outlines.

## Pages where functionality is intentionally unavailable

- Browser-internal pages (`chrome://…`, `chrome-extension://…`, the Chrome Web Store itself, and similar restricted schemes) — Chrome does not allow content scripts to run there, and Hamesh does not attempt to. This is expected and matches standard extension platform restrictions, not a bug.
- `file://` pages will only work if the user has separately granted the extension "Allow access to file URLs" in `chrome://extensions` (standard Chrome behavior for all extensions, not Hamesh-specific).

## Data / privacy note for the reviewer

All data created during testing (notes, element references) is stored only in `chrome.storage.local` on the testing machine. No network requests occur — reviewers can confirm this via DevTools' Network tab while using the extension; it will show no extension-initiated traffic.

## Known limitations (not bugs)

- No cloud sync; notes are local to one browser profile on one device by design (see `docs/PROMPT.md` and `README.md` for the documented v0.1.0 scope).
- Text-snippet matching used for marker restoration is exact, not fuzzy — if a page's content changes substantially, a note may fall back to an approximate position rather than disappearing.
