# 01 Capture section and chapter

**Phase:** A
**Depends on:** none
**Status:** done

## Goal

Every new note records the heading it was written under, or the video chapter it was written
in, so an export can group notes around the parts of a page. Read once, at write time.

## Files

- Change: `src/domain/note.ts` (`NoteCapture`, `Note.capture`, `CreateNoteInput.capture`, `parseNoteCapture`)
- Change: `src/storage/notes-repository.ts` (sanitise `capture` on read)
- Create: `src/content/capture-context.ts` (`sectionHeadingFor`)
- Change: `src/content/video-adapters/types.ts`, `youtube.ts` (`getChapterTitle`)
- Change: `src/content/HameshApp.tsx` (pass `capture` on both create paths)

## Steps

- [x] 1. `NoteCapture` type, `createNote` keeps a non-empty capture, `parseNoteCapture` trims, caps at 160 characters and drops anything that is not a string
  - Test: `tests/domain/note.test.ts`: capture kept, empty capture omitted, junk dropped
- [x] 2. Stored notes are read through `parseNoteCapture`
  - Test: `tests/storage/notes-repository.test.ts`: a stored note with a bad capture reads without it
- [x] 3. `sectionHeadingFor(node)`: nearest heading before the node (h2–h6 or `role=heading` level 2+), the heading itself when the node is inside one, nothing when the nearest is an h1; trailing `#`/`¶` anchor glyphs removed
  - Test: `tests/content/capture-context.test.ts`: docs page, intro before first h2, inside a heading, hidden heading skipped, anchor glyph removed
- [x] 4. YouTube adapter reads the current chapter from the player (`.ytp-chapter-title-content`)
  - Test: `tests/content/video-adapters/youtube.test.ts`: chapter read, none when absent or empty
- [x] 5. Composer saves `capture.section` (element and text notes) and the video quick note saves `capture.chapter`
  - Test: `tests/content/HameshApp.text-notes.test.tsx`: a text note under an h2 is stored with that section

## Phase integration test

`tests/content/HameshApp.text-notes.test.tsx` (the composer round trip through the repository).

## Done when

- All steps ticked and their tests pass; old notes load unchanged.

## Notes
