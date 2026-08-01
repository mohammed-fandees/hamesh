# Changelog

All notable changes to Hamesh are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- The Alt+H / Alt+V keyboard shortcuts could silently stop working, regardless of which key combination was
  bound — root-caused to a Chromium reliability gap in `chrome.commands.onCommand` event delivery to a Manifest
  V3 background service worker. Shortcut handling now lives in a `keydown` listener in the content script
  itself, which needs no delivery from the background worker at all. The `chrome.commands`-based path is kept
  as a secondary fallback for pages with no content script.

## [1.2.0] — 2026-08-01

Note actions menu for the Notes Library, plus a round of bug fixes to the 1.1.0 Folders feature, delivered across two PRs.

### Added

- **Note actions menu** — pin/unpin, edit, and delete a note directly from the Notes Library, without opening
  it on its original page. A "⋮" menu on every note row now covers all four actions (the fourth, moving a note
  to a folder, was already there):
  - Available in the domain-grouped ("By site") view, the folder-tree ("By folder") view, and the Pinned
    section — previously only the on-page note viewer could pin, edit, or delete.
  - "Move to folder" stays folder-tree-only; the other two views keep a quicker, flatter action list.
  - The folder-tree menu's "Move to folder" list now marks the note's currently-assigned folder with a
    checkmark, so it's clear at a glance where a note already lives.
  - The menu repositions itself to stay fully on-screen — flips above its trigger when there's no room below,
    and nudges back in bounds horizontally — instead of rendering partly off-screen near a viewport edge.

### Fixed

- A folder containing both notes of its own **and** a sub-folder didn't fully collapse — only the notes hid,
  the sub-folder stayed visible. Same underlying issue also let a collapsed row's own padding show through as
  a thin visible sliver. Both were the same root cause (a CSS grid collapse trick that only fully clips a
  single, padding-less child) and are now fixed for both the folder tree and the domain-grouped view.
- The "Move to…" folder menu could be clipped by the folder tree's own collapse-animation containers.
- Clicking a folder row only worked on the tiny chevron/name, despite the whole row's hover highlight
  suggesting otherwise — the whole row is clickable now.
- Each note now has a visible border for easier at-a-glance separation, and the hairline separators between
  website groups and top-level folders no longer sit flush against their neighbors.
- Patched five dependency vulnerabilities in dev-only build tooling (`shell-quote`, `adm-zip`, `tmp`, `uuid`,
  `esbuild` — none shipped in the extension bundle) and a flaky video-notes E2E assertion.

## [1.1.0] — 2026-08-01

Video Notes, Folders, and shortcut/settings improvements, delivered incrementally across nine PRs.

### Added

- **Video Notes** — press **Alt+V** to leave a note at the current moment in a video (a dedicated
  shortcut, independent of Alt+H — see "Changed" below).
  - A small quick-note popup appears above the video: autofocus textarea, Enter saves,
    Shift+Enter for a newline, Escape cancels — never pauses or otherwise interrupts playback.
  - Saved notes show as small timeline markers. On YouTube, markers align to YouTube's own
    progress bar; on any other HTML5 `<video>`, Hamesh draws its own marker rail docked to the
    video (native `<video controls>` render in an internal browser UI Hamesh can't draw on).
  - Markers fade with the surrounding player controls and reappear on hover or while paused, and
    stay out of the way of the player's own hover/click handling.
  - Hovering a marker shows a quick preview (first line of the note + timestamp). Notes close
    together in time cluster into a single marker; clicking a cluster opens a small list to jump
    to any of them.
  - Clicking a marker jumps the video to that moment and opens the note for viewing, editing,
    deleting, or pinning — without affecting playback (a playing video keeps playing, a paused
    one stays paused, and it's never auto-played).
  - Video notes appear in the Notes Library exactly like page notes, with a timestamp badge.
    Opening one from the Library seeks to that moment and opens its viewer, same as clicking its
    on-page marker.
  - Currently supports YouTube (a first-class adapter reading its own timeline UI) and any other
    page with a plain HTML5 `<video>` element, via a generic adapter. Architecture supports adding
    more site-specific adapters later without touching storage or the rest of the UI.
- **Folders** — organize notes into user-defined, arbitrarily nested folders in the Notes Library,
  independent of the automatic by-website grouping. A "By site / By folder" switch at the top of
  the list toggles between the two views; search works in either.
  - Any note can be filed into exactly one folder, regardless of which site it came from.
  - File a note into a folder from a "⋮ Move to…" menu on its row, or by dragging it directly
    onto a folder.
  - Create nested sub-folders, rename, and delete a folder — deleting one unfiles its notes (and
    its sub-folders' notes) rather than deleting them.
  - Each note shows a small favicon in folder view, since a folder can mix notes from different
    sites (unlike a website group, which by definition can't).
- **Settings** moved out of the popup's slide-in pane into a permanent page in the Notes Library
  (Sidebar → Settings), alongside the existing Language/Appearance controls. A new Shortcuts
  section shows the current Alt+H/Alt+V bindings and links to Chrome's own
  `chrome://extensions/shortcuts` page to change them — the only place Chrome allows a shortcut to
  be rebound. The popup's own Settings pane keeps Language/Appearance for quick access, plus a new
  "Open full settings" link to the rest.

### Changed

- **Alt+H** now always opens element selection; it no longer tries to detect whether you're
  hovering a video first. That earlier "one shortcut, context-aware" heuristic was unreliable on
  real sites — overlay UI on custom video players (play buttons, ad chrome, custom controls)
  defeated the hover detection often enough to cause real confusion between an element note and a
  video note — so video notes now use their own dedicated shortcut, **Alt+V**, instead.

## [1.0.0] — 2026-07-14

Notes Library: a dedicated page for browsing, finding, and returning to every note across every
site, delivered incrementally across three PRs.

### Added

- **Notes Library**, opened from the popup ("Notes Library →") as a new extension page listing
  every saved note, grouped by website.
  - Each website group shows the site's favicon (read from Chrome's own local favicon cache, no
    network request; falls back to a generated monogram), a note count, and expands/collapses to
    reveal its individual notes.
  - A **Continue** section surfaces the most recently active pages with notes for quick
    resumption.
  - **Search** filters notes by content or page (press `/` to focus the search box, `Escape` to
    clear it).
  - **Sort** website groups by most recent activity or alphabetically.
  - **Pin** a note to keep it at the top of its group, toggled from the note viewer.
  - Clicking a note or Continue card opens its page in a (new or existing) tab and automatically
    scrolls to and highlights the noted element — coordinated with the content script via a
    cross-tab messaging handshake, with no polling and no fixed waits.
  - A first-run empty state, a loading skeleton, and keyboard shortcuts round out the page.
- Foundation for automated Chrome Web Store release submission: architecture decision record,
  API research, a validated `docs/chrome-web-store/listing.yaml` source of truth for store
  listing copy, and unit-tested release-validation tooling (`pnpm release:validate`). No
  workflow automates uploads or submissions yet — see `docs/releases/CHROME_WEB_STORE_AUTOMATION.md`.

### Fixed

- The note viewer's pin toggle and close buttons rendered directly on top of the note's own
  text instead of clearing it, making the pin control very easy to miss. The card now reserves
  enough top padding for both corner buttons.
- Anchor resolution's `elementFromPoint` fallback path is now wrapped in the same defensive
  error handling as every other resolution strategy, preventing a possible uncaught exception in
  edge cases while restoring a note's position.

### Security & privacy

- New `favicon` permission, used only by the Notes Library page to read a website's favicon from
  Chrome's own local favicon cache — no network request is made, and it is never used from the
  content script. See `docs/chrome-web-store/PERMISSION_JUSTIFICATIONS.md`.

## [0.2.0] — 2026-07-10

Settings for Hamesh: a Settings screen in the popup with functional
language and appearance preferences, delivered incrementally across three
PRs.

### Added

- **Settings screen** in the popup, reachable from a new gear button next to
  the brand header, with a polished RTL-aware horizontal slide transition
  (respects `prefers-reduced-motion`, manages focus on navigation, closes on
  Escape).
- **Language preference:** choose English or Arabic from Settings. Persists
  across sessions and applies live — no reload — to the popup and every
  already-open tab, via `chrome.storage.onChanged`. Users with no saved
  preference keep today's behavior (follow the browser's UI language).
- **Appearance preference:** Match website (default — the original adaptive
  light/dark behavior, unchanged), Light, or Dark. A forced choice overrides
  the host page across every Hamesh-owned surface (popup, markers,
  composer, viewer); the host page itself is never modified. Persists and
  applies live across every open tab, same mechanism as language.
- Hamesh is now available on the **Chrome Web Store**; the landing page's
  install CTA links there (manual GitHub-release install is still available
  as a secondary option for developers).

### Changed

- `detectHostTheme` now also walks down single-child DOM chains to find a
  background set on a nested app-shell wrapper element (common in
  SPA-built sites whose `<body>`/`<html>` stay transparent), and — while
  "Match website" is active — reacts live to a host page's own dark-mode
  toggle or an asynchronously loaded theme, instead of only detecting once
  at load.

### Fixed

- The popup could render narrower than its intended width under Chrome's
  own popup auto-sizing, which can measure the document before the bundled
  stylesheet has applied. The width is now pinned explicitly through every
  layer, including an inline style present on the very first paint.

## [0.1.0] — 2026-07-08

First functional MVP of the Hamesh browser extension (Chrome, Manifest V3).

### Added

- **Contextual notes core flow:** activate (toolbar icon or **Alt+H**) → select a
  page element → write a note → it persists locally → a margin marker restores it
  in context on return, where it can be opened, edited, and deleted.
- **Precise selection mode** with an accent element outline and cursor hint, over
  any host background, without mutating host-page styles.
- **Multi-signal anchoring** with deterministic resolution (data-testid → id →
  aria-label → generated selector → text snippet → document position) and graceful
  fallback when the page changes.
- **Isolated UI:** a single React app mounted in one Shadow DOM root, isolated from
  host-page CSS and reliably layered above host stacking contexts.
- **Design system integration:** the approved Hamesh identity (margin-mark glyph,
  paper/ink/clay palette, IBM Plex type) as CSS tokens, with light/dark host
  adaptation.
- **Bilingual + RTL:** English (LTR) and Arabic (RTL) UI driven by the extension
  locale; note content uses `dir="auto"` for mixed scripts.
- **SPA awareness:** notes re-evaluate on `pushState`/`replaceState`/`popstate`
  and effective-URL changes.
- **Accessibility:** keyboard operation, visible focus rings, ARIA roles,
  non-color state cues, and reduced-motion support.
- **Bilingual landing page** (`landing/`) using the same identity.
- **Tests:** unit/integration (Vitest) for domain, storage, i18n, and theme; E2E
  (Playwright) driving the real extension UI through persistence, edit/delete, and
  SPA flows.

### Security & privacy

- Local-only: notes live in `chrome.storage.local`. No backend, accounts,
  analytics, telemetry, or network requests. Least-privilege permissions
  (`storage`, `activeTab`); no input/password values are ever read or stored.

[Unreleased]: https://github.com/mohammed-fandees/hamesh/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/mohammed-fandees/hamesh/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/mohammed-fandees/hamesh/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mohammed-fandees/hamesh/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/mohammed-fandees/hamesh/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mohammed-fandees/hamesh/releases/tag/v0.1.0
