# 02 Detection on the page

**Phase:** B
**Depends on:** 01
**Status:** done

## Goal

Each visit to a page ends with one verdict per note — found or not — taken only after the page
has settled, and written to the health store. Notes already lost stop drawing a marker on a
guessed element.

## Files

- Create: `src/content/visit-watch.ts` (timers and the quiet check, no React)
- Create: `src/content/anchor-outcomes.ts` (which notes are checked, and how each one did)
- Create: `src/content/useAnchorHealth.ts` (the hook `HameshApp` uses)
- Change: `src/content/HameshApp.tsx` (`healthRepo` prop, start a visit per page, hide markers)
- Change: `src/entrypoints/content.ts` (creates the repository)

## Steps

- [x] 1. `watchVisit({ evaluate, onVerdict, observe })`: checks when the page has been quiet for
      3 s, decides once 10 s have passed and a quiet check happened, or at 30 s; a note found at
      any check counts as found; stops itself after the verdict and on `stop()`
  - Test: `tests/content/visit-watch.test.ts` with fake timers: quiet page → verdict at 10 s;
    late section found at 6 s → found; busy page → verdict at 30 s; stopped early → no verdict
- [x] 2. `anchorOutcomes(notes, textEnabled)`: own element and text notes only; `Exact`/`Probable`
      found, `Fallback`/`Unresolved` missed; text notes skipped while text notes are off; video and
      team notes never checked
  - Test: `tests/content/anchor-outcomes.test.ts`
- [x] 3. `useAnchorHealth(repo, pageKey, evaluate)`: reads and watches the map, starts one visit
      per page key (a new one after SPA navigation), records the verdict; exposes `keep` and
      `clear`
  - Test: `tests/content/useAnchorHealth.test.tsx`
- [x] 4. `HameshApp`: a lost or kept element note that isn't found right now draws no marker
  - Test: `tests/content/HameshApp.lost-notes.test.tsx`: a seeded lost element note at
    `Fallback` has no marker; the same note found exactly has one

## Phase integration test

`tests/content/HameshApp.lost-notes.test.tsx`: render the page app over a document without the
note's element, advance past the verdict on two mounts, and the store says `lost`; a mount over a
document that has the element clears it.

## Done when

- All steps ticked; no change to what a reader sees beyond the hidden guess-marker.
