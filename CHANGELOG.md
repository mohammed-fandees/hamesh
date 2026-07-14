# Changelog

All notable changes to Hamesh are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/mohammed-fandees/hamesh/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mohammed-fandees/hamesh/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/mohammed-fandees/hamesh/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mohammed-fandees/hamesh/releases/tag/v0.1.0
