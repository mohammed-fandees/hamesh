# 8 — The page itself: paper edges and grain (owner's option D)

**Goal:** a quiet layer behind and over the whole site so the cream reads as paper.
**Canvas:** Backgrounds artboard, option D.

## Decisions

| Concern  | Decision                                                          | Why                                                   |
| -------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| Edges    | A fixed radial darkening toward the screen's edges, behind all    | A page darkens a little at its edges                  |
| Grain    | A 180px SVG noise tile as a background, in the ink's colour       | Drawn once; no blend mode, so scrolling costs nothing |
| Option C | Built (margin rules with a reading light), then removed on review | The owner did not like the two lines                  |

## Steps

- [x] Tokens for light and both dark blocks (`--page-edge`, `--grain`, `--grain-strength`); the
      dark-blocks test still passes
- [x] `landing/css/ambient.css` and the two layers in `landing/index.html`
- [x] e2e: both layers fixed, `aria-hidden`, never take the pointer; the grain is faint
- [x] Option C removed: its script, styles, tokens, tests, and the sheet under the hero window
- [ ] Owner review of the result
