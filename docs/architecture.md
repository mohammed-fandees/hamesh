# Hamesh Architecture

## Runtime contexts

### 1. Content script (`src/entrypoints/content.ts`)

The heart of the extension. Injected on `<all_urls>` at `document_idle`. It:

- mounts one React app (`HameshApp`) inside a **single Shadow DOM root** created
  with WXT's `createShadowRootUi` (`cssInjectionMode: 'ui'`, so the design-token
  stylesheet is injected into the shadow root and isolated from the host page);
- owns all note CRUD directly through `NotesRepository` (it has the page context
  and page key, so no background round-trip is needed);
- restores markers on load and re-evaluates on SPA navigation;
- listens for a runtime `ENABLE_SELECTION` message (from popup/shortcut) and a
  `GET_PAGE_STATE` request (note count for the popup);
- exposes a deterministic `hamesh:activate` DOM-event hook for E2E automation
  (capability-equivalent to the toolbar button; documented in the source).

### 2. Background service worker (`src/entrypoints/background.ts`)

Minimal. Its only job is to listen for the `activate-hamesh` keyboard command
(**Alt+H**) and forward `ENABLE_SELECTION` to the active tab's content script.
No DOM, no storage, no note logic.

### 3. Popup (`src/entrypoints/popup/`)

A small "doorway, not a dashboard": brand mark, count of notes on the current
page, an **Add a note** button (sends `ENABLE_SELECTION` to the tab), an
active/unavailable status, and a **Settings** entry point. Uses the same
design tokens.

`App.tsx` holds two panes — Home and Settings (`src/ui/SettingsView.tsx`) —
inside a `.hm-popup__track` that always renders both (so the CSS transform
slide has something to animate between) and clips through an
`overflow:hidden` `.hm-popup__viewport`. Navigation direction mirrors for
RTL: the track's `translateX` sign flips with `dir`, and the back chevron
(`SettingsView`) flips the same way `MarginMark`/`Marker` already do. The
inactive pane is marked `inert` + `aria-hidden` so it's unreachable by
keyboard/AT while off-screen; focus moves to the Settings heading on entry
and back to the trigger button on return (both via `focus({ preventScroll:
true })` — the viewport's `overflow:hidden` still makes it a programmatic
scroll container, so a plain `.focus()` on the off-screen pane would
auto-scroll it out of sync with the transform). The reduced-motion override
in `tokens.css` (`.hm-scope * { transition: none !important }`) already
covers the track, since the transition lives in the CSS class, not inline
style.

Language and Appearance are both live segmented controls
(`SegmentedControl<T>` in `SettingsView.tsx`, backed by native
`<input type="radio">` — grouped Tab stop and arrow-key switching are then
just native radio-group behavior, not custom JS). Language shows text
options (two languages fit easily); Appearance shows small icon options
(sun/moon/half-circle) instead of text — three full labels (in either
language) wouldn't stay compact in a 252px-wide row, whereas 14px icons do,
each still carrying its accessible name via the wrapping `<label>`'s
`aria-label`. The popup has no host webpage of its own, so "Match website"
resolves to the OS `prefers-color-scheme` there (`prefersDark`, unchanged
from before Appearance existed) rather than anything tab-specific —
deliberately not querying the active tab's detected theme from the popup,
to avoid adding cross-context messaging for a surface that's only open for a
few seconds at a time.

## The content-side React app (`src/content/HameshApp.tsx`)

A single component orchestrates all page UI and state so there is exactly one
source of truth and one Shadow DOM root:

- **Selection mode** — a transparent capture overlay tracks the hovered element
  (via `elementFromPoint`, temporarily making the overlay click-through so it
  reads the host element beneath), draws the accent outline + cursor hint, and on
  click builds an anchor and opens the composer. Escape cancels.
- **Markers** — one per resolved note, positioned with fixed coordinates from
  `getBoundingClientRect`, docked in the element's inline-start margin
  (inline-end in RTL). Positions recompute on a rAF-coalesced scroll/resize frame
  and hide when the anchor scrolls out of view.
- **Composer / Viewer** — floating cards positioned by `useFloating` (prefers
  below the anchor, flips above near the bottom edge, clamps into the viewport,
  follows scroll). Outside-click (via `composedPath`) and Escape close them.
- **Theme** — `hostTheme` state holds what `detectHostTheme` (see below)
  currently detects on the page; the rendered `theme` is
  `appearance === 'match-website' ? hostTheme : appearance` (`appearance` is
  loaded from / subscribed to `PreferencesRepository`, same as `lang`).
  `hostTheme` is always kept current regardless of `appearance`, so
  switching back to "Match website" is instant. The mark colours are always
  Hamesh's own regardless of theme.
- **Direction/locale** — `lang` is state, seeded from the browser's UI
  language (`initialLang` prop, resolved synchronously in `content.ts` before
  React even mounts — today's exact behavior for anyone who hasn't opened
  Settings) and then loaded from / subscribed to `PreferencesRepository`. A
  language or appearance choice made in the popup's Settings screen reaches
  every open tab immediately via `storage.watch` (backed by
  `chrome.storage.onChanged`, which already broadcasts across all extension
  contexts) — no runtime messaging needed. `strings`/`dir` are derived from
  `lang` on every render.

Pointer-events discipline: the shadow container is `pointer-events: none`; only
the capture overlay, markers, and cards opt back in, so Hamesh never blocks the
host page when idle.

## Theme detection (`src/content/theme.ts`)

`detectHostTheme` is a pragmatic, deterministic DOM heuristic — not a
computer-vision pass — that only Match Website mode consults (Light/Dark
skip it entirely):

1. Walk up from `<body>` through `parentElement` (→ `<html>`) for the first
   opaque `background-color`; use its luminance. Handles the common case,
   including a transparent `<body>` deferring to `<html>`.
2. If nothing opaque was found, walk _down_ from `<body>` through
   single-child chains (the common `body > #root > .app-shell > …` SPA
   shape) for up to 12 levels, sampling each for a background. This is what
   catches nested app shells that leave `body`/`html` transparent and put
   the real background on a wrapper div — deliberately bounded and
   deterministic (no `elementFromPoint`/viewport dependency, so it doesn't
   change with scroll position and stays unit-testable). It stops at the
   first branching point (an element with more than one child) rather than
   guessing which branch matters.
3. Still nothing → fall back to `prefers-color-scheme`; still nothing →
   default light.

By design, step 1 wins over a more deeply-nested surface: a dark page shell
with a lighter reading card inside still reads as "dark" — Hamesh matches
the page's overall chrome, not a specific element's local background. This
was true before Phase 3 too; the down-walk (step 2) is the actual behavior
change, added because nested app shells are common enough to be worth the
bounded extra walk.

**Staying current while a tab is open:** a `MutationObserver` (active only
in Match Website mode) watches `class`/`style` attribute changes on
`<html>`/`<body>` — the two places a page's own dark-mode toggle or an
async-loaded theme typically lands — debounced 200ms, plus a
`prefers-color-scheme` `change` listener for pages that key off the OS
setting with no explicit background of their own. This is separate from
(and much narrower than) the existing anchor-resolution `MutationObserver`
below, which watches the whole subtree for content changes.

## Data flow

**Write:** selection click → `domain/anchor.buildElementAnchor` → `repo.create`
→ `chrome.storage.local` → note added to state → resolved → marker rendered.

**Read on load / navigation:** `generatePageKey(location.href)` →
`repo.getForPage` → `domain/anchor-resolution.resolveAnchor` per note → markers
for resolved notes.

## Storage boundary

- Backend: `chrome.storage.local` only, via the `NotesRepository` interface
  (`src/storage/notes-repository.ts`).
- Key format: `hamesh:notes:<pageKey>` → `Note[]`.
- Deserialization defensively filters malformed entries, so corrupted or
  partially-written storage never throws.
- No external APIs, no network, no sync. A future backend can implement the same
  interface.
- **Preferences** (`src/storage/preferences-repository.ts`) follow the same
  pattern at a single key, `hamesh:preferences` → `Preferences`
  (`src/domain/preferences.ts`: `{ schemaVersion, language, appearance }`) —
  one object, not a parallel storage mechanism per setting. `language`
  defaults to `null` ("no explicit choice — follow the browser's UI
  language"); `appearance` defaults to `'match-website'` (today's only prior
  behavior). Both mean existing installs with nothing stored — including
  ones that only ever saved a Phase 2 `{ schemaVersion, language }` object,
  with no `appearance` field at all — see no behavior change.
  `parsePreferences` defensively falls back to the default for missing,
  malformed, or unrecognized values in either field, same as notes.

## Anchoring strategy

Multi-signal, deterministic, priority-ordered (`resolveAnchor`):

| Priority   | Signal                                  | Method                      |
| ---------- | --------------------------------------- | --------------------------- |
| 1 Exact    | `primarySelector` (generated CSS)       | `querySelector`             |
| 2 Probable | `dataAttributes`                        | attribute selector (unique) |
| 3 Probable | `testId` / `id` / `ariaLabel`           | unique match among tag      |
| 4 Probable | `href` / `src` / `textSnippet` / `role` | unique match among tag      |
| 5 Probable | `classNames`                            | unique class selector       |
| 6 Fallback | document position                       | `elementFromPoint`          |
| —          | none                                    | Unresolved                  |

Resolution never throws on a changed page; it returns a quality
(`exact | probable | fallback | unresolved`). When a note's anchor can't be
resolved while its viewer is open, the viewer shows an "anchor unavailable" state
with a dashed connector. Anchors never store input/password values.

## Page identity

`generatePageKey` normalizes: `http`→`https`, lowercased host, default ports
stripped, trailing slash removed (except root), hash removed, and **all query
parameters stripped by default** (configurable `keepQueryParams`). Predictable
and unit-tested. Rationale: most query params (tracking, session) don't change
page identity for annotation purposes; a stricter policy can opt specific params
back in.

## SPA navigation

`src/content/navigation.ts` patches `history.pushState`/`replaceState` and
listens for `popstate`, notifying the app to recompute the page key and reload
notes. Generic by design — no framework-router coupling. Complex dynamic SPAs
may need the debounced `MutationObserver` re-resolution (also implemented) to
re-attach markers as content mounts.

## Testing strategy

- **Unit/integration (Vitest):** domain purity (page-key, anchor build +
  resolution incl. ambiguous/duplicate cases, validation), repository
  serialize/deserialize + CRUD, i18n, and theme luminance. Browser APIs are
  mocked at the boundary.
- **E2E (Playwright):** drives the real Shadow DOM UI through both critical flows
  (persistence; edit + delete). See README for the headless/HTTP requirements.
- **CI:** typecheck, lint, format check, unit tests, build. E2E is run locally
  (needs real Chromium + `--headless=new`).

## Known limitations & future extension points

- Fonts fall back to system faces; self-host the IBM Plex subset for production
  (the extension CSP blocks live Google Fonts, and the handoff calls for
  self-hosting).
- Multiple notes on one element render as stacked markers; the grouped count
  badge from the design is not yet wired.
- Text-snippet matching is exact only.
- Extension points: new storage backends via `NotesRepository`; additional
  anchor signals slot into the priority chain; a future side panel can reuse the
  tokens and repository.
