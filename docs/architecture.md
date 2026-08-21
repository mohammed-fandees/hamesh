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
- listens for a runtime `ENABLE_SELECTION` / `ENABLE_VIDEO_NOTE` /
  `ENABLE_TEXT_NOTE` message (from popup/shortcut) and a `GET_PAGE_STATE`
  request (note count for the popup);
- broadcasts a runtime `CONTENT_READY` message at the same point it dispatches
  `hamesh:ready` (see below), and handles an incoming `RESTORE_NOTE` message —
  together these drive the Notes Library's Open Note flow (see below);
- exposes a deterministic `hamesh:activate` DOM-event hook for E2E automation
  (capability-equivalent to the toolbar button; documented in the source).

### 2. Background service worker (`src/entrypoints/background.ts`)

Minimal. Its only job is to listen for three keyboard commands and forward
the matching message to the active tab's content script: `activate-hamesh`
(**Alt+H**, default) → `ENABLE_SELECTION`, `activate-hamesh-video`
(**Alt+V**, default) → `ENABLE_VIDEO_NOTE`, and `activate-hamesh-text`
(**Alt+T**, default) → `ENABLE_TEXT_NOTE`. No DOM, no storage, no note
logic. All three bindings are user-customizable only via Chrome's own
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

**Contextual text note write:** finished selection (or Alt+T) →
`content/text-selection.captureTextSelection` → the action chip → an explicit
click → `domain/text-anchor.buildTextAnchor` → the same composer → `repo.create`
→ `chrome.storage.local` → note added to state → resolved via
`resolveTextAnchors` → highlight painted (see "Contextual text notes" below).

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

Text anchors have their own, deliberately stricter resolver — see "Contextual
text notes" below. It never returns `Fallback`: there is no equivalent of
"probably about here" for a run of text.

Resolution never throws on a changed page; it returns a quality
(`exact | probable | fallback | unresolved`). When a note's anchor can't be
resolved while its viewer is open, the viewer shows an "anchor unavailable" state
with a dashed connector. Anchors never store input/password values.

## Contextual text notes ("هوامش")

A note can also anchor to an exact run of text (`TextAnchor`) — the third
member of the `Anchor` union, and the case the union was designed for. A
contextual note is an ordinary `Note` in every other respect: same
repository, same `pageKey`, same viewer, same edit/delete/pin/folder/search,
same Open Note flow. Nothing about it is a parallel system; the only new
storage is the anchor itself.

### Two entry points, one flow

`content/text-selection.ts` owns _reading_ selections and nothing else:
`captureTextSelection()` decides whether there is an anchorable selection and
returns a **cloned range**. Cloning matters — clicking any external UI can
collapse the live selection, so the note must be built from what was
captured, not from what the selection has become.

Both entry points call the same `startTextNote(capture)` in `HameshApp`:

- the **selection action chip** (`ui/TextSelectionAction.tsx`), shown after a
  finished selection — detected on `mouseup`/`keyup`, never on
  `selectionchange` (which fires continuously mid-drag). `selectionchange` is
  used only to take the chip away, alongside Escape, a new mousedown, and a
  cleared selection. The chip opens nothing by itself; selecting text to read
  or copy stays completely ordinary.
- the **Alt+T shortcut**, which reads the live selection through the same
  function and is a no-op without one.

Neither carries any note logic. Saving goes through the same `handleSave` and
`repo.create` as an element note — the composer just carries a different
anchor.

### The anchor

`domain/text-anchor.ts` builds everything against **one normalized view of
the page's text** (`buildTextIndex`): whitespace runs collapse to a single
space, inline elements join without a separator, block boundaries and `<br>`
contribute one, and script/style/form-field/Hamesh subtrees are skipped. The
same index maps offsets back to DOM positions, so `exact`, `context`,
`textPosition`, and the highlighted range always describe the same
characters — including the range drawn immediately after saving.

| Field          | Purpose                                                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exact`        | The selected text, normalized. Also the user-facing "attached text".                                                                                                                                                                                          |
| `context`      | Up to 32 characters either side — how repeated text is told apart.                                                                                                                                                                                            |
| `textPosition` | Where it sat in the page's text. A tiebreak only, never sufficient alone.                                                                                                                                                                                     |
| `path`         | Element paths + offsets into each parent's own direct text — the fast path. Offsets are per-parent, not per-text-node, so ordinary text-node splitting by a re-render doesn't invalidate them.                                                                |
| `container`    | The nearest **id-bearing** ancestor, when there is one. Deliberately not a positional selector: a container is used to break ties between identical occurrences, and `p:nth-of-type(2)` starts pointing somewhere else the moment the page gains a paragraph. |
| `version`      | Anchor-format version, independent of `Note.schemaVersion`.                                                                                                                                                                                                   |

### Restoration (`domain/text-anchor-resolution.ts`)

`resolveTextAnchors` takes a **batch**, because the expensive step — building
the page-text index — should happen at most once per pass, and only if
needed:

1. **Revalidate** last pass's range (still connected, still the same text) —
   one string compare, no DOM walk. The common case.
2. **Fast path**: follow `path` to a range, then _validate_ its text.
3. Otherwise, build the index once and, for each remaining anchor, score
   every occurrence of `exact` by context similarity, original position, and
   whether it still sits inside the original container.
4. **Ambiguity protection**: with more than one candidate the winner must
   beat the runner-up by a clear margin _and_ have strong context. Otherwise
   the result is `Unresolved` — the note keeps its data and simply has no
   location on this page right now. A single short match with unrecognizable
   surroundings is refused too; a long distinctive quote is accepted even if
   everything around it changed.

The rule this exists to enforce: **never silently highlight the wrong
occurrence.** "Not found" is always a better answer than a plausible guess,
and it is a normal, non-destructive state — the viewer says the text couldn't
be found, exactly as an element note reports an unavailable anchor.

### Highlights (`content/text-highlights.ts`)

Painted with the **CSS Custom Highlight API** (`CSS.highlights` +
`::highlight()`), not wrapped `<mark>` elements. Nothing in the page is
inserted, split, or moved: no framework's virtual DOM is invalidated, no
event handler detached, no link covered, and cleanup is dropping a
registration. Ranges crossing nested inline elements and overlapping
highlights from two notes both work for free. The one cost is that a
highlight has no DOM node, so hover and click are hit-tested against
`range.getClientRects()` — the same coordinate approach the video timeline
markers already use. The `::highlight()` rules must live in the host page's
own stylesheet (a shadow-root rule would never reach the page), so a single
`<style data-hamesh>` element is injected into `document.head` and rewritten
in place when the theme changes; it is the only mark Hamesh leaves on the
page's DOM, and it is removed on teardown.

Clicking highlighted text opens the note, but only on `click`, never
`preventDefault`-ed, and never when the click produced a selection or landed
on a link/button — so selecting and copying highlighted text, and following a
link inside it, both keep working. Because a highlight is clickable, the
pointer says so: `::highlight()` carries no `cursor` property and there is no
element to put one on, so the injected page stylesheet also holds a
`cursor: pointer` rule gated on a `data-hamesh-text-hover` attribute that
`setTextHoverCursor` toggles on `<html>` only while the pointer is actually
over a highlight.

Hovering shows `ui/TextNotePopup.tsx`, which is not a lookalike of the video
marker's preview but literally carries `.hm-video-preview`: an accent dot and
the note's first line. It drops the timestamp (a video note is a moment; a
contextual note's text is already right there under the pill) and adds
interactivity — the read-only video preview is `pointer-events: none` so it
can't steal hover from the player, whereas this one must be reachable, since
the pointer has to travel from the words into it (hence the hover-intent
grace period) and clicking it opens the ordinary `NoteViewer`, where reading,
editing, deleting and pinning happen for this note exactly as for every
other one.

### Settings

`Preferences.textNotes` (`{ enabled, selectionAction }`, both default `true`)
— one nested object, in the same single preferences record as language and
appearance. `enabled` off stops new contextual notes and drops their
highlights; `selectionAction` off removes only the chip, leaving Alt+T. Both
are purely presentational as far as data goes: **no stored note or anchor is
ever written or deleted by toggling them**, and highlights return on
re-enabling. Changing `enabled` re-identifies `commitNotes`, which re-runs the
load effect and so re-resolves (or drops) every contextual highlight — no
separate "the setting changed" trigger.

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
permanent sidebar (`src/ui/Sidebar.tsx`) with three views — Library,
Settings, and What's New (see its own section below) — instead of Settings
being popup-only. A `?view=` query param lets another context deep-link
straight to one without a `view` state round-trip: the popup's own Settings
pane uses `?view=settings`, and the background's post-update tab uses
`?view=whats-new`. The sidebar is sticky and one viewport tall, so its
bottom-docked entry stays reachable however long the page's content runs.

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

## What's New (`src/domain/release-notes.ts`, `src/ui/WhatsNewView.tsx`)

A third destination in the Notes Library's sidebar, docked to the foot of
the column rather than sitting with Library and Settings — it isn't
somewhere you work, it's somewhere you go once after an update.

- **Content is typed data, not the changelog.** `CHANGELOG.md` is written
  for whoever maintains this repo (root causes, file names, PR groupings)
  and only in English; `RELEASE_NOTES` is the same history told to the
  person using Hamesh, in both interface languages. Keeping it as a plain
  array means no markdown parser in the bundle, no build step, and no
  network — and it makes the page checkable: `checkVersionConsistency`
  (`tooling/release/version.ts`) refuses to validate a tag whose version has
  no entry, so the page can't silently go stale behind a release.
- **Both languages, or neither.** A unit test asserts every release carries
  non-empty `en` _and_ `ar` for its title and every item, and that the
  Arabic actually contains Arabic script — a copied English string would
  otherwise pass a non-empty check and quietly ship as an "Arabic" note.
  Another asserts every version in `CHANGELOG.md` also appears here.
- **Opening it is reading it.** `Preferences.releaseNotes.lastSeenVersion`
  (same single record as every other persisted preference — no parallel
  storage) is written to the newest listed version as soon as the view
  mounts. `null` means "never opened", which deliberately differs from "has
  seen version X": the page shows the whole history to a first-time reader
  rather than claiming nothing is new. The sidebar's unread dot is derived
  from the same value, and the view deliberately does _not_ mirror the
  `watch()` callback back into local state, so entries stay marked "New"
  while they're being read instead of clearing under the reader's eyes.
- **Auto-open after an update.** `runtime.onInstalled` in the background
  opens `notes.html?view=whats-new` — but only when `shouldAnnounceUpdate`
  (a pure, unit-tested function) agrees: a real version-to-version update,
  moving forwards, that actually has notes to show. A fresh install, a
  browser update, and a developer reload of the same version all reach that
  listener too and are all deliberately silent. The tab opens in the
  **background** (`active: false`): an update can land mid-task, and seizing
  the foreground for a changelog is exactly the interruption Hamesh avoids.
  Chrome fires the event once per update, so no "already shown" bookkeeping
  is needed there.

The listener can't be driven from a test (`onInstalled` has no automatable
surface, the same gap `commands.onCommand` has), so the decision function is
unit-tested directly and `e2e/whats-new.spec.ts` proves the URL it opens
really does land on the page.

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
`handleMoveNote` — no duplicated move logic: `NoteActionsMenu.tsx` (a small
"⋮" dropdown, the only keyboard/screen-reader-accessible path — see "Note
actions menu" below) and native HTML5 drag-and-drop of a note onto a folder
node (a mouse-only progressive enhancement, folder-tree view only).

Because a folder can mix notes from several different sites (unlike a
website group, which by definition doesn't), `NoteRow` also grew an opt-in
`showDomain` prop — off by default, since the domain-grouped view already
shows one favicon per group header — that shows a small favicon + domain
line above the title, reusing `Favicon` the same way `PinnedSection`
already does for its own flat, cross-site list. `FolderTree` is the only
caller that passes it.

## Note actions menu

`NoteActionsMenu.tsx` is the "⋮" trigger + dropdown attached to every note
row in both the domain-grouped and folder-tree views (originally just a
folder-tree "Move to folder" menu, generalized once pin/edit/delete needed
a home outside the content-script `NoteViewer` too — being unable to
pin/edit/delete a note without leaving the Notes Library was reported as a
real gap in practice, the same category of gap that drove the video-note
viewer scope reversal above). `NoteRow` itself needed no structural change
for any of this — it's a full-row `<a>` that can't host a second
interactive control nested inside it, so the menu always renders as a
sibling (`.hm-folder-note` in folder mode, `.hm-group__note` in domain
mode), never a child.

The single portaled panel swaps between four views (`menu` /
`creatingFolder` / `editing` / `confirmingDelete`) rather than stacking
separate popovers — the same "inline swap, no modals" pattern `NoteViewer`
and `FolderNodeItem`'s own delete-confirm already use. Escape steps back
one view at a time (`editing`/`confirmingDelete` → `menu` → closed) instead
of always closing outright. Portaled to the trigger's own `.hm-scope`
ancestor (not `document.body`, which would escape the `--hm-*` design-token
scope those styles depend on) and positioned from `getBoundingClientRect()`
rather than CSS `position: absolute`, since the folder tree's collapse
animation relies on `overflow: hidden` on its row-list containers, which
would otherwise clip an in-flow popover the moment it needed to extend past
those ancestors' bounds.

`App.tsx` computes two different folder views for this: `folderTree` (the
nested tree actually rendered in folder mode, scoped to the
search-filtered notes) and a separate `flatFoldersForMenu` (every folder,
unfiltered) — the menu's own "Move to folder" section must always be able
to move a note into any folder, not just ones with currently-visible notes,
so it can't reuse `folderTree`'s filtered view.

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
- **Contextual text notes:** anchor generation and the whole restoration
  ladder are unit-tested against a real (jsdom) DOM — including repeated
  text, context disambiguation, changed/removed text, and the safety cases
  that must resolve to _nothing_ rather than to the wrong occurrence.
  `tests/content/HameshApp.text-notes.test.tsx` covers the interaction rules
  (selection alone opens nothing; the chip must be clicked; cancelling
  creates nothing; both settings; the shortcut with and without a selection).
  `e2e/text-notes.spec.ts` drives the real flow in Chromium — it is the only
  place `CSS.highlights` can actually be asserted, since jsdom has neither
  the Highlight API nor layout.
- **Notes Library E2E (`e2e/library-settings.spec.ts`, `e2e/library-folders.spec.ts`):**
  drive `notes.html` directly (no content-script fixture page needed) —
  sidebar/Settings navigation, the Chrome-shortcuts link-out,
  nesting/rename/cascade-delete-unfiles, both move-to-folder mechanisms
  (`NoteActionsMenu` and real drag-and-drop via Playwright's `dragTo`, which
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
  expanded website group, or a folder in folder mode). The Continue and
  Pinned sections' projections (`ContinueWebsite`, `PinnedNoteItem` in
  `notes-grouping.ts`) carry no anchor info, so a recently-active video note
  doesn't show its timestamp there. `PinnedSection` is the exception that
  shows the way: it already looks the full `Note` up by id (it needs one for
  `NoteActionsMenu`), so it reads `anchor` from that to show a contextual
  note's attached text — no projection reshaping required. The same trick
  would give it the video badge; Continue, being per-website rather than
  per-note, would need a real projection change.
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
- Contextual text notes deliberately don't anchor into `input`, `textarea`,
  or `contenteditable` regions, or across Shadow DOM boundaries — content
  Hamesh can't make promises about. Text hidden by CSS is indexed like any
  other (no per-node visibility check, which would be far too expensive for a
  whole-page index); at worst it makes a match ambiguous, which resolves to
  "not found" rather than to something wrong.
- A page whose text is entirely rewritten on every render (some virtualized
  lists) will resolve contextual notes by context matching on each settle
  pass rather than by the fast path. That is bounded — one index build per
  debounced pass, shared by every note — but it is the least efficient case.
- The UI creates one contextual note per selection. The data model has no such
  limit: several notes may anchor to the same or overlapping text, and
  storage, resolution, and highlighting all already handle it.
- Keyboard shortcuts (Alt+H/Alt+V/Alt+T) can only be rebound via Chrome's own
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
