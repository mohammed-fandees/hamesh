# 03 The page's pill, list and re-attach

**Phase:** C
**Depends on:** 02
**Status:** pending

## Goal

"2 notes couldn't find their place" at the page's corner; opening it lists them with **Put it
back** and **Keep without a place**. Putting one back uses the same selection the reader already
knows, and the note keeps its id, words, folder, pin and dates.

## Files

- Create: `src/ui/lost/LostNotesPill.tsx`, `LostNotesList.tsx`, `ReattachBar.tsx`
- Change: `src/ui/i18n.ts` (`lostNotes` strings, English and Arabic)
- Change: `src/ui/tokens.css` (`.hm-lost-*`, tokens only)
- Change: `src/content/HameshApp.tsx` (pill, list, re-attach modes, restore flow, `isOnHameshUi`,
  usage counts through an injectable `count`)
- Create: `e2e/lost-notes.spec.ts`, `e2e/fixtures/lost-page.html`

## Steps

- [ ] 1. Strings in both languages, with Arabic counts (one, two, 3–10, 11+)
  - Test: `tests/ui/i18n.test.ts` (both languages have every key); `tests/ui/lost/strings.test.ts`
    for the counts
- [ ] 2. `LostNotesPill`: a button with the count, `aria-expanded`; hidden at zero
  - Test: `tests/ui/lost/LostNotesPill.test.tsx`
- [ ] 3. `LostNotesList`: a dialog card; each note shows its quote (words) or what it was on
      (element), its first line, and the two actions; Escape and the close button close it
  - Test: `tests/ui/lost/LostNotesList.test.tsx`: actions by role, per note
- [ ] 4. `ReattachBar`: what to do now and Cancel; Escape cancels
  - Test: `tests/ui/lost/ReattachBar.test.tsx`
- [ ] 5. Put it back, element: selection mode with the bar; a click writes the new anchor, flashes
      the element, clears the note's health, counts `lost.reattached.element`
  - Test: `tests/content/HameshApp.lost-notes.test.tsx`
- [ ] 6. Put it back, words: the bar asks for a selection; the selection chip reads "Put the note
      here" (even when the chip is off in Settings); its click writes the anchor, counts
      `lost.reattached.text`
  - Test: same file
- [ ] 7. Keep without a place: health becomes `kept-without-place`, the note leaves the list,
      counts `lost.kept`; a failed write counts nothing
  - Test: same file
- [ ] 8. Open from the Library: a lost note's restore waits the usual grace, then opens the list
      instead of an empty viewer
  - Test: same file
- [ ] 9. `isOnHameshUi` knows the pill, list and bar; screenshots RTL/LTR, light/dark
  - Test: same file (a press on the pill doesn't close the list); `e2e/zz-lost-shots.spec.ts`
    (scratch, deleted before commit)

## Phase integration test

`e2e/lost-notes.spec.ts`: a page whose words change between visits is flagged on visit 2, not 1;
Put it back → highlight back and the pill gone; a section that loads after 2 s is never flagged.

## Done when

- All steps ticked; checked in Arabic and English, light and dark.
