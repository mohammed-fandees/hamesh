# 01 Health model and storage

**Phase:** A
**Depends on:** none
**Status:** done

## Goal

The pure rules for when a note is lost, the store that remembers it per device, and the one new
write a note needs: a new anchor that keeps everything else.

## Files

- Create: `src/domain/anchor-health.ts`
- Create: `src/storage/anchor-health-repository.ts`
- Change: `src/domain/note.ts` (`updateNoteAnchor`)
- Change: `src/storage/notes-repository.ts` (`setAnchor`)
- Change: `src/ui/hooks/useNoteMutations.ts` (`reanchor`)
- Change: `src/domain/usage.ts` (`lost.reattached.text`, `lost.reattached.element`, `lost.kept`)

## Steps

- [x] 1. `nextAnchorHealth(previous, outcome, { pageKey, now })`: resolved clears; a first miss is
      `suspect` (1); a second visit's miss is `lost` (2, capped); `kept-without-place` stays kept
      on a miss and clears on a resolve
  - Test: `tests/domain/anchor-health.test.ts`: every transition, "one miss never flags",
    "resolved clears lost", "kept stays kept", misses capped at 2
- [x] 2. `parseAnchorHealth(value)`: by hand, zod-free; drops entries with an unknown status, a
      bad count or no page key
  - Test: same file: junk in, only valid entries out
- [x] 3. `applyVisit(map, pageKey, outcomes, now)` and `isPlaceless(entry)`: the whole map after one
      visit, and `null` when nothing changed (so nothing is written)
  - Test: same file: an all-resolved visit on a page with no entries returns `null`
- [x] 4. `createAnchorHealthRepository()`: `read`, `recordVisit`, `keepWithoutPlace`, `clear`,
      `prune(existingIds)`, `watch`; writes only when the map changed
  - Test: `tests/storage/anchor-health-repository.test.ts` against a fake `storage` that fires watchers like `onChanged`
- [x] 5. `updateNoteAnchor(note, anchor, capture)`: new anchor and section, same id, content,
      folder, pin, team, `createdAt`; `updatedAt` moves
  - Test: `tests/domain/note.test.ts`
- [x] 6. `NotesRepository.setAnchor` and `NoteMutations.reanchor`, refusing a team's note
  - Test: `tests/storage/notes-repository.test.ts`; `tests/ui/useNoteMutations.test.tsx`
- [x] 7. Usage names for the three uses
  - Test: `tests/domain/usage.test.ts` (shape check covers them)

## Phase integration test

`tests/storage/anchor-health.integration.test.ts`: two visits with a miss flag a note, a third
visit that resolves it clears it, `prune` drops a deleted note's entry, and `reanchor` writes the
note with its folder and pin intact.

## Done when

- All steps ticked; `pnpm test` green.
