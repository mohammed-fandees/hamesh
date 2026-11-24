# 07 The owner's decisions after the review

**Phase:** F
**Depends on:** 06
**Status:** in progress

## Goal

What the owner decided on 2026-11-24, after reading the review (06):

- The version stays 2.3.1: these are parts of one release, not features of their own.
- A note kept without a place is shown on its page, with what Hamesh already has, as a quiet
  line that the page has a note with no place on it.
- Team notes get the same treatment: every member sees that one lost its place; only its
  author may put it back or keep it.
- Readers who haven't turned on usage sharing are asked by a side bubble in the Library, every
  time it opens, until they turn it on or say not to show it again. Turning it on is counted at
  once. This is for us, not for the reader: changelog only, never What's New.

## Steps

### Kept notes on the page

- [x] 1. The corner pill speaks of kept notes quietly when no note is lost ("1 note without a
      place here", no warning colour); the list shows kept notes whole, after the lost ones, with
      Put it back alone
  - Test: `tests/ui/lost/lost-notes-ui.test.tsx`; `tests/content/HameshApp.lost-notes.test.tsx`
- [x] 2. Keeping a note moves it into that quiet part of the list rather than out of sight;
      opening a kept note from the Library opens the list
  - Test: `tests/content/HameshApp.lost-notes.test.tsx`

### Usage-sharing bubble

- [ ] 3. `usage.ask` preference (`dismissed`), nested in `UsagePreferences`; a reader who said
      "No thanks" before counts as dismissed, as the card promised
  - Test: `tests/domain/preferences.test.ts`
- [ ] 4. A bubble at the Library's inline-end corner: an entrance and one soft pulse each time
      the Library opens, then still (none under reduced motion); it opens a card with what is
      shared, Share and Don't show again
  - Test: `tests/ui/usage/UsageBubble.test.tsx`
- [ ] 5. Turning sharing on counts `usage.enabled` and sends that day's report at once, still
      once a day at most
  - Test: `tests/usage/worker.test.ts`
- [ ] 6. Strings in both languages; screenshots RTL/LTR, light/dark
  - Test: `tests/teams/strings` key parity; scratch spec, deleted

### Team notes

- [ ] 7. Team notes are checked like personal ones; the list shows each one's author, and only
      the author sees its actions
  - Test: `tests/content/HameshApp.lost-notes.test.tsx`
- [ ] 8. Contract: `anchor` in `UpdateNoteFields`, and a `placement` flag a team note carries
      when its author kept it without a place
  - Test: `packages/teams-contract` tests
- [ ] 9. A `notes.update` from the page may carry an anchor or the kept flag: validated by hand
      in the page channel, author only, allowed and refused paths
  - Test: `tests/teams/page-channel.test.ts`, `tests/teams/page-handler.test.ts`
- [ ] 10. Server side in `hamesh-api` (its own PR, pinned to the merged contract): accept them,
      author only, with a migration and its rollback

## Done when

- All steps ticked, the hamesh-api PR merged, and the store-build leak check clean.
