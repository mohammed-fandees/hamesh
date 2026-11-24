# 06 Review before release

**Phase:** E
**Depends on:** 04
**Status:** done

## Goal

The owner asked for a review of the whole change (`613b03e...HEAD`) before release: one pass
against the repo's rules, one against the proposal. What it found, what was fixed, and what is
left for the owner.

## Steps

- [x] 1. A kept element note opened from the Library was highlighted on the x/y fallback's guess,
      and its viewer attached there: the silent failure this feature exists to remove. Now a
      lost or kept note is never placed on the guess (`placedElement` in `HameshApp`)
  - Test: `tests/content/HameshApp.lost-notes.test.tsx`, "a note kept without a place"
- [x] 2. Health changes in one tab could overlap (a verdict and "Put it back" reading the same
      map) and drop each other's write. They now run one after another
  - Test: `tests/storage/anchor-health-repository.test.ts`, "writes that overlap"
- [x] 3. The Library's filter was a use with no count (rules §12): `lost.filtered`, counted when
      it is turned on
  - Test: `tests/ui/library/LostFilter.test.tsx`
- [x] 4. A physical `margin-bottom` in the list's CSS is now `margin-block-end` (rules §5)
  - Test: none (style)
- [x] 5. E2E for putting an element note back, beside the one for words
  - Test: `e2e/lost-notes.spec.ts`, "an element note is put back…"

## For the owner

- **Version.** Rules §11 call this a MINOR (2.4.0); it is 2.3.1 as asked.
- **"It shows as a page-level note."** Hamesh has no page-level note, so a note kept without a
  place is not shown on its page at all; it lives in the Library and the export. Building one is
  its own piece of design.
- **Team notes** are not checked (Decisions). A team note that loses its place still does so
  silently.
- **Export wording** is "No longer found on the page" rather than the proposal's "lost its
  place", because kept notes get the same line and were not lost to the reader.
- **Two tabs at once** (a restored session, a duplicated tab) count as two visits. Rare, and the
  next visit that finds the note clears it.

## Left as they are

Hard-coded sizes that match the neighbouring filter pills (`5px 14px`), the hand-written Arabic
counts (the same form the export strings use), and small duplications (two empty-set constants,
two read-and-watch effects) that read more plainly than a shared helper would.
