# Notes that lost their place

**Goal:** a note whose words or element are gone from its page is said to be lost, honestly and
only after the page had a fair chance, and the reader can put it back or keep it without a place.
**Status:** release prepared; waiting for hamesh-api (part 07, step 10) and the owner's word to tag v2.3.1
**Canvas:** none approved. Built from the existing tokens and components (the page's hint pill,
cards, buttons and the Library's filter pills), as the task allows when no canvas exists.
**Background:** [PROPOSAL.md](PROPOSAL.md)

## Scope

- In: a per-device health store; detection after the page settles, over two visits; a pill and a
  list on the page; "Put it back" (words or element) and "Keep without a place"; the Library's
  "Lost their place" filter and mark; a line in the Markdown export; usage counts; release 2.3.1
  (stops before the tag).
- Out: automatic fuzzy re-anchoring, checking pages the reader has not visited, team notes (see
  Decisions), video notes (never lost: an unloaded video is not a changed page).

## Decisions

| Concern            | Decision                                                                    | Why                                                                                         | Rejected                         |
| ------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------- |
| Where health lives | `hamesh:anchor-health`, one map by note id, parsed by hand                  | An observation of this device, not part of the note; no `updatedAt` churn, not in backups   | A field on `Note`                |
| When it is lost    | Two separate visits each end unresolved                                     | One broken load (paywall, cookie wall) never flags anything                                 | First miss                       |
| A visit's verdict  | After 10 s and a 3 s quiet spell (no DOM changes), or at 30 s at the latest | Late SPAs and lazy sections get their chance; a page that never stops moving still gets one | Proposal's open-ended "at 10 s"  |
| What is a miss     | Words with no range; an element at `Fallback` or `Unresolved`               | `Fallback` is a guess at the old x/y, often the wrong element                               | Counting `Probable` as a miss    |
| Team notes         | Not checked in this release                                                 | A page cannot change a team's note; a list entry the reader can't act on is noise           | Flag locally, no actions         |
| Put it back        | Same kind as before: words for a text note, an element for an element note  | Keeps the note's meaning and the export's layout; the selection flows already exist         | Switching kinds                  |
| Lost notes on page | No marker drawn once lost or kept; the pill lists the lost ones             | A marker on a guessed element is the silent failure this fixes                              | Keep drawing the fallback marker |
| Export             | One line under the note for lost and kept notes                             | Nothing exported claims a place the note no longer has                                      | A separate section               |
| Version            | 2.3.1, as the owner asked                                                   | The owner approved this as its own release                                                  | 2.4.0 (rules §11: MINOR)         |

## Phases and parts

| #   | Part                                                            | Phase | Status      | Depends on |
| --- | --------------------------------------------------------------- | ----- | ----------- | ---------- |
| 01  | [Health model and storage](01-health-model.md)                  | A     | done        | none       |
| 02  | [Detection on the page](02-detection.md)                        | B     | done        | 01         |
| 03  | [The page's pill, list and re-attach](03-page-ui.md)            | C     | done        | 02         |
| 04  | [Library and export](04-library-export.md)                      | D     | done        | 01         |
| 05  | [Release prep](05-release.md)                                   | E     | done        | 03, 04     |
| 06  | [Review before release](06-review.md)                           | E     | done        | 04         |
| 07  | [The owner's decisions after the review](07-owner-followups.md) | F     | in progress | 06         |

Each phase is its own PR, squash-merged once CI is green, in this order. The tag waits for the
owner.

## Verification commands

| Level                             | Command                                              |
| --------------------------------- | ---------------------------------------------------- |
| Tasks                             | `node scripts/plan-check.mjs docs/plans/lost-notes`  |
| Unit                              | `pnpm test`                                          |
| E2E                               | `pnpm build && pnpm test:e2e e2e/lost-notes.spec.ts` |
| Typecheck / lint / format / build | `pnpm check`                                         |

## Risks

- Timers in the content script on every page: one `MutationObserver` and three timers per visit,
  stopped at the verdict, so an idle page costs nothing after 30 s at most.
- Storage writes wake every tab's watcher (`onChanged` fires on any `set`): a verdict writes only
  when an entry actually changes.
