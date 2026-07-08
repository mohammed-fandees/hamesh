# Changelog

All notable changes to Hamesh are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/mohammed-fandees/hamesh/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mohammed-fandees/hamesh/releases/tag/v0.1.0
