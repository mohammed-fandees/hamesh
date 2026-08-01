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
- broadcasts a runtime `CONTENT_READY` message at the same point it dispatches
  `hamesh:ready` (see below), and handles an incoming `RESTORE_NOTE` message —
  together these drive the Notes Library's Open Note flow (see below);
- exposes a deterministic `hamesh:activate` DOM-event hook for E2E automation
  (capability-equivalent to the toolbar button; documented in the source).

### 2. Background service worker (`src/entrypoints/background.ts`)

Minimal. Its only job is to listen for two keyboard commands and forward the
matching message to the active tab's content script: `activate-hamesh`
(**Alt+H**, default) → `ENABLE_SELECTION`, and `activate-hamesh-video`
(**Alt+V**, default) → `ENABLE_VIDEO_NOTE`. No DOM, no storage, no note
logic. Both bindings are user-customizable only via Chrome's own
`chrome://extensions/shortcuts` page — see "Notes Library, Settings &
Shortcuts" below for why that's the _only_ place they can be changed.

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

**Video note write:** Alt+V → `getActiveAdapterMatch` → quick-note popup →
`domain/video-anchor.buildVideoAnchor` → `repo.create` → `chrome.storage.local`
→ note added to state → resolved via `resolveVideoAnchor` → marker rendered
on the timeline rail (see "Video Notes" below).

**Folder write:** create/rename/delete in `FolderTree` → the matching
`foldersRepo` method → `chrome.storage.local` (single `local:hamesh:folders`
key) → `watch()` delivers the updated array back to `App.tsx`. Filing a note
(menu or drag-and-drop) → `notesRepo.setFolder` → note's `folderId` updated →
`buildFolderTree` re-derives the tree (see "Folders" below).

## Open Note flow (Notes Library → original page)

The Notes Library (`src/entrypoints/notes/`) lists every note across every
page. Clicking a note or a "Continue" card needs to open that note's
original page in a new tab and, once it's loaded, scroll to the anchored
element, highlight it, and open the note — without a fragile fixed-wait
guess at how long the page will take to load.

This works via a small runtime-message handshake, orchestrated by
`src/entrypoints/notes/openNote.ts`:

1. `openNoteAndRestore(url, noteId)` registers a `runtime.onMessage`
   listener and a `tabs.onRemoved` listener, **then** calls
   `browser.tabs.create({ url })` — registering first closes the race
   between tab creation and the new tab's content script loading.
2. The new tab's content script (`content.ts`) reaches the same
   "React has mounted and wired up `activate`" milestone it already uses to
   dispatch the `hamesh:ready` DOM event (for E2E) — and, at that exact
   point, also broadcasts a `CONTENT_READY` runtime message. This is the one
   readiness signal driving both consumers.
3. `openNoteAndRestore`'s listener matches `CONTENT_READY` against the
   specific tab id it created, then sends that tab a `RESTORE_NOTE` message
   with the target note id, and tears down both listeners.
4. `content.ts` forwards `RESTORE_NOTE` into `HameshApp` via a
   `registerRestoreNote` callback (the same pattern as `registerActivate`).
   `HameshApp` records the pending id and, as soon as that note appears in
   its already-resolved notes (`resolved` — this may be immediately, or
   after the initial `getForPage` fetch completes, whichever is later),
   opens the note viewer, scrolls to the resolved element
   (`prefers-reduced-motion`-aware), and shows a brief accent highlight
   (`.hm-restore-highlight` in `tokens.css`, self-clearing after its CSS
   animation duration). If the anchor can't be resolved, the viewer still
   opens — same "anchor unavailable" state as any other note.
   **For a video note**, the same pending-id mechanism instead watches
   `videoResolved` and, once the target video resolves `Exact`, seeks
   `video.currentTime` — no viewer, no `play()`/`pause()` call (see "Video
   Notes" below for why).
5. A bounded safety-net timeout (15s) plus the `tabs.onRemoved` listener
   clean up the listeners if the target page never signals readiness (a
   page Hamesh can't run on, or the tab is closed first) — a leak-prevention
   fallback, not the readiness signal itself.

A plain left-click drives this flow (`isPlainLeftClick` in `openNote.ts`);
every note/Continue link is still a real `<a href target="_blank">`, so
middle-click, ctrl/cmd-click, and "open in new tab" all still work via the
browser's native handling — they just skip the restore.

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
- **Folders** (`src/storage/folders-repository.ts`) follow the same
  single-global-key pattern as preferences (`local:hamesh:folders` →
  `Folder[]`, not per-page), with a `watch()` subscription too. Each `Note`
  additionally carries an optional `folderId` pointing at one of these — see
  "Folders" below.

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

## Video Notes

A note anchors to either a DOM element (`ElementAnchor`, above) or a moment in
a video (`VideoAnchor`). `Note.anchor` is a discriminated union
(`domain/note.ts`) on a `type` field; `ElementAnchor.type` is optional so
every note stored before this union existed still discriminates as an
element anchor with no migration needed. `resolveAnchor` guards against being
called with a video anchor (returns `Unresolved` rather than touching fields
that don't exist on it); video anchors resolve separately via
`resolveVideoAnchor(note, adapters)` in `domain/anchor-resolution.ts`.

Video identity (`videoId`/`platform`) lives entirely in the anchor, not in
`pageKey` — `page-key.ts` stays untouched, deliberately avoiding a per-site
query-param allowlist. A page hosting several distinct videos under one URL
shape (e.g. every `youtube.com/watch` note) is handled by filtering at
resolution time: a video note only resolves `Exact` when the _currently
loaded_ video's adapter-derived id matches, the same way an element anchor
that can't be found simply resolves `Unresolved`.

### Video player adapters (`src/content/video-adapters/`)

Capability-driven, not site-driven — callers branch on
`capabilities.nativeTimeline`, never on adapter id. The `VideoPlayerAdapter`
interface (`types.ts`) covers: matching the current page, finding the active
video, a hit-region for "is the user interacting with this video",
resolving/producing a stable video id, whether a native timeline DOM exists
to align markers to, and whether the player's own controls are currently
visible.

- **`youtube.ts`** — matches youtube.com/m.youtube.com/youtu.be with the
  player DOM mounted; parses the video id from watch/shorts/embed/short-link
  URL shapes; aligns markers to `.ytp-progress-bar-container`; reads
  `.ytp-autohide` on the player container for controls-visibility (a real
  signal, not a guess).
- **`html5-generic.ts`** — the last-resort fallback for any page with a
  `<video>` element; derives an id from `currentSrc`/`src` with an ordinal
  fallback; has no native timeline (browsers expose no DOM for native
  `<video controls>` — a hard technical limit, not a shortcut) and
  approximates controls-visibility as `paused || video.matches(':hover')`.

`registry.ts` holds a priority-ordered list (YouTube first, generic HTML5
last, first `matches()` wins) mirroring `resolveAnchor`'s own signal
priority chain. Adding a new site (Vimeo, Coursera, …) is one more adapter
in this list — nothing in domain resolution, storage, or `HameshApp` needs
to change.

### Alt+H and Alt+V: two deterministic shortcuts, not one heuristic

An earlier design made a single Alt+H shortcut context-aware — video note if
hovering/focused on a video, element selection otherwise, via a hover/focus
heuristic in a now-deleted `src/content/video-context.ts`. That heuristic
proved unreliable on real sites in practice (real players layer overlay UI —
play buttons, ad chrome, custom controls — that defeats both DOM-containment
and pointer-coordinate hover checks often enough to cause real confusion
between "this made an element note" and "this made a video note"), so it was
replaced with two separate, pointer-independent commands:

- **Alt+H** (`activate-hamesh`) always opens element selection — the
  content script's `activate()` unconditionally calls `setSelecting(true)`.
- **Alt+V** (`activate-hamesh-video`) always opens the video quick-note for
  whichever video the page's adapter registry currently considers active
  (`getActiveAdapterMatch()` in `video-adapters/registry.ts`) — no hover or
  focus check at all, so it works regardless of where the pointer happens to
  be. A no-op if the page has no video right now.

Both are declared in `wxt.config.ts`'s `manifest.commands` with
`suggested_key` defaults; a user can rebind either from
`chrome://extensions/shortcuts`.

### Capture and timeline markers

`VideoQuickNote` (`src/ui/video/`) is the ≤3-second capture popup: autofocus
textarea, Enter saves, Shift+Enter newline, Escape closes, no visible
buttons or error state, positioned _above_ the video (`useFloatingAbove` in
`content/useFloating.ts` — below-first placement, which the element composer
uses, would sit on top of a video that's most of the viewport).

Markers render with `pointer-events: none` — deliberately not hit-testable
by the browser at all. A real, on-top, `pointer-events: auto` marker sitting
over a video steals mouse hover from the actual player element beneath it:
from YouTube's own perspective (or a native `<video controls>` scrubber's),
the pointer has left the player entirely the instant it's over a marker,
which hides _their_ controls too, and can flicker Hamesh's own marker in a
hide/show loop. Clicks and hover are instead detected by coordinate
proximity in `HameshApp`: a single `window`-level `pointerdown` listener
(capture phase, `preventDefault`/`stopPropagation` on a hit so the click
doesn't _also_ seek via the player's own scrubber underneath) and a
`pointermove` listener (rAF-coalesced, same pattern `useViewportFrame`
already uses for scroll/resize) drive marker clicks/hover respectively,
reading from refs rather than closing over state so they don't need to
re-subscribe on every scroll-driven recompute.

The generic-adapter fallback rail is docked just _below_ the video (not
overlapping it) — an earlier attempt placed it a few px inside the bottom
edge instead, to keep markers within the video's real-DOM hover region, but
that region is exactly where a native `<video controls>` scrubber lives:
clicks landing there are consumed by the browser's own native seek before
any page-level listener, capture phase included, ever sees the
`pointerdown`. Since the rail no longer overlaps the video, `videoMatches`
`:hover`-based controls-visibility (`html5-generic.ts`) wouldn't naturally
extend to a marker the user is pointing at; `effectiveVideoControlsVisible`
in `HameshApp` compensates by also treating "pointer is near a marker" (the
same coordinate tracking used for hover-preview) as "controls visible",
independent of the video's own hover/pause state.

Notes close enough together on the rail (`VIDEO_CLUSTER_THRESHOLD_PX`)
render as one `VideoMarkerCluster` (a larger dot with a count) instead of
overlapping dots — `domain/video-markers.ts`'s `clusterMarkers` groups by
chained adjacent-gap distance, the same shape map-pin clustering uses.
Hovering a marker shows `VideoMarkerPreview` (first line of the note +
timestamp); hovering a cluster shows a small "N notes" hint instead.
Clicking a cluster opens `VideoMarkerClusterList`, a real interactive
`.hm-card` (unlike the passive markers/preview, it only exists because the
user asked for it, so it doesn't have the hover-stealing problem those
solve for) listing each note timestamp-ordered; selecting one seeks to it,
same as a lone marker.

### Restore flow: video notes in the Notes Library

Video notes appear in the Notes Library exactly like element notes — no
changes needed to `groupNotesByDomain`, `filterNotesByQuery`,
`derivePageLabel`, or the Continue/Pinned projections, since they were
already generic over `content`/`originalUrl`/`pageContext.title`. `NoteRow`
adds a small timestamp badge (`▶ 13:27`) when `note.anchor.type === 'video'`.

Clicking a video marker (or a note in a cluster list) both seeks
`video.currentTime` to the stored timestamp _and_ opens the note's viewer —
`FloatingVideoViewer`, a thin wrapper around the same anchor-agnostic
`NoteViewer` used for element notes (its `handleUpdate`/`handleDelete`/
`handleTogglePin` needed no changes), anchored above the marker's own rail
position via `useFloatingAbove` rather than a resolved DOM element (a video
note has no page element to anchor to). This was a deliberate scope reversal
from an earlier "seek-only" design, made because clicking a marker with no
way to edit/delete/pin the note it represents was reported as a real gap in
practice. The Open Note flow (below) does the same seek-and-open for
consistency. Never calls `play()`/`pause()` either way (a fresh tab's video
is left in whatever state it loaded in). On a heavy SPA like YouTube the
`<video>` element may not exist yet even after `CONTENT_READY`; the same
debounced `MutationObserver` re-resolution that already re-attaches
element-anchor markers as content mounts also re-runs video resolution, so
the restore check (a render-time "adjust state" pattern, not a polling loop)
simply re-evaluates each time `videoResolved` changes until the video
appears.

## Notes Library, Settings & Shortcuts

`src/entrypoints/notes/App.tsx` (the Notes Library page, `notes.html`) has a
permanent sidebar (`src/ui/Sidebar.tsx`) with two views — Library and
Settings — instead of Settings being popup-only. A `?view=settings` query
param lets another context (the popup's own Settings pane) deep-link
straight to it without a `view` state round-trip.

`LibrarySettingsView.tsx` reuses the same Language/Appearance controls as
the popup's `SettingsView`, plus a Shortcuts section showing both commands'
current bindings (read via `browser.commands.getAll()`) and a link to
`chrome://extensions/shortcuts`. That link is the _only_ way to change
either binding: Chrome's `commands` API exposes only `getAll`/`onCommand` at
runtime — `update`/`reset`/`openShortcutSettings` are a Firefox-only
WebExtensions addition that happens to still appear in the cross-browser
polyfill's aspirational types, which is misleading enough to be worth
calling out explicitly here (confirmed by direct probing against a real
Chromium build, not assumed from the types). The popup's own shortcut badge
is fetched live from the same `commands.getAll()` call rather than
hardcoded, so it can't go stale if a user rebinds Alt+H there.

## Folders

A user-defined folder system, independent of the automatic by-website
grouping `groupNotesByDomain` already provides. Two design choices anchor
everything else:

- **Folder membership lives on the note, not a separate mapping.** `Note`
  carries one additive optional field, `folderId?: string` — absent means
  unfiled, the same convention as `pinned?`. `setNoteFolder` (`domain/note.ts`)
  follows `setNotePinned`'s pattern exactly: filing a note isn't editing its
  content, so it doesn't touch `updatedAt`.
- **Folders are their own storage entity — one global object, not
  per-page.** `src/storage/folders-repository.ts` mirrors
  `preferences-repository.ts` (a single fixed key, whole-array
  read-modify-write, `watch()` for live cross-context sync via
  `chrome.storage.onChanged`) rather than `notes-repository.ts`'s
  per-`pageKey` keying, since a folder tree isn't tied to any one page.
  Folders are stored **flat**, each with a `parentId: string | null`; the
  nested tree a user actually sees is a pure _derived_ structure —
  `buildFolderTree` (`domain/folder-grouping.ts`) — the same relationship
  `groupNotesByDomain` has to the flat `Note[]` it derives view-data from.

`FolderTree.tsx` renders the result: recursive expand/collapse (reusing
`WebsiteGroup`'s CSS grid-rows pattern), inline create/rename/delete (the
same inline two-step confirm `NoteViewer` uses for deleting a note — no
modals anywhere in this codebase), and a synthetic "Unfiled" node for notes
with no `folderId` (or one pointing at a folder that no longer exists —
`buildFolderTree` degrades that to unfiled rather than throwing, same
philosophy as `extractDomain`'s malformed-URL fallback). **Deleting a folder
never deletes notes** — `getDescendantFolderIds` collects the folder and
every descendant, `folders-repository`'s `remove()` cascades the folder-tree
deletion, and the caller (`App.tsx`'s `handleDeleteFolder`) separately calls
`notes-repository`'s `setFolder(id, pageKey, undefined)` on every note that
belonged to any of them — `folders-repository` and `notes-repository` stay
decoupled from each other, so this two-step orchestration lives in the UI
layer, not either repository.

A `SegmentedControl<'domain' | 'folder'>` (the same generic component
already used for Language/Appearance/Sort) toggles the Notes Library's main
list between `groupNotesByDomain`'s output and the folder tree; both read
from the same search-filtered `Note[]`, so search keeps working in either
mode. Filing a note into a folder works two ways, both calling the same
`handleMoveNote` — no duplicated move logic: `MoveToFolderMenu.tsx` (a
small "⋮" dropdown, the only keyboard/screen-reader-accessible path) and
native HTML5 drag-and-drop of a note onto a folder node (a mouse-only
progressive enhancement). `NoteRow` itself needed no structural change for
either — it's a full-row `<a>` that can't host a second interactive control
nested inside it (see the Known Limitations note on pinning below), so the
move menu renders as a sibling, not a child.

Because a folder can mix notes from several different sites (unlike a
website group, which by definition doesn't), `NoteRow` also grew an opt-in
`showDomain` prop — off by default, since the domain-grouped view already
shows one favicon per group header — that shows a small favicon + domain
line above the title, reusing `Favicon` the same way `PinnedSection`
already does for its own flat, cross-site list. `FolderTree` is the only
caller that passes it.

**Post-ship bug fixes**, found via real usage rather than at review time:

- **A collapsed folder with both direct notes and a sub-folder stayed
  partially expanded.** `.hm-folder-node__body`'s `grid-template-rows: 0fr`
  collapse trick only clips a _single_ grid item — with the notes `<ul>`
  and the sub-folder `<ul>` as two separate direct children, CSS grid
  auto-placement puts the second one into its own implicit row (sized
  `auto` by default), which never collapses. A folder with only a
  sub-folder (and no notes of its own) could look correctly fixed while the
  actually-reported combination — both together — still leaked. Fixed by
  wrapping both in one `.hm-folder-node__body-inner` element (mirrored for
  `.hm-group__body`/`.hm-group__body-inner` in the domain-grouped view,
  which has the same collapse mechanism for a different reason — see next).
- **The same collapse trick also let a direct child's own padding leak past
  a "collapsed" (0px) row**, even with `overflow: hidden`/`min-height: 0`
  on that child — those only cancel the child's _content_ driving a larger
  minimum, not its own padding, which the grid track's base-size
  calculation still counts. Same `-inner`, padding-less wrapper fix.
- **The "Move to…" menu was clipped by the folder tree's own
  `overflow: hidden` collapse containers**, since a `position: absolute`
  popover nested in place is clipped by an ancestor's `overflow: hidden`
  just like any other descendant. Fixed by portaling `MoveToFolderMenu`'s
  panel to the trigger's `.hm-scope` ancestor (not `document.body`, which
  would escape the `--hm-*` design-token scope those styles depend on) and
  positioning it via `getBoundingClientRect()` instead.
- **A folder row's hover highlight spans its full width, but only the tiny
  chevron and the name text were actually clickable** — the folder glyph
  icon and the row's own padding were dead zones despite looking clickable.
  Fixed by adding a click handler to the row itself that only fires for
  clicks landing on the row's own box (`e.target === e.currentTarget`), and
  making the purely-decorative glyph/count `pointer-events: none` so clicks
  on them fall through to the row.
- Assorted spacing polish found alongside the above: a border on
  `.hm-note-row` for easier at-a-glance separation between notes (there
  was previously no per-note visual boundary at all), and breathing room
  around the hairline separators between website groups
  (`.hm-groups > li + li`) and top-level folders
  (`.hm-folder-tree__list > li + li`), which sat flush against their
  neighbors.

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
- **E2E (Playwright):** drives the real Shadow DOM UI through the critical flows
  (persistence; edit + delete; SPA navigation) plus the Notes Library's Open
  Note flow (`e2e/notes-library-open.spec.ts`) — the one place that exercises
  the real cross-tab `CONTENT_READY`/`RESTORE_NOTE` handshake and its timing,
  which a jsdom component test can't. See README for the headless/HTTP
  requirements.
- **Video Notes E2E (`e2e/video-notes.spec.ts`):** drives the generic HTML5
  adapter path against a self-hosted `<video>` fixture (`e2e/fixtures/`) — a
  tiny locally-generated MP4, served with real HTTP Range support (Chromium
  reports a video's `seekable` ranges as degenerate/unseekable without it,
  even for a small fully-buffered file). YouTube's own adapter is
  unit/fixture-tested instead (a saved player DOM shape), consistent with
  this project's no-live-network testing policy.
- **Notes Library E2E (`e2e/library-settings.spec.ts`, `e2e/library-folders.spec.ts`):**
  drive `notes.html` directly (no content-script fixture page needed) —
  sidebar/Settings navigation, the Chrome-shortcuts link-out,
  nesting/rename/cascade-delete-unfiles, both move-to-folder mechanisms
  (`MoveToFolderMenu` and real drag-and-drop via Playwright's `dragTo`, which
  dispatches genuine HTML5 DnD events — raw mouse-move simulation does not),
  search within folder mode, and RTL.
- **CI:** typecheck, lint, format check, unit tests, build. E2E is run locally
  (needs real Chromium + `--headless=new`).

## Known limitations & future extension points

- Fonts fall back to system faces; self-host the IBM Plex subset for production
  (the extension CSP blocks live Google Fonts, and the handoff calls for
  self-hosting).
- Multiple notes on one element render as stacked markers; the grouped count
  badge from the design is not yet wired (the `Marker` component already
  accepts a `badge` prop for this — it's just never passed a value > 1 today).
  Unrelated to the Notes Library; a candidate for a future on-page-marker pass.
- Text-snippet matching is exact only.
- Pinning is toggled only from the content-script `NoteViewer`, not from the
  Notes Library's own rows — those are already a single full-row link, and a
  second interactive control can't nest inside an `<a>`. The Notes Library
  reflects pin state (badge + sort-to-top + a dedicated "Pinned" section)
  without letting you toggle it there; open the note to change it.
- Extension points: new storage backends via `NotesRepository`; additional
  anchor signals slot into the priority chain; a future side panel can reuse the
  tokens and repository.
- `Note.workspaceId` is a real, required field, but there is no workspace
  feature yet — every note is stamped with a single implicit
  `DEFAULT_WORKSPACE_ID` (`domain/workspace.ts`) and there is no UI to
  create/switch workspaces. Deliberately built ahead of the feature so a
  future multi-workspace pass is additive (filter by an already-present
  field) rather than another schema migration.
- The video timestamp badge (`▶ 13:27`) only appears on `NoteRow` (inside an
  expanded website group, or a folder in folder mode) — the Continue and
  Pinned sections' projections (`ContinueWebsite`, `PinnedNoteItem` in
  `notes-grouping.ts`) don't carry anchor info today, so a pinned or
  recently-active video note doesn't show its timestamp in those two places.
  Would need extending those projection functions, not just the row
  components.
- The `Anchor` union (`ElementAnchor | VideoAnchor`) is designed so a future
  anchor kind (PDF page/region, image, audio timestamp, document range) is
  another union member plus another `resolve*Anchor` function — nothing
  about `NotesRepository`, the Notes Library, or the Open Note flow assumes
  there are only two kinds.
- No folder reparenting UI — a folder's `parentId` is set once at creation
  (either top-level, or as a direct child of the folder whose "+" created
  it) and never changed after. Drag-and-drop in the Notes Library moves
  _notes_ into folders, not folders within the tree. An isolated, additive
  follow-up if wanted (`folders-repository.ts` would need a `move()`, plus
  cycle-prevention when reparenting into one of the folder's own
  descendants — `getDescendantFolderIds` already provides exactly that
  check).
- Keyboard shortcuts (Alt+H/Alt+V) can only be rebound via Chrome's own
  `chrome://extensions/shortcuts` page, linked from Settings — see "Notes
  Library, Settings & Shortcuts" above for why there's no in-app editor.

## Development note: TypeScript coverage of test files

`tsconfig.json`'s `include` originally listed `tests/**/*.ts` but not
`tests/**/*.tsx` — meaning `pnpm typecheck` silently never checked any
React component test (`.test.tsx`), across every phase of this project.
Fixed in the Notes Library PR3 pass; it immediately caught two real (if
narrow) type errors in existing test mocks. If you add a new `.test.tsx`
file, it's now covered — if `pnpm typecheck` ever stops catching a test
file's type errors again, check this `include` list first.
