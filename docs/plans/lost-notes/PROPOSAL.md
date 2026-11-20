# Notes that lost their place — proposal

Status: **draft.** Ships in its own release, after the Markdown export (2.3.0 → this is 2.4.0).

## 1. The problem

A page changes after a note is written: an article is edited, a docs site is redesigned, a
framework re-renders with new class names. Today each resolver handles that quietly:

- **Words** (`resolveTextAnchors`): a low-confidence match resolves to nothing, by design. The
  note just doesn't appear on the page.
- **Elements** (`resolveAnchor`): when every signal fails, `Fallback` puts the marker on whatever
  sits at the old x/y. That is often the wrong element, and nothing says so.
- **Video moments**: `Unresolved` means the video isn't loaded. Not lost; never flagged.

So a note can vanish from its page, or sit on the wrong thing, and the person finds out only by
noticing it's missing. For a product whose promise is "your note is waiting where you left it",
that's the most damaging silent failure there is.

## 2. What people get

- **On the page**: a quiet pill, "2 notes couldn't find their place", in the same spot as the
  existing preview pill. Opening it lists them, each with its quote or its element description and
  two actions: **Put it back** and **Keep without a place**.
- **Put it back**: the same selection flow as writing a note (words or element), but the result
  replaces the old anchor and keeps the note's id, content, folder, pin and dates.
- **In the Library**: a "Lost their place" filter pill beside the existing ones, and a small mark
  on each such note. Opening it goes to the page with the pill already open.
- **Keep without a place**: the note stays in the Library and stops being flagged. It shows as a
  page-level note.
- **Export** (2.3.0 already shipped) marks them with a "⚠ lost its place" line, so nothing exported
  claims a position it no longer has.

## 3. When a note counts as lost

Only after the page has had a fair chance:

1. Resolution runs as it does today.
2. A note that resolved `Unresolved` (words) or `Fallback` (elements) is a **suspect**.
3. A suspect is re-checked after the page has been quiet for 3 s (no DOM mutations), and again
   at 10 s. Late-loading SPAs and lazy sections get their chance.
4. Still unresolved → **lost on this visit**. A note is shown as lost after **two separate
   visits** both say so, so one broken load (a paywall, a cookie wall, an A/B test) never flags
   anything.
5. Any later visit that resolves it clears the state automatically.

Video moments are never flagged. Team notes are flagged locally only (the server doesn't need to
know).

## 4. Data

A separate store, not a field on `Note`: health is something this device observed, not part of
the note, and writing it into notes would bump `updatedAt`-sorted views and conflict with backups.

```ts
// chrome.storage.local key: `hamesh:anchor-health`
interface AnchorHealth {
  status: 'suspect' | 'lost' | 'kept-without-place';
  /** Visits that ended unresolved, capped at 2. */
  misses: number;
  lastCheckedAt: string;
  pageKey: string;
}
type AnchorHealthMap = Record<string /* noteId */, AnchorHealth>;
```

- Written by the content script (it already writes notes through the repositories) and parsed by
  hand there (content-script modules stay zod-free).
- Entries for deleted notes are dropped when the Library loads.
- Not part of the JSON backup: it's an observation, and the next visit recreates it.
- `kept-without-place` is the one state the person sets; a successful re-attach removes the entry.

## 5. Engineering

- `src/domain/anchor-health.ts`: pure state machine — `(previous, outcome, now) → next`.
  Every transition unit-tested, including "resolved clears lost" and "one miss never flags".
- `src/storage/anchor-health-repository.ts`: read, write, watch, prune.
- Content script: a small `useAnchorHealth` hook fed by the three resolvers' results, with the
  quiet-page re-check (`MutationObserver` + timers, torn down on navigation).
- Re-attach reuses the existing capture code paths (`text-selection.ts`, the element picker) with
  a "replace anchor of note X" mode. New `updateNoteAnchor(note, anchor)` in `domain/note.ts`;
  it does change `updatedAt`, because the note now points somewhere else.
- `isOnHameshUi` gets the new pill and list.
- A canvas first: pill, list, re-attach state, Library filter and mark. RTL/LTR, light/dark.

## 6. Tests

| Level     | What                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit      | State machine; health repository parse/prune; `updateNoteAnchor` keeps id/content/folder/pin                                                                                              |
| Component | Pill count, list actions by role, Library filter                                                                                                                                          |
| E2E       | Fixture page whose text is edited between visits → flagged on visit 2, not visit 1; re-attach → highlight back and flag gone; a late-loading section resolves within 10 s → never flagged |

## 7. Out of scope

Automatic re-anchoring by fuzzy search across the whole page (a wrong guess is worse than an
honest "lost"), and telling the person when a page they haven't visited has changed (would need
fetching pages in the background).
