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
page, an **Add a note** button (sends `ENABLE_SELECTION` to the tab), and an
active/unavailable status. Uses the same design tokens.

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
- **Theme** — `detectHostTheme` samples the host background luminance to pick
  Hamesh's light or dark palette; the mark colours are always Hamesh's own.
- **Direction/locale** — resolved once from the extension UI language.

Pointer-events discipline: the shadow container is `pointer-events: none`; only
the capture overlay, markers, and cards opt back in, so Hamesh never blocks the
host page when idle.

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
