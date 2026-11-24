# 04 Library and export

**Phase:** D
**Depends on:** 01
**Status:** pending

## Goal

The Library says which notes lost their place and can show only those; the Markdown export never
claims a place a note no longer has.

## Files

- Create: `src/ui/hooks/useAnchorHealthMap.ts`, `src/ui/library/LostNotes.ts` (context)
- Change: `src/ui/library/LibraryView.tsx` (filter pill), `src/ui/library/NoteRow.tsx` (mark)
- Change: `src/ui/notes-library.css` (`.hm-lost-filter`, `.hm-note-row__lost`)
- Change: `src/entrypoints/notes/App.tsx` (read, watch, prune; hand the ids to the list and export)
- Change: `src/domain/export/render.ts`, `strings.ts` (the line), `src/ui/export/useExport.tsx`
- Change: `docs/plans/markdown-export/FORMAT.md` (the line, documented)

## Steps

- [ ] 1. `useAnchorHealthMap(repo)`: the map, kept live by `watch`
  - Test: `tests/ui/useAnchorHealthMap.test.tsx`
- [ ] 2. The notes page prunes entries of deleted notes once its notes have loaded
  - Test: `tests/entrypoints/notes/lost-notes.test.tsx`
- [ ] 3. Filter pill "Lost their place · N", shown only when there are some; pressed shows only
      them; it turns itself off when the last one is put back
  - Test: `tests/ui/library/LostFilter.test.tsx`
- [ ] 4. A quiet mark on each lost note's row
  - Test: same file
- [ ] 5. Export: `RenderOptions.placeless`; a lost or kept note gets "⚠ No longer found on the
      page" under its quote or element, in every layout; glossary puts it in the context cell
  - Test: `tests/domain/export/placeless.test.ts`; existing example tests unchanged
- [ ] 6. `useExport` reads the health store with the notes
  - Test: `tests/ui/export/useExport.test.tsx`

## Phase integration test

`tests/entrypoints/notes/lost-notes.test.tsx`: the Library with one lost and one kept note shows
one mark and a pill of 1; the export of that page carries the line for both.

## Done when

- All steps ticked; checked in Arabic and English, light and dark.
