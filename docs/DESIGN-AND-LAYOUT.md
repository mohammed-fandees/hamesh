# Hamesh — Layout, Design & Visual Reference

A complete map of how every surface in Hamesh is laid out and looks: the design
tokens it is all built from, the toolbar popup, the Notes Library, Settings,
What's New, Teams (overview / people / notes / comments / mentions / billing),
and the in-page overlay UI (selection mode, composer, viewer, markers, video).

**Source of truth:** `src/ui/tokens.css` (tokens + what a web page needs),
`src/ui/pages.css` (what the popup and the Library share),
`src/ui/notes-library.css` (`notes.html`-only), `src/ui/teams/teams.css`
(Teams-only), `src/entrypoints/popup/App.css` (popup-only). Components:
`src/ui/kit/` (primitives), `src/ui/library/`, `src/ui/settings/`,
`src/ui/teams/`.

**Version documented:** 1.4.0 after the module/design refactor (see
[`FEATURE-MODULE-AUDIT.md`](./FEATURE-MODULE-AUDIT.md) §0). Paths refer to the
working tree.

---

## Table of contents

1. [What Hamesh is, and how many surfaces it has](#1-what-hamesh-is-and-how-many-surfaces-it-has)
2. [Design foundations](#2-design-foundations)
3. [The brand glyph: MarginMark](#3-the-brand-glyph-marginmark)
4. [Toolbar popup](#4-toolbar-popup)
5. [Notes Library page](#5-notes-library-page)
6. [Settings](#6-settings)
7. [What's New](#7-whats-new)
8. [Teams](#8-teams)
9. [In-page overlay UI](#9-in-page-overlay-ui)
10. [Cross-cutting behaviour](#10-cross-cutting-behaviour)
11. [Known visual defects](#11-known-visual-defects)

---

## 1. What Hamesh is, and how many surfaces it has

Hamesh is a Chrome MV3 extension (WXT + React 19) that attaches a note to a
specific element, piece of text, or video timestamp on any web page. It is
local-only: `chrome.storage.local`, no backend, no accounts (Teams is opt-in
and optional at the manifest level).

Five distinct visual surfaces ship:

| #   | Surface                                               | File                                                       | Rendering root                                       |
| --- | ----------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| 1   | **In-page overlay**                                   | `src/entrypoints/content.ts` + `src/content/HameshApp.tsx` | One React app in a **Shadow DOM** host on every page |
| 2   | **Toolbar popup**                                     | `src/entrypoints/popup/`                                   | Own document, 300 px wide, two sliding panes         |
| 3   | **Notes Library** (`notes.html`)                      | `src/entrypoints/notes/` + `src/ui/*.tsx`                  | Own document: sticky sidebar + reading column        |
| 4   | **What's New** (`notes.html?view=whats-new`)          | `src/ui/WhatsNewView.tsx`                                  | Same document as #3, different view                  |
| 5   | **Teams** (`notes.html?view=teams`, `?view=mentions`) | `src/ui/teams/`                                            | Same document as #3, wider column                    |

Surfaces 3–5 are **one document with one sidebar** and five views
(`library | settings | teams | mentions | whats-new`, `src/ui/library/Sidebar.tsx`).

```
notes.html
└─ div.hm-scope.hm-notes-page[data-hm-theme][dir]
   ├─ nav.hm-sidebar                       216px, sticky, 100vh (≤720px: a top bar)
   │  ├─ .hm-sidebar__brand                MarginMark + "Hamesh"
   │  ├─ ul.hm-sidebar__nav                Notes Library · Teams · Mentions · Settings
   │  └─ ul.hm-sidebar__nav--foot          What's New (margin-top:auto)
   └─ main.hm-page                         flex:1
      └─ .hm-page__inner                   max-width 680px (920px for the Teams overview)
```

---

## 2. Design foundations

All tokens are declared on **`:host, .hm-scope`** — never `:root`
(`tokens.css:14-15`). This is deliberate: content-script UI lives in a shadow
root on arbitrary pages, and extension pages use an inner `.hm-scope` wrapper
rather than setting attributes on `<html>`/`<body>`. Anything portalled to
`document.body` must therefore be re-scoped (see
[NoteActionsMenu](#58-note-actions-menu-the-shared-⋯-row-menu)).

### 2.1 Colour

Light is the default theme; dark is a full token override on
`[data-hm-theme='dark']`.

| Token                  | Light                | Dark                    | Role                                             |
| ---------------------- | -------------------- | ----------------------- | ------------------------------------------------ |
| `--hm-ink`             | `#1e1b18`            | `#f3ede3`               | Primary text (warm near-black / warm near-white) |
| `--hm-ink-60`          | `rgba(30,27,24,.62)` | `rgba(243,237,227,.62)` | Secondary text, nav items, links                 |
| `--hm-ink-40`          | `rgba(30,27,24,.42)` | `rgba(243,237,227,.45)` | Tertiary: timestamps, captions, hints            |
| `--hm-ink-20`          | `rgba(30,27,24,.18)` | `rgba(243,237,227,.2)`  | Hovered row border, dashed chips                 |
| `--hm-ink-10`          | `rgba(30,27,24,.08)` | `rgba(243,237,227,.09)` | "Installed" badge fill                           |
| `--hm-paper`           | `#f7f3ec`            | `#16140f`               | Page background (warm parchment)                 |
| `--hm-paper-dim`       | `#efe7d8`            | `#211e18`               | Skeletons, shortcut chips, folder tiles          |
| `--hm-surface`         | `#ffffff`            | `#262219`               | Cards, inputs, popup background                  |
| `--hm-accent`          | `#b5502f`            | `#e08b5c`               | **Muted clay** — primary brand colour            |
| `--hm-accent-strong`   | `#8f3e22`            | `#f0a578`               | Accent text/icons, hover on filled buttons       |
| `--hm-accent-tint`     | `#f1dccc`            | `rgba(224,139,92,.16)`  | Selected/segmented fill                          |
| `--hm-accent-rgb`      | `181 80 47`          | `224 139 92`            | Bare channels for alpha layers                   |
| `--hm-marker-hover`    | `#f1dccc`            | `#443324`               | Opaque marker hover (both themes)                |
| `--hm-border`          | `rgba(30,27,24,.14)` | `rgba(243,237,227,.16)` | Every hairline                                   |
| `--hm-info`            | `#2b4257`            | `#7fa0be`               | —                                                |
| `--hm-success`         | `#4b6b4e`            | `#8fb894`               | `.hm-status--success`                            |
| `--hm-warning`         | `#a67c3d`            | `#d4a85e`               | `.hm-status--warning`, unavailable states        |
| `--hm-danger`          | `#8c2f27`            | `#e07a6e`               | Delete, field errors                             |
| `--hm-surface-hover`   | `#f9f1ee`            | `#352a1e`               | Accent @8% flattened onto surface                |
| `--hm-surface-pressed` | `#f3e3de`            | `#443324`               | Accent @16% flattened onto surface               |

Notes on the palette:

- **The palette is warm throughout.** Ink is a warm brown-black, paper a warm
  parchment, accent a muted clay. Nothing is a pure neutral.
- `--hm-marker-hover` exists _separately_ from `--hm-accent-tint` because the
  tint is translucent in dark, which made the over-the-page marker see-through
  (`tokens.css:30-36, 846-853`).
- `--hm-surface-hover/pressed` are hand-computed because an opaque colour
  cannot be derived from a translucent one without `color-mix`. A test
  (`tests/ui/tokens.test.ts`) recomputes them so they cannot drift.
- In dark, `--hm-accent-strong` is **lighter** than `--hm-accent` — the reverse
  of light — so accent text/icons gain contrast instead of losing it.

### 2.2 Typography

Four families (`tokens.css:51-54`):

```
--hm-sans:    'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif
--hm-arabic:  'IBM Plex Sans Arabic', 'IBM Plex Sans', 'Segoe UI', Tahoma, sans-serif
--hm-serif:   'IBM Plex Serif', Georgia, 'Times New Roman', 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, serif
--hm-mono:    'IBM Plex Mono', ui-monospace, 'Cascadia Code', Consolas, monospace
```

Fonts are **not bundled** — the stack falls back to system faces. A live Google
Fonts request would be blocked by extension CSP anyway (`tokens.css:7-11`).

**The scale is role-based, not size-based** — a rule says what a piece of text
_is_ and the size follows (`tokens.css:56-80`):

| Token                | Size / line-height | Role                                          |
| -------------------- | ------------------ | --------------------------------------------- |
| `--hm-text-display`  | `26px / 1.2`       | The popup's note count                        |
| `--hm-text-title-lg` | `20px / 1.3`       | A page's `<h1>`                               |
| `--hm-text-title`    | `15px / 1.4`       | Section/card heading, empty-state title       |
| `--hm-text-prose`    | `15px / 1.65`      | **A note's own words, in serif**              |
| `--hm-text-body`     | `13.5px / 1.5`     | Running UI text: nav, row titles, inputs      |
| `--hm-text-body-sm`  | `12.5px / 1.5`     | Buttons, hints, secondary lines               |
| `--hm-text-label`    | `11px / 1.4`       | Timestamps, chips, uppercase captions         |
| `--hm-text-micro`    | `10px / 1`         | Count badges drawn over a page — nothing else |

Three hard rules, each with a stated reason (`tokens.css:56-64`):

1. **Always `px`, never `rem`** — an overlay in a host page's shadow root must
   not scale with that page's root font size.
2. **Always `font-size` + `line-height`, never the `font` shorthand** — it would
   reset `font-family` and undo the `[dir='rtl']` Arabic swap.
3. `body`/`body-sm` share the scope's `1.5` line-height, so rules of those
   roles inherit it rather than restating it.

**Serif for content, sans for chrome.** Every note body, preview, quote and
release-note bullet is `--hm-serif`. All navigation, labels, buttons and
metadata are `--hm-sans`. `--hm-mono` is reserved for short technical strings:
shortcut badges, the search `/` hint, version numbers, timestamps, payment
references.

**Uppercase micro-captions.** `--hm-text-label` + `text-transform: uppercase`

- `letter-spacing: 0.06em` + `--hm-ink-40` is a single recurring voice, used
  as one utility, `.hm-overline`: the composer's label, the Continue and Pinned
  titles, the attached-text label, menu section labels.

### 2.3 Spacing

A 6-step scale (`tokens.css:83-88`):

```
--hm-space-1: 4px    --hm-space-2: 8px    --hm-space-3: 12px
--hm-space-4: 16px   --hm-space-5: 24px   --hm-space-6: 32px
```

Two fixed paddings no card is allowed to invent its own (`tokens.css:96-102`):

```
--hm-card-pad:       16px 24px   (--hm-space-4 --hm-space-5)  sections, panels
--hm-card-pad-dense: 12px 16px   (--hm-space-3 --hm-space-4)  cards that repeat
```

`dense` exists because a note/tile/mention repeating down a list would
otherwise make the list twice as long.

### 2.4 Radius

```
--hm-radius-sm:   3px    inputs, small chips, nav items, links
--hm-radius-md:   6px    note rows, buttons, inputs, menus, tiles
--hm-radius-lg:  10px    cards (.hm-card), panels, sections
--hm-radius-pill: 999px  avatar, dots, folder chips, team chips
```

Rule of thumb: **the larger the surface, the larger the radius.**

### 2.5 Elevation

The level says _what a thing is_, not how much it should stand out
(`tokens.css:104-119`):

| Token         | Value                        | Means                                                             |
| ------------- | ---------------------------- | ----------------------------------------------------------------- |
| `--hm-elev-0` | `none`                       | **resting** — a card on an extension page: hairline, no shadow    |
| `--hm-elev-1` | `0 1px 2px rgba(0,0,0,.1)`   | **raised** — a chip over a host page (the marker), a hovered card |
| `--hm-elev-2` | `0 6px 20px rgba(0,0,0,.14)` | **floating** — a menu, picker, hover preview                      |
| `--hm-elev-3` | `0 16px 40px rgba(0,0,0,.2)` | **overlay** — composer/viewer cards over a page, the toast        |

Dark: alphas `.1 → .3`, `.14 → .4`, `.2 → .5`, because shadows are nearly
invisible on a dark surface (`tokens.css:215-219`).

### 2.6 Motion

Primitives (`tokens.css:122-127`):

```
--hm-dur-fast: 120ms    --hm-dur-base: 200ms    --hm-dur-slow: 320ms
--hm-ease-out:    cubic-bezier(.16, 1, .3, 1)     decelerate into place
--hm-ease-in:     cubic-bezier(.4, 0, 1, 1)       accelerate away
--hm-ease-settle: cubic-bezier(.34, 1.15, .64, 1) overshoot slightly
```

Intents — one duration + one curve per _reason_ to move, so a rule reads
`transition: background var(--hm-motion-state)` (`tokens.css:128-141`):

| Intent                   | Intended value                                              | Used by                                                                                    |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `--hm-motion-state`      | `120ms ease-out` — hover/focus/pressed colour               | everywhere                                                                                 |
| `--hm-motion-enter`      | `200ms ease-out`                                            | `.hm-group__body[data-expanded]`, `.hm-folder-node__body[data-expanded]`, the switch thumb |
| `--hm-motion-exit`       | `120ms ease-in`                                             | the same rules in their collapsed state                                                    |
| `--hm-motion-emphasized` | `320ms ease-out` — a whole pane/page changing place         | `.hm-fade-in`, `.hm-popup__track`                                                          |
| `--hm-motion-pop`        | `200ms ease-settle` — a small thing appearing with a settle | `.hm-card`, `.hm-video-preview`, `.hm-text-action`                                         |

The governing rule (`tokens.css:135-136`): **a transition governs the state it
moves _to_**, so a collapsible sets `exit` on the closed rule and `enter` on the
open one.

Every intent is built from primitives; `tests/ui/tokens.test.ts` fails on a
custom property that refers to itself (the 1.4.0 defect, §11) and pins each
intent's shape. List entrances stagger through one helper, `stagger(i)`
(`src/ui/kit/motion.ts`: 30ms steps, capped at 240ms).

**Reduced motion** (`tokens.css:1396-1406`):

```css
@media (prefers-reduced-motion: reduce) {
  .hm-scope *,
  .hm-hover-outline,
  .hm-card,
  .hm-marker,
  .hm-text-action {
    animation: none !important;
    transition: none !important;
  }
}
```

The named selectors are belt-and-braces for shadow-root cases. In JS, every
scroll to a note goes through `revealElement` (`src/utils/dom.ts`), which scrolls
instantly under reduced motion and smoothly otherwise.

### 2.7 State layers

A strict ladder of accent-over-surface alphas (`tokens.css:143-158`):

```
--hm-state-hover:    0.08
--hm-state-focus:   0.12
--hm-state-pressed: 0.16
--hm-state-disabled: 0.5
--hm-layer-hover/focus/pressed: rgb(var(--hm-accent-rgb) / …)
```

"Selected" is `--hm-accent-tint` (~20%), a step above pressed — so each step is
told apart from the next. `.hm-layer-*` is **translucent and for Hamesh's own
surfaces only**. Anything painted straight over a host page must use the opaque
`--hm-surface-hover/pressed`.

Filled buttons keep their solid step at `--hm-accent-strong`: "a wash on a
saturated fill goes muddy."

### 2.8 Focus, hit areas, z-index

```
--hm-ring:        0 0 0 2px var(--hm-accent)
--hm-ring-inset:  inset 0 0 0 2px var(--hm-accent)
--hm-halo:        0 0 0 3px var(--hm-accent-tint)
```

"The ring is the indicator; the layer only helps a control with no border of its
own stay findable. **Fields get the wider halo instead**" (`tokens.css:166-170`).

**`.hm-btn:focus-visible`** is the one exception — a two-step ring that works on
any background (`tokens.css:489-494`):
`0 0 0 2px var(--hm-surface), 0 0 0 4px var(--hm-accent)`.

**Hit areas** (`tokens.css:1365-1394`). Pointer controls keep their small glyph
and gain an invisible `::after`:

```css
.hm-icon-btn::after {
  content: '';
  position: absolute;
  inset: min(0px, calc(50% - var(--hm-hit-min) / 2));
}
```

`min()` means a control that is already large enough grows nothing.
`--hm-hit-min: 32px`, raised to `44px` under `@media (pointer: coarse)`.
`.hm-marker` and `.hm-text-action` are **excluded** — an invisible target over a
host page would take clicks meant for the page's own controls — and grow only
under a coarse pointer.

**Z-index** — top of the 32-bit range so cards out-rank markers and any host
stacking context (`tokens.css:178-183`):

```
--hm-z-marker:   2147483644
--hm-z-overlay:  2147483645
--hm-z-composer: 2147483646
--hm-z-toast:    2147483647
```

The shadow **host** itself is pinned at `2147483647 !important`
(`tokens.css:231-234`), injected after WXT's `:host{all:initial!important}`
reset so it wins on source order.

### 2.9 The base scope

```css
.hm-scope {
  font-family: var(--hm-sans);
  color: var(--hm-ink);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
.hm-scope *,
.hm-scope *::before,
.hm-scope *::after {
  box-sizing: border-box;
}
.hm-scope [dir='rtl'],
.hm-scope[dir='rtl'] {
  font-family: var(--hm-arabic);
}
```

`tokens.css:237-251`.

---

## 3. The brand glyph: MarginMark

One glyph at every scale — toolbar icon, sidebar brand, page header, saved
marker, composer label, selection hint. `src/ui/kit/MarginMark.tsx`.

`viewBox="0 0 32 32"`, three round-capped `currentColor` paths:

```
M10 5  →  M10 27     vertical rule (the margin)
M10 14 →  M20 14     horizontal tick reaching off it
M20 10.5 → M20 17.5  terminal tick
```

Sizes actually used: `11` (composer label), `13` (hint, selection chip),
`13.5` no — `14` (marker), `16` (popup brand, default), `20` (page headers),
`22`/`28` (empty states).

`flip` mirrors horizontally (`scaleX(-1)`) so the tick always points **into**
the text — the direction of reading — never away from it.

The same idea is redrawn in three other places, deliberately:

| Form            | Where                                                          | Expression                                         |
| --------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| Vertical rule   | `.hm-connector` (`tokens.css:365-372`)                         | 1×10px accent stub above the composer/viewer card  |
| Blockquote rule | `.hm-attached__quote` (`tokens.css:930-943`)                   | 2px accent rule down the quote's inline-start edge |
| Timeline        | `.hm-whats-new__release::before` (`notes-library.css:165-175`) | 1px hairline + 8px accent-ringed dot               |

---

## 4. Toolbar popup

`src/entrypoints/popup/App.tsx`, `App.css`, `index.html`, `main.tsx`. The popup
imports `tokens.css` + `pages.css` (so its loading and empty states are the
Library's own) + `App.css` (the popup's geometry only).

### 4.1 Geometry

Width is **exactly 300px**, declared twice on purpose:

- `index.html` — an inline `<style>` in `<head>`, parsed synchronously before
  any network request, because Chrome's popup auto-sizing can measure the
  document before the build-injected async `<link>` has applied.
- `App.css` — the bundled stylesheet.

**No height is set anywhere.** Chrome derives popup height from document
layout. Each pane carries `--hm-space-5` (24px) padding, giving a **252px
content column**. The document background is painted from the scope's own
`--hm-surface` by `usePageBackground` (tokens live on `.hm-scope`, which
`html`/`body` are ancestors of).

### 4.2 Two panes on one sliding track

```
.hm-popup              width 300px, bg --hm-surface, color --hm-ink
.hm-popup__viewport    width 300px, overflow hidden, position relative
.hm-popup__track       display flex, width 200%, transition transform --hm-motion-emphasized
.hm-popup__pane        flex 0 0 50%, padding 24px
```

State machine — `type View = 'home' | 'settings'`, a single `useState`, no
router, no URL:

```
 home ──settings button──▶ settings ──Back / Escape──▶ home
```

The track transform mirrors for RTL:

```ts
const sign = dir === 'rtl' ? 1 : -1;
transform: translateX(${view === 'settings' ? sign * 50 : 0}%)
```

**Both panes are always mounted** so the transition has both sides present. The
inactive pane gets `aria-hidden` **and** `inert`.

Focus choreography: nothing focused on first mount (the popup doesn't steal
focus); entering Settings focuses the `<h2 tabIndex={-1}>`; returning focuses
the settings button — both with `{ preventScroll: true }`, because the wide
clipped track is still a programmatic scroll container.

### 4.3 Home pane

**Header** (`.hm-popup__head`, flex, gap 8px):

```
[MarginMark 16/3.5 accent] [Hamesh]  ──auto──▶  [Alt+H]  [settings]
```

| Part          | Class                        | Style                                                                                                                          |
| ------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Brand mark    | `.hm-mark.hm-popup__mark`    | 16px, `--hm-accent`                                                                                                            |
| Wordmark      | `.hm-popup__brand`           | body role, weight 600                                                                                                          |
| Wordmark (ar) | `.hm-popup__brand--ar`       | title role (15px/1.4) — Arabic needs the larger step and tighter leading                                                       |
| Shortcut      | `.hm-kbd.hm-popup__shortcut` | the one keycap style (`.hm-kbd`, `pages.css`), label role, `margin-inline-start: auto`. Omitted when Chrome reports no binding |
| Settings      | `.hm-icon-btn`               | `SettingsIcon` (two sliders) from the kit                                                                                      |

**Body** — three mutually exclusive branches:

**(a) Loading** — `<Skeleton rows={2} />` inside `.hm-popup__body`. The same
skeleton the Library uses (`kit/Skeleton.tsx`, `.hm-skeleton` in `pages.css`).

**(b) Unavailable** — `<EmptyState size="compact">`: MarginMark → **"Notes
can't go on this page"** → **"Hamesh works on ordinary websites. Open one, or
read the notes you have already made."**

**(c) Active:**

```
p.hm-popup__count     {count} <span>notes on this page</span>
button.hm-btn-primary.hm-popup__add   [+] Add a note      (full width, 11px padding)
StatusLine tone=success               "Active on this page"
```

`.hm-popup__count` is the display role (26px/1.2, 600); the `span` drops to the
body role, `--hm-ink-40`.

**Footer** — in all three states: `button.hm-popup__link` (flex,
`space-between`, body-sm/500, `--hm-ink-60`, hover/pressed layers, `--hm-ring`
on focus) with **"Notes Library"** and a forward `ChevronIcon` (mirrored in RTL
by `.hm-mirror`).

### 4.4 Actions

| Handler                           | Behaviour                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Add a note**                    | sends `ENABLE_SELECTION` to the active tab, `window.close()`. On throw → falls to the unavailable state |
| **Notes Library**                 | `tabs.create(notes.html)`, close                                                                        |
| **Settings → Open full settings** | `tabs.create(notes.html?view=settings)`, close                                                          |

Shortcuts are read live through `useShortcuts()` (`src/ui/hooks/useShortcuts.ts`,
one `COMMANDS` map) — the same source the Settings page's Shortcuts card reads —
never hardcoded, because they are user-customisable.

---

## 5. Notes Library page

`src/entrypoints/notes/App.tsx` is the shell — routing (`place`/`navigate`),
preferences (`usePreferences`), the note list and its writes
(`useNoteMutations`), folders (`useFolders`), shared team notes, and the two
Teams slots. Each view is its own module: `src/ui/library/LibraryView.tsx`,
`src/ui/settings/LibrarySettingsView.tsx`, `src/ui/WhatsNewView.tsx`,
`src/ui/teams/TeamsView.tsx`, `src/ui/teams/MentionsInbox.tsx`.

Styles: `tokens.css` → `pages.css` (everything the popup and the Library share:
page frame, cards, panels, empty/skeleton, segmented control, switch, menu,
avatar, settings rows, keycap) → `notes-library.css` (the sidebar and the
Library/What's New views only) → `teams.css` (Teams builds only, injected as a
string).

### 5.1 Page frame

Every view is `<Page>` + `<PageHeader>` (`src/ui/kit/Page.tsx`):

```css
.hm-notes-page          min-height 100vh; background --hm-paper; display flex
.hm-page                flex 1; min-width 0; padding 32px          (≤720px: 24px 16px)
.hm-page__inner         max-width 680px; margin 0 auto
.hm-page__inner--wide   max-width 920px                             (Teams overview)
.hm-page-header         flex wrap, baseline, gap 8px 12px, margin-bottom 24px
.hm-page-header__title  --hm-text-title-lg, 600, letter-spacing -0.01em
.hm-page-header__meta   body-sm, --hm-ink-40   (e.g. the Teams tagline)
.hm-page-header--sub    margin-bottom 16px — a page reached from another, under a Breadcrumb
```

`PageHeader level="top"` carries the MarginMark beside the `<h1>`; `level="sub"`
drops it, because the breadcrumb above already says where the reader is.

### 5.2 Sidebar

`src/ui/library/Sidebar.tsx` — one data-driven list; Teams and Mentions are
added only inside `import.meta.env.WXT_TEAMS_API_ORIGIN` bodies.

```css
.hm-sidebar {
  flex: 0 0 216px;
  align-self: flex-start;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  border-inline-end: 1px solid var(--hm-border);
  background: var(--hm-paper-dim); /* the frame, a shade under the page */
  padding: 24px 12px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
```

**Sticky, one viewport tall, not stretched** — it has a foot (What's New,
`margin-top: auto`), and on a long page a stretched sidebar would park that foot
far below the fold.

| Element                 | Style                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `.hm-sidebar__brand`    | MarginMark + wordmark (body, 600)                                                          |
| `.hm-sidebar__nav-item` | flex, gap 10px, `padding: 9px 10px`, radius md, body role, `--hm-ink-60`, kit icon at 16px |
| `:hover` / `:active`    | `--hm-layer-hover` / `--hm-layer-pressed`                                                  |
| `[aria-current='page']` | `--hm-accent-tint` + `--hm-accent-strong`, 500 — a step above pressed                      |
| `:focus-visible`        | 2px accent outline drawn inside                                                            |
| `.hm-sidebar__dot`      | 6px accent dot on the trailing edge — What's New unread                                    |

Items, in order: **Notes Library** (`LibraryIcon`), **Teams** (`TeamIcon`),
**Mentions** (`MentionsIcon`), **Settings** (`SettingsIcon`), and in the foot
**What's New** (`WhatsNewIcon`).

**Narrow window (≤720px).** The sidebar becomes a bar across the top: brand mark,
then every destination in one horizontally scrolling row (scrollbar hidden), the
foot pushed to the inline end — the way a phone app keeps its places within
reach instead of leaving the page a sliver.

Sidebar switching is **not navigation** — same document, address unchanged, so a
reload opens the Library. Only a page reached _from_ a view (a team's People, a
shared note) becomes a history entry.

### 5.3 Library view — vertical order

```
PageHeader        MarginMark + "Notes Library"
[status]          .hm-visually-hidden role=status  "Loading notes."
search            .hm-search-wrap                        (when there are notes)
toolbar           .hm-library-toolbar: NoteFilter (Teams builds) ··· [By site|By folder] [A–Z|Recent]
Continue          .hm-library-section.hm-continue        (hidden while searching)
Pinned            .hm-library-section.hm-pinned          (hidden while searching)
body              Skeleton | EmptyState ×3 | site groups | folder tree
```

#### Search

A pill (`radius-pill`, `--hm-surface`, hairline) with the field halo on focus.
Live filtering, no button. A `<kbd class="hm-search__hint">/</kbd>` sits at the
trailing edge until there is a query, when the native clear button takes the
spot. `/` focuses search from anywhere (ignored inside editable fields);
`Escape` clears a non-empty query and stops there.

#### Toolbar

`.hm-library-toolbar` — whose notes on the inline-start side (the owner filter
chips, Teams builds only), how they are laid out on the inline-end side: two
`SegmentedControl`s, **By site / By folder** and, in site mode, **A–Z /
Recent**. The folder layout stays available while searching, so a search can be
read by folder too.

#### Continue and Pinned

Both have an overline title (`h2.hm-overline`).

- **Continue** — up to three recently-active sites as light cards
  (`.hm-continue__item`: hairline, radius lg, `--hm-surface`, favicon 20 +
  domain + "3 notes · 2 hours ago"), staggered in with `stagger(i)`
  (`kit/motion.ts`). Each is a real link; a plain left-click restores the note.
- **Pinned** — one card of `NoteRow`s (`ul.hm-rows.hm-rows--card`), with the
  domain kicker shown, flat across all sites, most recently edited first. The
  same row as everywhere else, so a long pinned note has "Show more" like every
  other note.

#### Rows and cards

Every list of notes, and the folder tree, is **rows in a card**:

```css
.hm-rows > li + li            { border-top: 1px solid var(--hm-ink-10); }   /* hairline between */
.hm-rows--card                { border; radius-lg; --hm-surface; overflow hidden }
```

A site group is its own card (`.hm-group`): a header button (favicon → domain →
count → chevron that turns 180° open) and a body whose height animates through
`grid-template-rows: 0fr → 1fr` (no measuring; the one grid item is a
padding-less wrapper because a `0fr` row is sized from its item's minimum,
padding included). The collapsed body is `aria-hidden` + `inert`. Groups open
automatically while searching.

#### NoteRow

`src/ui/library/NoteRow.tsx` — the one note row, used by site groups, Pinned
and the folder tree.

```
article.hm-note-row           grid: 'main aside' / 'tail tail' / 'alert alert'
  a.hm-note-row__link          main — stretched over the row by ::after
    .hm-note-row__domain       (cross-site lists) favicon + domain, label role, accent-strong
    .hm-note-row__title        pin glyph · page label · team chip
    AttachedText compact       (text notes)
    p.hm-note-row__preview     .hm-prose, 2-line clamp; [data-expanded] shows it all
  .hm-note-row__aside          aside — video badge (mm:ss) · "2 hours ago" · ⋮ menu
  .hm-note-row__tail           tail — "Show more" toggle · Discuss (Teams)
  .hm-note-row__alert          alert — InlineError for a failed write on this note
```

The row is not the link: `.hm-note-row__link::after { inset: 0 }` makes the whole
row open the note, while the menu, toggle and Discuss sit above it at
`z-index: 1`. Hover is `--hm-layer-hover`; keyboard focus on the link rings the
row inset. A row whose write is in flight gets `[data-busy]` (disabled opacity).
Nested rows indent by `--hm-depth × --hm-indent` (14px).

Expanded preview: clamp off, `white-space: pre-wrap`, `max-height: min(22rem,
55vh)` with its own scroll and `overscroll-behavior: contain`, raised above the
stretched link so the wheel scrolls it. "Show more" appears only when the text
is measured as clamped (`ResizeObserver`) or already expanded.

`.hm-team-chip` (Teams builds): pill, accent tint, 5px accent dot — "the one
thing that says a note in the Library is not this device's alone."

#### The row menu

`NoteActionsMenu` (`src/ui/library/NoteActionsMenu.tsx`) is built on the kit's
`Menu` (`src/ui/kit/Menu.tsx`): a ⋮ `.hm-menu__trigger`, a panel portalled into
`.hm-scope` (so no card's `overflow: hidden` clips it), positioned under the
trigger and flipped when there is no room, following scroll, closed by an
outside click or Escape (focus returns to the trigger), and walked with
↑/↓/Home/End. Items: **Pin/Unpin · Edit · Move to folder** (a checked list of
folders, indented by depth, with **New folder** inline) **· Delete** (asks with
`InlineConfirm` inside the panel), plus the Teams share slot. The panel changes
view in place (menu → editing with `NoteEditor` → confirming) rather than
stacking dialogs.

#### Folder view (By folder)

`src/ui/library/FolderTree.tsx` — a toolbar (`.hm-add` **New folder**, which
turns into a `NameField`) over **one card** of folders:

- `.hm-folder-node` row: one disclosure button (`.hm-folder-node__name`,
  `aria-expanded`) holding chevron → folder glyph → name → count, then the
  folder's ⋮ `FolderMenu` (**Rename · Add sub-folder · Delete**, delete asked
  with `InlineConfirm`). The chevron points along the line of reading when
  shut and turns down when open, mirrored in RTL.
- Depth indents by `--hm-depth × --hm-indent`; bodies animate with the same
  grid-rows trick.
- **Unfiled** is the last row (italic, `--hm-ink-60`) — notes whose folder is
  gone count as unfiled (`resolveFolderId`, one rule everywhere).
- **Drag & drop**: note rows are draggable with the MIME type
  `application/x-hamesh-note-id`; a folder being dragged over gets the accent
  tint and a dashed outline.

The same `FolderMenu` is used by the team folder tiles.

#### Empty / loading states

`<Skeleton>` (`kit/Skeleton.tsx`): three rows, radius md, `--hm-paper-dim`,
pulsing with staggered delays; `shape="tiles"` / `"chips"` for Teams. Reduced
motion stops the pulse.

`<EmptyState>` (`kit/EmptyState.tsx`): MarginMark → title → body → optional
action; `size="page"` (default), `"inline"` (inside a card), `"compact"` (the
popup). Three Library empties:

| Condition                      | Title              | Body                                                           | Action                   |
| ------------------------------ | ------------------ | -------------------------------------------------------------- | ------------------------ |
| Nothing locally _or_ shared    | "No notes yet"     | "Press Alt+H on any page to leave your first note."            | **Shortcuts** → Settings |
| Filter matches nothing (Teams) | "Nothing here yet" | "No notes match this filter. Show everything to see the rest." | **Show all**             |
| Search matches nothing         | "No matches"       | `Nothing found for "…".`                                       | —                        |

#### Open Note — cross-tab restore

A plain left-click on a row, a Continue card or a Pinned row:

1. `tabs.create({ url: originalUrl })`
2. listen for `CONTENT_READY` from that tab
3. send `RESTORE_NOTE { noteId }`
4. the content script calls `revealElement` (`src/utils/dom.ts` — scrolls
   smoothly, or instantly under reduced motion), pulses `.hm-restore-highlight`
   for `RESTORE_FLASH_MS` (1400 ms, passed to CSS as `--hm-flash`), and opens
   the viewer

Modified/middle clicks pass through natively. 15 s safety timeout.

---

## 6. Settings

Two surfaces: a **compact pane** in the popup, and the **full page** at
`notes.html?view=settings`. Both write through `usePreferences`
(`src/ui/hooks/usePreferences.ts`), which applies a change at once and rolls it
back if the write fails.

### 6.1 Shared components

**`SettingRow`** (`src/ui/kit/SettingRow.tsx`) — label (optional 14px kit icon,
`--hm-accent-strong`) on one side, control on the other; an optional `hint`
renders as a second line aligned under the label, and the hairline moves under
the pair (`:has(+ .hm-setting-row__hint)`) instead of striking through it.

**`LanguageRow` / `AppearanceRow`** (`src/ui/settings/ChoiceRows.tsx`) — the
two rows both surfaces show, written once. Appearance offers **Match website /
Light / Dark** with the same icons in both places, "so a choice looks identical
wherever it's made"; the popup drops the leading row icons (`withIcon={false}`).

**`SegmentedControl`** (`src/ui/kit/SegmentedControl.tsx`) — real
`<input type=radio>` semantics in a pill: `padding: 3px`, options `4px 12px`,
radius pill. The chosen option **inverts** (`--hm-ink` on `--hm-paper`), the
same way the owner-filter chips mark theirs, so the accent stays the mark's. A
chosen option does not respond to hover. Focus is the two-step ring.

**`Switch`** (`src/ui/kit/Switch.tsx`) — `button[role=switch]`, 34×20, thumb
rides to the inline end when on (so it reads correctly in RTL), accent when on,
disabled opacity when off-limits. Used for on/off settings instead of a
two-option segmented control.

**`Section` / `Panel`** (`src/ui/kit/Section.tsx`) — every page is a stack of
these. `Section` is an open card (`h2.hm-section__title`, optional meta/actions,
`flush` for edge-to-edge rows). `Panel` is the same card as a native
`<details>` for what is looked for rarely (Backup, a team's settings, earlier
releases); its title is an `h2` too, so the outline is the same open or shut.
The summary's chevron is drawn from borders, so it mirrors in RTL.

**Icons** — `src/ui/kit/icons.tsx`, one set for every surface: 14–16px grid,
~1.3px strokes, `currentColor`. `ChevronIcon direction="down|forward|back"`;
`forward`/`back` carry `.hm-mirror` so they point along the line of reading in
RTL.

### 6.2 Compact popup Settings pane

`src/ui/settings/SettingsView.tsx`. Header: back `.hm-icon-btn` with a back
chevron + `h2.hm-popup-settings__title[tabIndex=-1]` (title role; no ring — a
programmatic focus target). Body: `LanguageRow` + `AppearanceRow` without row
icons. Footer: `.hm-popup__link` **"Open full settings"** with a forward
chevron. Escape returns to home via a `document` listener attached only while
the pane is open.

### 6.3 Full Settings page

`src/ui/settings/LibrarySettingsView.tsx`, a `Page` with `PageHeader`
**"Settings"**.

| #   | Card                                | Shape                                   |
| --- | ----------------------------------- | --------------------------------------- |
| 1   | _(untitled)_ — Language, Appearance | `Section` with an accessible label only |
| 2   | **Text notes**                      | `Section`                               |
| 3   | **Shortcuts**                       | `Section`                               |
| 4   | **Teams**                           | `Section` (Teams builds only)           |
| 5   | **Join a team**                     | `Panel` (signed in)                     |
| 6   | **Plan**                            | `Panel` (signed in)                     |
| 7   | **Backup**                          | `Panel`                                 |

**Text notes.** Intro: turning the feature off stops new notes and hides
highlights but **never deletes** anything.

| Row                           | Icon                  | Control  |
| ----------------------------- | --------------------- | -------- |
| **Notes on selected text**    | `TextNoteIcon`        | `Switch` |
| **Show icon after selecting** | `SelectionActionIcon` | `Switch` |

**Shortcuts.** Read-only by design — Chrome exposes only `getAll`/`onCommand`,
so Hamesh links out to `chrome://extensions/shortcuts`.

| Row                             | Icon           | Value             |
| ------------------------------- | -------------- | ----------------- |
| **Add a note**                  | MarginMark     | `.hm-kbd` `Alt+H` |
| **Add a video note**            | `PlayIcon`     | `.hm-kbd` `Alt+V` |
| **Add a note to selected text** | `TextNoteIcon` | `.hm-kbd` `Alt+T` |

`.hm-kbd` (`pages.css`) is the one keycap: mono, label role, `--hm-paper-dim`,
radius sm. "Not set" is spelled out rather than shown as a blank. Below: an
accent link **"Change in Chrome settings"**.

**Teams** (`src/ui/settings/TeamsSection.tsx`). Intro: _"Share notes with the
people you work with. Your personal notes stay on this device either way."_
Re-checks status on every window `focus` (permissions can be revoked from
Chrome's own page). Renders **nothing** when the server is unreachable.

| State               | Rows                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| loading             | **Teams** → `Busy` "Checking…"                                                                                                      |
| `permission_needed` | **Teams** → **Turn on Teams** + hint that nothing is sent until sign-in                                                             |
| `signed_out`        | **Account** → **Sign in with Google** + hint (a `--mode dev` build adds a panel that takes a session token the local server issued) |
| `signed_in`         | **Account** (email + Sign out) · **Plan** · **Your teams**                                                                          |

Plus a link **"Turn off Teams"**. The permission prompt is requested
_synchronously from the click_ — required by Chrome. Each action's busy state
and failure are keyed on that action (`useWork`), shown beside it with
`InlineError`.

**Backup** (`src/ui/settings/BackupSection.tsx`). "Two plain buttons rather than
a wizard."

| Row        | Icon         | Button | Hint                                                   |
| ---------- | ------------ | ------ | ------------------------------------------------------ |
| **Export** | `ExportIcon` | ghost  | "Save every note and folder to a file on this device." |
| **Import** | `ImportIcon` | ghost  | "Restore from a backup file. Nothing is ever deleted." |

The file input is `.hm-visually-hidden` with its own accessible name ("Choose a
backup file"). Both buttons disable while either runs; the running one is
`aria-busy` (it keeps its label and gains the arc). Result: a `StatusLine`
(`Saved {n} note(s) and {f} folder(s).` / `Restored …` / `Everything in that
file was already here.`) or an `InlineError` per failure kind.

### 6.4 Control state matrix

| Control                         | Rest                                                                   | Hover                           | Active                             | Focus-visible                    | Disabled                                    |
| ------------------------------- | ---------------------------------------------------------------------- | ------------------------------- | ---------------------------------- | -------------------------------- | ------------------------------------------- |
| `.hm-icon-btn`                  | `--hm-ink-60`, 26×26 (`--small` 22×22)                                 | `--hm-layer-hover` + `--hm-ink` | `--hm-layer-pressed`, `scale(.94)` | `--hm-layer-focus` + `--hm-ring` | disabled opacity                            |
| `.hm-btn-primary`               | `--hm-accent` bg, `#fff`, radius md                                    | `--hm-accent-strong`            | —                                  | two-step ring                    | `opacity: --hm-state-disabled; not-allowed` |
| `.hm-btn-ghost`                 | transparent, `--hm-ink-60`, hairline                                   | `--hm-layer-hover` + `--hm-ink` | `--hm-layer-pressed`               | two-step ring                    | same as all `.hm-btn`                       |
| `.hm-btn-danger`                | `--hm-danger` bg, `#fff`                                               | `brightness(1.08)`              | —                                  | two-step ring                    | same                                        |
| `.hm-link`                      | `--hm-ink-60`                                                          | `--hm-ink`                      | —                                  | `--hm-ring`                      | disabled opacity, `not-allowed`             |
| `.hm-link--accent` / `--danger` | accent-strong / danger                                                 | underline                       | —                                  | `--hm-ring`                      | same                                        |
| `.hm-segmented__option`         | `--hm-ink-60`                                                          | hover layer if not chosen       | —                                  | two-step ring                    | n/a                                         |
| `.hm-switch`                    | `--hm-paper-dim`, ink-20 hairline                                      | accent hairline                 | —                                  | two-step ring                    | disabled opacity                            |
| `.hm-panel__summary`            | title role                                                             | `--hm-layer-hover`              | —                                  | focus layer + inset ring         | n/a                                         |
| `.hm-input`                     | body, hairline, radius sm                                              | —                               | —                                  | accent border + `--hm-halo`      | disabled opacity                            |
| `.hm-menu__item`                | body, `--hm-ink`                                                       | hover layer                     | —                                  | hover layer + inset ring         | disabled opacity                            |
| `aria-busy` on btn/link         | keeps its label, gains a 12px accent arc before it, `cursor: progress` |                                 |                                    |                                  |                                             |

**Feedback** (`src/ui/kit/Feedback.tsx`): `InlineError` (`.hm-alert`,
`role=alert`, optional **Try again**) sits beside the control that failed;
`StatusLine` (`.hm-status--success|warning`, a 6px dot) states a condition;
`Busy` (`.hm-busy`) is a label with the arc for work that has no button.

---

## 7. What's New

`src/ui/WhatsNewView.tsx`, `notes.html?view=whats-new`. Opened automatically by
the background after an update.

Same frame: `Page` + `PageHeader` **"What's New"**, intro _"Everything that has
changed in Hamesh, newest first."_

**Rendered as a vertical timeline** — the margin-mark idea turned sideways:

```css
.hm-whats-new__release {
  padding: 0 0 24px 24px;
  padding-inline-start: 24px;
  padding-inline-end: 0;
  border-inline-start: 1px solid var(--hm-border);
}
.hm-whats-new__release:last-child {
  border-inline-start-color: transparent;
  padding-bottom: 16px;
}
.hm-whats-new__release::before {
  content: '';
  position: absolute;
  inset-inline-start: -4.5px;
  top: 6px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--hm-paper);
  box-shadow: 0 0 0 1.5px var(--hm-accent);
}
```

Per entry: head row = version (mono 12.5px/600) + badge + `<time>` (mono 11px,
`margin-inline-start: auto`, `--hm-ink-40`). Badges: `.hm-whats-new__badge`
(`--hm-accent-tint` bg, `--hm-accent-strong`, 11px/600, pill) reading
**"New"**; `--installed` variant (`--hm-ink-10` bg, `--hm-ink-60`) reading
**"Installed"** for the running version.

Then `h2.hm-whats-new__title` (title role) and a bullet list — each item is
`.hm-serif` at the prose role with a 4px `--hm-ink-20` dot at `top: .62em`; the
serif stack carries Arabic fallbacks, so an Arabic item falls through to an
Arabic face.
Release-note bodies are localised per item, so an Arabic reader gets Arabic
release notes.

Older releases collapse into a `Panel` ("Earlier releases", hint "3
releases"); inside it the timeline dot is painted on `--hm-surface` instead of
`--hm-paper`.

Entrance: `.hm-fade-in` with `stagger(offset + i)` — 30ms steps, capped at
240ms, the one stagger rule (`src/ui/kit/motion.ts`).

---

## 8. Teams

Only in builds with `WXT_TEAMS_API_ORIGIN`; `identity` and the API origin are
**optional** permissions requested at runtime. `teams.css` is loaded as a _string_
(`?inline`) and injected by `src/ui/teams/styles.ts:19-24`, so a non-Teams build
tree-shakes it away.

Teams never lives in the popup — it's two Notes Library views plus a Settings
section.

### 8.1 Routing

`src/ui/teams/route.ts`:

```ts
type TeamsRoute =
  | { page: 'overview'; teamId: string | null }
  | { page: 'members'; teamId: string }
  | { page: 'note'; teamId: string; noteId: string };
```

URL: `?team=<id>`, `?team=<id>&page=members`, `?team=<id>&page=note&note=<id>`.
Parsing never throws — a stale link opens the overview.

History: sidebar switches are **not** navigation (address unchanged, so a reload
opens the Library). Only a page reached _from_ Teams becomes a history entry
(`replaceState` the current one first, then `pushState`), and leaving a
linkable page for a top-level one strips the query.

The overview renders in `.hm-page__inner--wide` (920px) — tiles and chips need
more room than a reading column.

### 8.2 Failure model

> "Everything shown here is what the server said a moment ago. The page holds no
> plan, role or limit of its own and decides nothing from them."
>
> "A page-wide spinner that greys out every button because one of them was
> pressed tells the reader nothing about which one." (`useTeams.ts:9-22`)

So `busy` is an **array of keys**, and `failed(key)` reports per control. A page-
level `.hm-status` appears only when `failure.key === null`. `run()` never
throws; it returns `Result | null`.

### 8.3 TeamsView — overview

`src/ui/teams/TeamsView.tsx` in `.hm-page__inner--wide` (920px) — tiles and
chips need more room than a reading column.

```
PageHeader          "Teams" + meta: the tagline
.hm-team-bar        SegmentedControl (one option per team) · .hm-add "New team" (→ NameField) ··· meta "Owner · 3 members"
[state line]        StatusLine warning   "Read-only until {date}" / "Read-only" / "Locked"
Section             Shared notes      → folder tiles  (meta: "12 notes · Up to date as of …", actions: Check for changes · Open in the Library)
Section             Who's in {team}   → member chips  (action: Manage)
Panel               Team settings     (shut)
```

`.hm-add` (`pages.css`) is the one "there could be more here" control: a dashed
pill outline, `--hm-ink-60`, accent on hover. Used for **New folder**, **New
team**, and the add tile.

Empty states (`EmptyState`):

| Condition          | Title                 | Body                                                                                                | Action                |
| ------------------ | --------------------- | --------------------------------------------------------------------------------------------------- | --------------------- |
| signed out         | "Teams is off"        | "Turn on Teams and sign in from Settings to share notes with your team."                            | **Open Settings**     |
| unreachable server | `strings.error(code)` | "Couldn't reach Hamesh Teams. Check your connection and try again."                                 | **Try again** (ghost) |
| no teams           | "No teams yet"        | "A team is a place to put notes everyone can see. Make one, or join with a link somebody sent you." | **Create a team**     |

#### Shared notes — folder tiles

Deliberately **not a list of notes**: the Library already lists a team's notes
beside the reader's own.

```css
.hm-tiles        grid, repeat(auto-fill, minmax(12.5rem, 1fr)), gap 12px
.hm-tile         hairline, radius md, --hm-paper; [data-busy] → disabled opacity
.hm-tile__open   the whole tile is the button: glyph + name, then the count; hover/pressed/focus layers, inset ring
.hm-tile > .hm-menu   the folder's ⋮ (FolderMenu) in the tile's inline-end corner
.hm-tile > .hm-alert  a failed rename/delete, across the tile's foot
.hm-tile--add    dashed; "+ New folder", turning into a NameField in place
```

A tile's actions live in the same `FolderMenu` the Library's folder tree uses
(**Rename · Add sub-folder · Delete**, delete asked in place) — always reachable
by keyboard and touch, instead of hover-revealed buttons. Opening a tile opens
the Library narrowed to that team folder. Skeletons: `shape="tiles"` and
`shape="chips"`.

#### Who's in it — member chips

`.hm-chips` (flex wrap, gap 8px) of `.hm-chip` pills: `Avatar` (round monogram,
`kit/Avatar.tsx`) + name + meta (`· you` / `· Admin` / `· Owner`). "A list of
people scans as people. No avatar image exists, and none is worth a request."

#### Team settings

A `Panel`: the team's name with **Rename** (a `NameField` in place, max
`TEAM_NAME_MAX`), then **Leave team** / **Delete team**, each asked with
`InlineConfirm` in the same row.

### 8.4 People page (breadcrumb, members, invitations)

`src/ui/teams/TeamPeople.tsx`.

```
Breadcrumb            Teams / {team} / Who's in it       (kit/Breadcrumb.tsx)
PageHeader level=sub  "Who's in {team}"  +  meta "3 members"
Section flush         → TeamMembers
Section               "Invite someone" (or "Invitations" for who cannot invite) → TeamInvitations
```

#### Members

One row per person, edge to edge in its flush card, hairline between:

```
li.hm-team-member[data-asking]   Avatar · who (name · you / email / "Joined {date}") · role · actions
```

Actions (compact ghost buttons, each gated by `memberRights` in
`src/ui/teams/permissions.ts`): **Make admin**, **Make member**, **Make owner**,
**Remove** (danger text). The slot shows one of: `InlineConfirm` (the row takes
`--hm-danger-tint` while asking about a removal) → `Busy` → the buttons. A
failure is an `InlineError` across the row's foot.

#### Invitations

"Hamesh sends no email — the server hands back a link exactly once and the
inviter passes it on themselves. The token lives in the link's fragment, so it
never reaches a server log or a Referer header."

Form `.hm-team-invite`: email input + a role `SegmentedControl` (**Member /
Admin**, only for who may invite admins) + primary **Create invite link**. The
one-time block `.hm-invite-link` (`role=status`): **"Here is the link — it is
shown once."** + `<code>` (mono, `user-select: all`, wraps anywhere) + **Copy
link** / **Copied**. Open invitations: email, `"{role} · Expires {date}"` or
"Expired", **Revoke**. Empty: "No open invitations."

#### InlineConfirm

`src/ui/kit/InlineConfirm.tsx` — the one confirmation in Hamesh (Library row
menu, folder menu, note viewer, team note, comments, members, team settings).
The question and its two answers stay together and wrap together; the cautious
answer takes focus; Escape backs out of the question alone (`escapeLayer`).
`tone="danger"` colours the confirming button.

### 8.5 Team note page + comments

`src/ui/teams/TeamNotePage.tsx`: `Breadcrumb` → `article.hm-section.hm-team-note`
→ `CommentThread`.

Head: page link (`pageLabelFrom`, opens in a new tab) + domain + "Edited
{relative}". Body: `p.hm-team-note__body.hm-prose[dir=auto]` — the same prose
voice a note has everywhere. Editing swaps the body for `NoteEditor` (the one
editor: validation, Ctrl/⌘+Enter, Escape, `aria-busy` save).

Rights come from `noteRights(team, note, me)` (`permissions.ts`): edit, file,
delete, unshare — the `_any` capability or the `_own` one for the author.

Actions `.hm-team-note__actions`, under a hairline: `FolderSelect` (the one
folder `<select>`, indented with non-breaking spaces by depth) → **Edit** ·
**Stop sharing** · **Delete** (danger). Mutations send `version: note.version`;
a refusal is reported beside the note and what shows afterwards is the server's
version. **"This note is no longer here"** is an `EmptyState` with **"Back to
{team}"**.

#### Comments

`.hm-section.hm-discussion` with a list of `.hm-comment` rows: `Avatar` beside
the content (meta "{author} · {relative}", body `pre-wrap`, actions **Reply ·
Edit · Delete** as links). A reply is the same row stepped in once
(`[data-reply='true']`); replies are one level deep. A deleted comment stays as a
placeholder because replies hang off it. **"Show all N replies"** expands in
place; **"Show more"** pages.

Mentions render through `MentionText` (`src/ui/teams/MentionText.tsx`, shared
with the inbox): `.hm-mention` is accent text, and the reader's own name is
tinted (`[data-me='true']`) — "tinted rather than boxed, so a sentence full of
them still reads as a sentence."

`CommentComposer`: `textarea.hm-textarea[dir=auto]`, a hint, then **Cancel** /
**Submit**. The mention picker floats over what follows (so the textarea does
not jump), each option an `Avatar` + name; the keyboard's choice is
`aria-selected`. Matching is a case-insensitive substring on display name, first
6; arrows cycle; `Enter`/`Tab` pick; `Escape` closes the picker, else cancels.
Picking inserts `<@userId> ` with a trailing space.

### 8.6 Mentions inbox

`src/ui/teams/MentionsInbox.tsx`, reading column. `PageHeader` **"Where you were
named"**, then `.hm-mentions` — one card per mention: meta (`{author} in {team}
· Said {relative}`), the comment through `MentionText`, and an accent link
**"Open the page"**. Opening the page marks everything read. Empty: "Nobody has
named you yet".

### 8.7 Join a team & Plan (Settings)

Both are `Panel`s in Settings, shown when signed in.

**JoinTeam.** Paste the invite link (its token lives in the URL fragment, so
pasting keeps it inside the extension) → **Check link** → a preview
(`.hm-invite-link`): **"You have been invited to {team} as {role}."**, optional
**"Invited by {who}."**, primary **Join**.

**BillingPanel.** Every number comes from the server. One price line
(`.hm-billing__price`, title role; `formatMoney` from `src/ui/format.ts`, with a
fallback for an unknown currency), the plan status, then **Pay with** (select),
**Periods** (`.hm-input--number`), **Transaction reference**, primary **Submit
payment**. Payment history reuses the invitation row list.

### 8.8 Library integration

**Owner filter** (`NoteFilter.tsx`) — toggle chips, not a segmented control (the
list is as long as the number of teams). `.hm-owner-filter__pill`: pill,
hairline, body-sm; the chosen one **inverts** (`--hm-ink` bg, `--hm-paper`
text), as the segmented control's chosen option does. Options: **Everything** ·
**Only mine** · one per team (accent dot). A folder scope shows as an
accent-tinted chip with a close glyph; clearing it keeps the team chip on. The
rule deciding which notes an owner choice keeps is `matchesOwner`
(`src/domain/note-owner.ts`).

**Sharing from a note row** (`ShareNoteAction.tsx`) fills the row menu's share
slot with `MenuItem`s: already a team note → **Open in Teams**; no teams →
nothing; otherwise a **Share with team** label and one item per team. Only a success closes the
menu, so a refusal stays on screen to be read. Sharing **moves** the note (the
local copy is forgotten once the team's copy has been read back); unsharing does
the reverse.

---

## 9. In-page overlay UI

`src/entrypoints/content.ts` mounts one React app into a **shadow host** appended
to `<body>`; `HameshApp.tsx` (2,300+ lines) orchestrates everything.

### 9.1 Mount & isolation

```css
:host {
  position: relative !important;
  z-index: 2147483647 !important;
}
```

Every marker/overlay inherits `pointer-events: none` from the shadow scope and
opts back in explicitly, so nothing over a host page eats clicks by accident.

### 9.2 Selection mode

Entered via the toolbar, **Alt+H**, or `activate()`. Clears viewer, composer and
video composer, then sets `selecting`.

| Element       | Class               | Style                                                                                                                                                          |
| ------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture layer | `.hm-capture`       | `position: fixed; inset: 0; cursor: crosshair; background: transparent; z-index: --hm-z-overlay`                                                               |
| Hover outline | `.hm-hover-outline` | `position: fixed; pointer-events: none; border: 1.5px solid --hm-accent; radius 3px; box-shadow: --hm-halo`                                                    |
| Hint pill     | `.hm-hint`          | `padding: 7px 12px; radius 7px; background: --hm-ink; color: --hm-paper; font-size: 12.5px; font-weight: 500; white-space: nowrap; box-shadow: --hm-shadow-md` |

The hint pill is **inverted ink-on-paper** rather than paper-on-ink — Hamesh's
own surface, "so it stays legible over any host background." It carries
`MarginMark 13/3.5` in `--hm-accent` and the string:

> **"Click to add a note · Esc to cancel"**

Exit: click an element → composer; **Escape** → cancel (captured on `document`
with `capture: true` + `preventDefault()`).

### 9.3 The card — Composer, Viewer, ClusterList, QuickNote

```css
.hm-card {
  position: relative;
  width: 300px;
  max-width: calc(100vw - 24px);
  background: var(--hm-surface);
  border: 1px solid var(--hm-border);
  border-radius: 10px;
  box-shadow: var(--hm-shadow-lg); /* elev-3: overlay */
  padding: 16px;
  font-size: 13.5px;
  animation: hm-card-in var(--hm-motion-pop);
}
@keyframes hm-card-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.hm-floating {
  position: fixed;
  z-index: var(--hm-z-composer);
  pointer-events: auto;
}
```

`tokens.css:335-364`. The entrance is a 4px rise + 0.98 scale with a settle.

**`.hm-connector`** — `position: absolute; top: -10px; inset-inline-start: 18px;
width: 1px; height: 10px; background: var(--hm-accent)`. The 1px accent stub
that visually attaches the card to the element it belongs to. When the anchor
can't be resolved it becomes a **dashed** stub:
`repeating-linear-gradient(180deg, --hm-ink-20 0 4px, transparent 4px 8px)`.

**`.hm-card-label`** — `MarginMark 11/4` + an uppercase 11px caption
("Note") in `--hm-ink-40`, `margin-bottom: 8px`, gap 6px.

**`.hm-textarea`** — the shared input for Composer, Viewer edit mode, Team note
edit and CommentComposer:

```css
.hm-textarea {
  display: block;
  width: 100%;
  min-height: 92px;
  resize: vertical;
  padding: 8px;
  font-family: var(--hm-serif);
  font-size: var(--hm-text-prose);
  line-height: 1.65;
  color: var(--hm-ink);
  background: var(--hm-paper);
  border: 1px solid var(--hm-border);
  border-radius: 6px;
}
:focus,
:focus-visible {
  outline: none;
  border-color: var(--hm-accent);
  box-shadow: var(--hm-halo);
}
```

Note it sits on `--hm-paper` (not `--hm-surface`) — the input reads as a well
inside the card.

**`.hm-note-body`** — reading mode: `--hm-serif` 15px/1.65, `white-space: pre-wrap`,
`overflow-wrap: break-word`.

**`.hm-row`** — `display: flex; align-items: center; justify-content: flex-end;
gap: 8px; margin-top: 12px`. `.hm-row--between` justifies to both ends.

**`.hm-meta`** / **`.hm-shared-with`** — 11px `--hm-ink-40` /
`--hm-accent-strong` 500. "Shared with {team}" reads as provenance, not a
control: "the same 11px meta voice as the timestamp it sits opposite, warmed to
the accent so the eye finds it."

### 9.4 Composer

`src/ui/Composer.tsx`. Structure:

```
div.hm-card[role=dialog aria-label="Note" aria-modal=false]
  span.hm-connector
  div.hm-card-label.hm-overline   MarginMark 11/4 + "Note"
  AttachedText                    (text notes only)
  NoteEditor                      textarea.hm-textarea.hm-prose, dir="auto", autofocus
    FolderPicker                  (one compact line under the textarea)
    InlineError                   (empty / save error)
    div.hm-row                    [Cancel] [Save]
```

`NoteEditor` (`src/ui/NoteEditor.tsx`) is the one note editor — the composer,
the viewer, the Library's row menu and a team note all use it. It validates
with `validateNoteContent` (**"A note needs some text."**, or too long), marks
the field `aria-invalid` + `aria-describedby`, and keeps the save button's label
while it works (`aria-busy` adds the arc). Keyboard: **Ctrl/⌘+Enter** saves
(`isSubmitChord`); **Escape** cancels this layer only (`escapeLayer`), so
naming a folder inside the composer closes the naming, not the composer.

**FolderPicker** — `.hm-folder-picker`: folder glyph (`pointer-events: none`) →
`FolderSelect` (the one folder `<select>`, nested folders indented with
non-breaking spaces, plus **Create folder**, which becomes a `NameField` in
place) → the default-folder star (`.hm-icon-btn`, `[aria-pressed]` accent). A
caption explains the star; `.hm-folder-picker__defaults` offers "always on this
page" / "always everywhere".

Native selects follow the card's scheme: `.hm-scope[data-hm-theme='dark'] select
{ color-scheme: dark }` — "or a dark card opens a glaring white list."

### 9.5 NoteViewer

`src/ui/NoteViewer.tsx`. Same card plus `.hm-viewer-card { padding-top: 36px }`,
clearing the corner zone where the two corner buttons live.

```
span.hm-connector[data-unavailable]
button.hm-icon-btn--small.hm-corner-start   pin toggle, [aria-pressed] → accent-strong
StatusLine warning            (only when the anchor can't be resolved)
AttachedText                  (text notes only)
  ├ editing → NoteEditor
  └ reading → p.hm-note-body.hm-prose[dir=auto]
InlineError
  ├ confirming → InlineConfirm "Delete this note?" [Keep it] [Delete]
  └ otherwise  → div.hm-row--between: timestamp + Edit/Delete, or "Shared with {team}"
button.hm-icon-btn--small.hm-corner-end     close
```

The two corner buttons are one class, `.hm-icon-btn--small` (22×22, `--hm-ink-40`),
placed by `.hm-corner-start` / `.hm-corner-end` — mirrored in RTL for free by
logical insets.

Anchor-unavailable status: warning text + 6px dot:

- element note — **"Page changed - showing last known position"**
- text note — **"Page changed - couldn't find this text"**

Footer modes: **editing** (`NoteEditor`'s `[Cancel] [Save changes]`) ·
**confirming delete** (`InlineConfirm`) · **shared with a team** (timestamp +
`.hm-shared-with`, no Edit or Delete — `mayMutateNote` says no) · **normal**
(timestamp + `[Edit] [Delete]`).

Escape unwinds one layer at a time — the editor or the question takes it first
and stops it there; only a viewer at rest closes.

### 9.6 Markers

**Saved-note marker** (`Marker.tsx`) — "the same margin-mark glyph as the logo,
at 14px, docked beside its anchor like a proofreader's margin tick. The most-seen
brand touchpoint."

```css
.hm-marker {
  position: fixed;
  z-index: var(--hm-z-marker);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 28px;
  padding: 0;
  border: none;
  background: var(--hm-surface);
  box-shadow:
    0 0 0 1px var(--hm-border),
    var(--hm-shadow-sm);
  border-radius: 6px;
  cursor: pointer;
  color: var(--hm-accent-strong);
}
```

| State            | Treatment                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| rest             | opaque chip + hairline + `elev-1` — "so the mark stays legible on ANY host background, never a transparent glyph lost over busy content" |
| `:hover`         | `--hm-marker-hover` bg, hairline → accent, `elev-2`, `translateY(-1px)`                                                                  |
| `:active`        | `--hm-accent` bg + `--hm-paper` glyph (the one inversion), `elev-1`, `translateY(0) scale(.94)`                                          |
| `:focus-visible` | `0 0 0 2px --hm-accent, 0 0 0 4px --hm-accent-tint`                                                                                      |

> "Lifts and warms, never thins out… so the feedback reads as 'this is a real,
> pressable thing' rather than as the chip fading away."
>
> "The one state where the mark inverts to paper, so a click always looks like it
> landed."

Position: immediately past the element's trailing edge, vertically centred on
its top. In RTL the marker is placed past the **right** edge and the glyph is
`scaleX(-1)`.

**Restore highlight** — `.hm-restore-highlight`: `position: fixed; border: 2px
solid --hm-accent; radius 3px; animation: hm-restore-pulse 1400ms ease-out` (halo
0 → 6px → 0, opacity 0 → 1 → 1 → 0). Duration is echoed in a JS cleanup timeout
so the node is removed as the animation finishes.

### 9.7 Text-selection action chip

`TextSelectionAction.tsx` — "the chip that appears beside a finished text
selection — the _only_ thing a selection does on its own."

`className="hm-marker hm-text-action"` at **22×24** (a `.hm-marker` one size
down), `MarginMark 13/3.6`, entrance `hm-text-action-in` (`scale(.85)` → none).

It is interactive (`pointer-events: auto`) because clicking it is the point, and
it appears **beside** the selection, never over it. In RTL it goes to the left of
the selection and flips.

`onMouseDown`'s `preventDefault` is load-bearing: without it the browser
collapses the page selection the instant the button takes the press.

Trigger keys that re-offer the chip: Shift, the four arrows, Home, End, PageUp,
PageDown, `a`/`A`. Detection is on `mouseup`/`keyup`, never `selectionchange`
(it fires continuously during a drag, and a chip appearing mid-drag "would be
exactly the 'interfering with normal selection' this must not do"). The read is
deferred one rAF — "the browser finalizes the selection after mouseup."

### 9.8 AttachedText

The page text a contextual note is attached to, as a quoted block:

```css
.hm-attached              { margin-bottom: 8px; }
.hm-attached .hm-overline { display: block; margin-bottom: 4px; }   /* the label, the one overline voice */
.hm-attached__quote       { .hm-serif; padding-inline-start: 8px;
                            border-inline-start: 2px solid var(--hm-accent);
                            body role, --hm-ink-60, 3-line clamp }
.hm-attached--compact .hm-attached__quote { 1-line clamp; body-sm role }
```

> "An accent rule down the inline-start edge — the margin mark's vertical stroke,
> in prose form."

The compact variant drops the label (a list row) and clamps to one line. Shared
by the in-page viewer and every Library row, "so a contextual note reads the same
wherever it turns up."

### 9.9 In-page highlights (CSS Custom Highlight API)

`src/content/text-highlights.ts`. **Nothing is inserted into the host page's
DOM** — `CSS.highlights.set('hamesh-text', …)`, so no virtual DOM is
invalidated, no handler detached, no link covered. Ranges crossing nested inline
elements work free; two notes' highlights can overlap the same words.

|                    | Light               | Dark                |
| ------------------ | ------------------- | ------------------- |
| background         | `rgba(accent, .28)` | `rgba(accent, .30)` |
| underline          | `rgba(accent, .85)` | `rgba(accent, 1)`   |
| flash background   | `rgba(accent, .45)` | `rgba(accent, .55)` |
| thickness / offset | `1px` / `2px`       | `1px` / `2px`       |

> "the brand accent at low alpha (plus an accent underline) so a highlight reads
> as an annotation **sitting in the page** rather than as a stuck browser text
> selection."

The one mark on the page is a single
`<style id="hamesh-text-highlight-styles" data-hamesh="text-highlight-styles">` in
`<head>` — `::highlight()` rules must live in the host document, "a rule inside
Hamesh's shadow root would never reach it."

Cursor: `::highlight()` has no `cursor` and no element to target, so the
document gets `html[data-hamesh-text-hover], html[data-hamesh-text-hover] * {
cursor: pointer !important }`.

**TextNotePopup** (`.hm-video-preview.hm-text-popup`) — hover pill over
highlighted text. It _is_ the video hover preview, "because it does the same
job"; it drops the timestamp ("a contextual note is a piece of text that is
already right there under the pill") and adds interactivity.

```css
.hm-text-popup {
  position: static;
  pointer-events: auto;
  cursor: pointer;
  max-width: 280px;
  text-align: start;
}
.hm-text-popup:hover {
  background: var(--hm-surface-hover);
} /* opaque */
.hm-text-popup:focus-visible {
  box-shadow:
    var(--hm-shadow-md),
    0 0 0 2px var(--hm-accent);
}
```

### 9.10 Video UI

**Timeline marker** — "a tiny tick, **not** the branded margin-mark chip. A video
timeline (often a site's own UI, e.g. YouTube's progress bar) needs to blend in,
not announce itself."

```css
.hm-video-marker {
  position: fixed;
  z-index: var(--hm-z-marker);
  width: 8px;
  height: 8px;
  padding: 0;
  border: 1.5px solid var(--hm-surface); /* a white ring so it reads on any frame */
  border-radius: 999px;
  background: var(--hm-accent);
  transform: translate(-50%, -50%);
}
.hm-video-marker:hover {
  background: var(--hm-accent-strong);
  transform: translate(-50%, -50%) scale(1.4);
}
.hm-video-marker:active {
  transform: translate(-50%, -50%) scale(1.1);
}
.hm-video-marker--cluster {
  width: 16px;
  height: 16px;
  display: inline-flex;
  color: #fff;
  font: var(--hm-sans);
  font-size: 10px;
  font-weight: 700;
}
```

> "Deliberately NOT interactive via pointer-events… A real, hit-testable overlay
> sitting on top of a video steals mouse hover from the actual player beneath it:
> the pointer leaves the player entirely the instant it's over this dot, hiding
> _their_ controls too."

Clicks are handled by coordinate proximity; keyboard activation (Tab +
Enter/Space) still works because it bypasses pointer hit-testing. Consequence:
`:hover`/`:active` are effectively unreachable by mouse today and are kept as the
visual neighbours of `:focus-visible`.

**Hover preview** (`.hm-video-preview`) — read-only, `pointer-events: none`,
`max-width: 240px`, `padding: 7px 10px`, radius 6px, surface + hairline +
`elev-2`, entrance `hm-video-preview-in` (`translateY(3px) scale(.94)`):

```
span.hm-video-preview__dot    6px accent pill
span.hm-video-preview__text   serif 12.5px, ellipsis, nowrap   (first line, not the body)
span.hm-video-preview__time   mono 11px, --hm-ink-40            (mm:ss)
```

**Cluster list** (`.hm-video-cluster-list`) — click-opened, so unlike the preview
it _is_ a real `.hm-card` at **260px** wide, `padding: 8px`. Inner
`<ul class="hm-video-cluster-list__items">` capped at `max-height: 220px;
overflow-y: auto`. Each row: `--hm-mono` 11px accent timestamp +
serif 13.5px ellipsised first line, `padding: 8px`, radius 3px,
`--hm-layer-hover` / `--hm-layer-focus` on focus. First row is focused on mount
so Escape reaches the card at all.

**Quick note** (`.hm-video-quick-note`) — "a smaller, chrome-less variant of
`.hm-card`: no label bar, no visible buttons, just the textarea. Keeps it feeling
like a margin note dropped over the video, not a dialog." **260px** wide,
`padding: 12px`, textarea `min-height: 52px`.

> "Enter saves, Shift+Enter inserts a newline, Escape closes. Enter on empty
> content just closes rather than showing a validation error — the point is to
> never interrupt watching."

Markers only appear while the player's own controls are visible.

### 9.11 Positioning engine

`src/content/useFloating.ts`.

Cards mount off-screen and hidden so real dimensions can be measured:

```ts
const HIDDEN_STYLE = { position: 'fixed', top: -9999, left: -9999, visibility: 'hidden' };
```

**`useFloating(getAnchorRect, { placement })`** — one hook; the geometry is two
pure functions, `placeBelow` and `placeAbove`, tested on their own:

```ts
const MARGIN = 12,
  GAP = 10;
// placeBelow — below-start, hugging a short anchor (capped at 24px), flipped
// above when there is no room below. The Composer and the Viewer.
// placeAbove — above-first; just inside the anchor when there is no room above,
// rather than off-screen. The text popup, video quick note, cluster list and
// video viewer, since a video note has no page element to anchor to.
// Both clamp to MARGIN from every viewport edge.
```

`FloatingViewer` in `HameshApp.tsx` is the one wrapper that floats a viewer
card: it takes the anchor-rect callback and the placement, so the page-note
viewer and the video-note viewer are the same component.

**Re-measurement** — a `useLayoutEffect` runs `reposition()` immediately, then on
`scroll` (passive, **capture**) and `resize` (passive). Capture catches scrolling
in _any_ nested container.

**Deferred focus** — `useFloating(…, { autoFocus: true })`. A plain `autoFocus`
on a textarea inside these cards "silently does nothing," because the card
mounts `visibility: hidden` and React's `autoFocus` only fires once, on that
first still-hidden commit. The hook focuses once, on the transition to visible;
the selector prefers `textarea`, then `input`, then `[tabindex]`.

### 9.12 In-page state machine

| Mode          | What's visible                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------- |
| **Idle**      | Saved-note markers, video markers (when player controls are visible), text highlights. Nothing else |
| **Selecting** | `.hm-capture` at `crosshair`, `.hm-hover-outline`, `SelectionHint`. Markers for other notes remain  |
| **Composing** | `Composer` above `elev-3`, anchored to the element by `.hm-connector`                               |
| **Viewing**   | `NoteViewer`, with `viewerEditing` as a sub-state                                                   |
| **Sharing**   | Not a mode — a property of the note (`!!note.team`)                                                 |

**A single outside click does not close the composer.** It holds an unsaved note,
and a stray or deliberate page click — to copy something into the note — must not
throw it away. **Two** clicks are required.

**Sharing** effects on the in-page viewer: editing cannot start; no pin toggle;
the footer shows timestamp + "Shared with {team}" only; and every local write is
gated by `isLocal(noteId)` — "the marker, the card and the viewer already hide
the controls, and this is what makes hiding them beside the point."

**Keyboard**

| Key                     | Effect                                                                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alt+H**               | `activate()` — element selection (`preventDefault`)                                                                                                                                                                                     |
| **Alt+V**               | `activateVideo()` — video quick note (`preventDefault`)                                                                                                                                                                                 |
| **Alt+T**               | `startTextNote()` for the current selection (**not** prevented — `activateText` is a no-op without a valid selection, "and swallowing the key on a page that binds it to something else would be wrong when Hamesh isn't going to act") |
| **Escape**              | selection mode → off · composer → cancel · viewer → three-step unwind · cluster list → close · quick note → cancel                                                                                                                      |
| **Ctrl/Cmd+Enter**      | save (Composer)                                                                                                                                                                                                                         |
| **Enter / Shift+Enter** | save / newline (VideoQuickNote)                                                                                                                                                                                                         |

Shortcuts match on `event.code`, not `event.key` — "same as Chrome's own
accelerator matching — this stays correct regardless of the active keyboard
layout" — and all four modifiers must match exactly.

---

## 10. Cross-cutting behaviour

### 10.1 Appearance (light / dark / match website)

Three modes, chosen in Settings and persisted in
`local:hamesh:preferences`:

```
match-website (default) | light | dark
```

**On a host page** (`src/content/theme.ts`) — a four-step algorithm that decides
only light/dark; it never derives colours:

1. Walk up from `<body>` sampling `getComputedStyle(el).backgroundColor`.
   `parseColorLuminance` returns `null` for `a === 0` ("fully transparent — keep
   looking") and computes `(0.2126r + 0.7152g + 0.0722b) / 255` — an sRGB
   approximation, not the full WCAG formula.
2. Walk **down** single-child chains (max 12 deep, exactly one child each) —
   nested app shells (React/Vue root divs) leave body/html transparent and put
   the real background a few levels down. This is deterministic, unlike a
   hit-test at an arbitrary viewport point, and bounded, so it "doesn't wander
   into unrelated branching content."
3. `lum < 0.4 ? 'dark' : 'light'`.
4. Fall back to `prefers-color-scheme: dark`.

The whole thing is wrapped in `try/catch` — "never break the host page over
theming." Applied as `data-hm-theme` on the shadow root.

**Re-detection** (only while `match-website`) — two `MutationObserver`s on
`<html>` and `<body>` with `attributeFilter: ['class','style']` (attribute
changes only, "cheap, and doesn't fire on ordinary content mutations"), plus a
`prefers-color-scheme` `change` listener, all debounced **200 ms**.

**On extension pages** there is no host page to inspect, so the OS scheme is
used directly (`popup/App.tsx:12-14`): "the closest analog to 'Match website' for
Hamesh's own chrome." It is read once at module scope, so a live OS flip does
not re-render the popup.

The **only** dark-specific CSS rule outside the token block is the folder
`<select>`'s `color-scheme: dark`.

### 10.2 RTL

Direction comes from the **selected UI language**, not the host page and not the
browser locale at render time:

```ts
dirForLang(lang) => lang === 'ar' ? 'rtl' : 'ltr';
resolveLang(uiLanguage) => uiLanguage.startsWith('ar') ? 'ar' : 'en';
```

`src/ui/i18n.ts:495-506`. Applied as `dir` on the inner `.hm-scope` wrapper —
never on `<html>`.

| Mechanism          | Effect                                                                                                                                                                                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Font swap          | `.hm-scope[dir='rtl'], .hm-scope [dir='rtl'] { font-family: var(--hm-arabic) }` — the whole UI, and any element explicitly marked RTL                                                                                                                                                                                                   |
| Note text          | `.hm-prose` / `.hm-serif` on every note body, preview, quote and release item. A `dir="auto"` element that resolves RTL keeps the attribute `auto`, so it is the serif stack's own Arabic fallbacks that give it an Arabic face, and `font-synthesis: none` that keeps the browser from slanting it (`:dir()` cannot be used — see §11) |
| Logical properties | `border-inline-start`, `padding-inline-start`, `margin-inline-start: auto`, `inset-inline-start/end`, `text-align: start` — flip automatically                                                                                                                                                                                          |
| Slide mirroring    | popup track `+50%` instead of `-50%`                                                                                                                                                                                                                                                                                                    |
| Chevron mirroring  | `ChevronIcon direction="forward" \| "back"` carries `.hm-mirror`, and one rule turns every such glyph in RTL — nothing is flipped by hand                                                                                                                                                                                               |
| Marker mirroring   | `MarginMark flip` → `scaleX(-1)`, so the tick points into the reading direction; the marker also moves past the element's _right_ edge                                                                                                                                                                                                  |
| Folder chevron     | `scaleX(-1)` / `scaleX(-1) rotate(90deg)` so it still points at the glyph                                                                                                                                                                                                                                                               |
| Menu anchoring     | `NoteActionsMenu` reads `getComputedStyle(trigger).direction` and sets `left` instead of `right`                                                                                                                                                                                                                                        |
| Bidi isolation     | `<bdi>` around emails, display names, payment references, `Shared with {team}`                                                                                                                                                                                                                                                          |
| Content direction  | every user-authored text element carries `dir="auto"` — mixed Arabic/Latin lays out correctly either way                                                                                                                                                                                                                                |
| Wordmark           | `.hm-popup__brand--ar` at the title role (15px/1.4) — Arabic needs the larger step and tighter leading                                                                                                                                                                                                                                  |
| Dates              | `Intl.DateTimeFormat(lang, { dateStyle: 'medium' })`                                                                                                                                                                                                                                                                                    |

**Not mirrored:** the panel disclosure chevron (`.hm-panel__summary::before`),
which is drawn with `border-inline-end` + `border-block-end` — it ends up pointing
the opposite horizontal way from LTR but still opens downward.

### 10.3 Accessibility

- **Focus** is always visible and never `outline: none` without a replacement.
  Fields get the wider `--hm-halo`; buttons get the two-step ring; rows get an
  inset ring so it doesn't get clipped.
- **Hit areas** are 32px minimum (44px coarse) via invisible `::after` — except
  over host pages, where an invisible target would eat the page's own clicks.
- **Busy** is `aria-busy` + a visible arc, so the label never changes and the
  width never jumps.
- **Status/error** roles: `role="status"` (polite) for informational lines,
  `role="alert"` for refusals.
- **Collapsed regions** get `aria-hidden` + `inert`.
- **Failures are reported per control**, never page-wide — a `run(key)` model
  where each button carries its own error.
- Icon-only buttons always have `aria-label`; decorative SVGs are `aria-hidden`.
- `.hm-visually-hidden` for announcements (loading state).
- Reduced-motion honoured in CSS and in the two `scrollIntoView` calls.

### 10.4 Micro-typography patterns worth naming

| Pattern                                                                       | Where                                                                         |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `.hm-overline` — uppercase label role, `--hm-ink-40`, `letter-spacing: .06em` | card labels, Continue/Pinned titles, attached-text label, menu section labels |
| `.hm-prose` — serif italic for a note's own words                             | every note body, preview, editor and shared note                              |
| Prose clamped to 2 lines for a note preview                                   | `.hm-note-row__preview` (Pinned uses the same row)                            |
| Serif 15px/1.65 for the note itself                                           | `.hm-note-body`, `.hm-textarea`                                               |
| Mono for technical strings only                                               | shortcut badges, `/` hint, versions, timestamps, references, invite codes     |
| `.hm-hint` inverted ink-on-paper                                              | the selection-mode pill                                                       |
| Accent kicker instead of a chip                                               | pinned rows, cross-site domain rows                                           |
| Dashed pill outline                                                           | "+ New team", "+ New folder", "+ Invite someone"                              |
| Avatar monogram, never an image                                               | member lists, mentions                                                        |

---

## 11. Known visual defects

Found while documenting 1.4.0, and what became of each.

| #    | Defect                                                                                                                                                                                  | Status                                                                                                                                                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11.1 | `--hm-motion-state`, `--hm-motion-emphasized` and `--hm-motion-pop` referenced themselves, so every hover transition, the popup slide and every entrance animation silently did nothing | **Fixed.** Each intent is now built from primitives (`--hm-motion-state: var(--hm-dur-fast) var(--hm-ease-out)`, …). `tests/ui/tokens.test.ts` fails on any custom property that refers to itself and pins the shape of every motion intent |
| 11.2 | The popup rendered skeleton/empty/fade-in classes whose rules lived only in `notes-library.css`                                                                                         | **Fixed.** Those rules moved to `pages.css`, which both pages import; the popup renders the kit's `Skeleton` and `EmptyState size="compact"`                                                                                                |
| 11.3 | `html`/`body` never received dark tokens, so pages painted a white document behind a dark app                                                                                           | **Fixed.** `usePageBackground` (`src/ui/hooks/usePageBackground.ts`) paints the document from the scope's own token, in both the popup and the Library                                                                                      |
| 11.4 | Dead CSS and unused props (`.hm-text-popup__text`, `.hm-folder-picker__empty`, `.hm-comment-thread`, `Marker.badge`, `VideoMarkerPreview.color`, dead strings)                          | **Fixed.** The text popup and video preview share `PreviewPill`; the dead rules, props (`Marker.badge` and its `.hm-marker__badge`, `VideoMarkerPreview.color`) and strings are gone. `.hm-panel__title` is now a real `h2` with a rule     |
| 11.5 | An inline `fontSize`/`fontFamily` on the viewer's delete question                                                                                                                       | **Fixed.** The question is `InlineConfirm`; no inline type remains, and `tests/ui/tokens.test.ts` forbids numeric font sizes                                                                                                                |
| 11.6 | No `:disabled` styling on ghost buttons, links or inputs                                                                                                                                | **Fixed.** `.hm-btn:disabled`, `.hm-link:disabled`, `.hm-input:disabled`, `.hm-icon-btn:disabled`, `.hm-switch:disabled`, `.hm-menu__item:disabled` all use `--hm-state-disabled` and a not-allowed cursor                                  |
| 11.7 | Popup header omits the shortcut badge when unset; Settings says "Not set"                                                                                                               | **Kept, deliberately.** Both read `useShortcuts()`; the header is chrome and shows a keycap only when there is one to press, the Settings row is where an unset shortcut is explained and fixed                                             |

Also fixed with the refactor, from `FEATURE-MODULE-AUDIT.md` §5: long pinned
notes are expandable (Pinned renders `NoteRow`); nested folders indent on a
team note (one `FolderSelect`); orphaned team notes show as unfiled (one
`resolveFolderId`); the Library reports failed writes beside the note
(`useNoteMutations` → `NoteRow` alert). And: folders whose parent is missing
now show at the top level of the tree instead of disappearing.

**Arabic prose.** Notes are set in italic serif (`.hm-prose`). Arabic has no
italic, and `:dir(rtl)` cannot be used — the Tailwind/lightningcss pipeline
lowers it to a `:lang()` list that never matches. So `--hm-serif` carries Arabic
fallbacks and `.hm-prose` sets `font-synthesis: none`: an Arabic note falls
through to an Arabic face and is never slanted by the browser.
`tests/ui/tokens.test.ts` rejects `:dir(` in any sheet.

---

## Appendix — file map

| Concern                                                                                                                           | File                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens + what a web page needs (cards, buttons, inputs, markers, in-page UI)                                                      | `src/ui/tokens.css`                                                                                                                                                                                                                                                                                                 |
| What Hamesh's own pages share (page frame, cards, panels, empty/skeleton, segmented, switch, menu, avatar, settings rows, keycap) | `src/ui/pages.css`                                                                                                                                                                                                                                                                                                  |
| `notes.html`-only (sidebar, Library, What's New, narrow layout)                                                                   | `src/ui/notes-library.css`                                                                                                                                                                                                                                                                                          |
| Teams-only                                                                                                                        | `src/ui/teams/teams.css` (injected by `src/ui/teams/styles.ts`)                                                                                                                                                                                                                                                     |
| Popup-only                                                                                                                        | `src/entrypoints/popup/App.css`                                                                                                                                                                                                                                                                                     |
| UI kit (primitives with no feature knowledge)                                                                                     | `src/ui/kit/` — `Page`, `Section`/`Panel`, `EmptyState`, `Skeleton`, `Feedback` (`InlineError`/`StatusLine`/`Busy`), `InlineConfirm`, `Menu`, `NameField`, `SegmentedControl`, `Switch`, `SettingRow`, `Avatar`, `Breadcrumb`, `MarginMark`, `icons`, `keys` (`isSubmitChord`, `escapeLayer`), `motion` (`stagger`) |
| Shared hooks                                                                                                                      | `src/ui/hooks/` — `useWork` (keyed busy/failure), `useNoteMutations`, `useFolders`, `usePreferences`, `useShortcuts`, `usePageBackground`                                                                                                                                                                           |
| Formatting                                                                                                                        | `src/ui/format.ts` — `relativeTime`, `formatDate`, `formatMoney`                                                                                                                                                                                                                                                    |
| Note & folder UI shared by page and Library                                                                                       | `src/ui/NoteEditor.tsx`, `FolderSelect.tsx`, `FolderMenu.tsx`, `FolderPicker.tsx`, `PreviewPill.tsx`                                                                                                                                                                                                                |
| Library views                                                                                                                     | `src/ui/library/`                                                                                                                                                                                                                                                                                                   |
| Settings views                                                                                                                    | `src/ui/settings/`                                                                                                                                                                                                                                                                                                  |
| Popup app                                                                                                                         | `src/entrypoints/popup/App.tsx`                                                                                                                                                                                                                                                                                     |
| Notes Library shell                                                                                                               | `src/entrypoints/notes/App.tsx`                                                                                                                                                                                                                                                                                     |
| In-page orchestrator                                                                                                              | `src/content/HameshApp.tsx`                                                                                                                                                                                                                                                                                         |
| Shadow mount                                                                                                                      | `src/entrypoints/content.ts`                                                                                                                                                                                                                                                                                        |
| Positioning hook                                                                                                                  | `src/content/useFloating.ts` (one hook, `placement: 'below' \| 'above'`)                                                                                                                                                                                                                                            |
| Theme detection                                                                                                                   | `src/content/theme.ts`, `resolveTheme` in `src/domain/preferences.ts`                                                                                                                                                                                                                                               |
| Text highlights                                                                                                                   | `src/content/text-highlights.ts`                                                                                                                                                                                                                                                                                    |
| Strings (en/ar)                                                                                                                   | `src/ui/i18n.ts`; Teams: `src/ui/teams/strings.ts` (shares the core vocabulary)                                                                                                                                                                                                                                     |
| Preferences                                                                                                                       | `src/domain/preferences.ts`, `src/storage/preferences-repository.ts`                                                                                                                                                                                                                                                |
| Release notes                                                                                                                     | `src/domain/release-notes.ts`                                                                                                                                                                                                                                                                                       |
| Cross-tab restore                                                                                                                 | `src/entrypoints/notes/openNote.ts`, `revealElement` in `src/utils/dom.ts`                                                                                                                                                                                                                                          |
| Architecture                                                                                                                      | `docs/architecture.md`; code factoring: `docs/FEATURE-MODULE-AUDIT.md`                                                                                                                                                                                                                                              |
