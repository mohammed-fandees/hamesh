# 04 Library and export

**Phase:** D
**Depends on:** 01
**Status:** done

## Goal

The Library says which notes lost their place and can show only those; the Markdown export never
claims a place a note no longer has.

## Files

- Create: `src/ui/hooks/useAnchorHealthMap.ts` (reads, watches, prunes), `src/ui/library/LostNotes.ts` (context)
- Change: `src/ui/library/LibraryView.tsx` (filter pill), `src/ui/library/NoteRow.tsx` (mark)
- Change: `src/ui/notes-library.css` (`.hm-lost-filter`, `.hm-note-row__lost`)
- Change: `src/entrypoints/notes/App.tsx` (hand the lost ids to the list, the placeless ids to export)
- Change: `src/domain/export/render.ts`, `strings.ts` (the line), `src/ui/export/useExport.tsx`
- Change: `docs/plans/markdown-export/FORMAT.md` (the line, documented)

## Steps

- [x] 1. `useAnchorHealthMap(repo)`: the map, kept live by `watch`
  - Test: `tests/ui/useAnchorHealthMap.test.tsx`
- [x] 2. The notes page prunes entries of deleted notes once its notes have loaded
  - Test: `tests/entrypoints/notes/lost-notes.test.tsx`
- [x] 3. Filter pill "Lost their place · N", shown only when there are some; pressed shows only
      them; it turns itself off when the last one is put back
  - Test: `tests/ui/library/LostFilter.test.tsx`
- [x] 4. A quiet mark on each lost note's row
  - Test: same file
- [x] 5. Export: `RenderOptions.placeless`; a lost or kept note gets "⚠ No longer found on the
      page" under its quote or element, in every layout; glossary puts it in the context cell
  - Test: `tests/domain/export/placeless.test.ts`; existing example tests unchanged
- [x] 6. `useExport` reads the health store with the notes
  - Test: `tests/ui/export/useExport.test.tsx`

## Phase integration test

`tests/entrypoints/notes/lost-notes.test.tsx`: the real notes page over seeded storage with one
lost, one kept and one stale entry: a filter of 1, the mark on the lost note only, and the
deleted note's entry pruned. The export's line is covered by `placeless.test.ts` and
`useExport.test.tsx`.

## Done when

- All steps ticked; checked in Arabic and English, light and dark.

## Notes

- The prune skips an empty notes list: that is as likely a read that failed as a library with no
  notes, and a stale entry costs nothing (every surface reads health only for notes it holds).
- The filter counts lost notes among those the owner filter shows, and turns itself off when
  the last one is put back, rather than leaving an empty list.
- Kept-without-place notes carry no mark in the Library (the reader chose to stop being told),
  but the export still says they have no place.
- A health store that can't be read never stops an export; it only leaves the line out.
- With the filter on, the site cards open and Continue and Pinned step aside, as they do for a
  search: found in the screenshots, where the filter showed a closed card.
- **Checked in Chromium** with a scratch spec (deleted): the Library with the filter on, in
  Arabic and English, light and dark.
