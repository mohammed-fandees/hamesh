# Hamesh — Feature & Module Audit

Which parts of Hamesh are real, reusable modules, and which are copy-paste that
should be modules. For each base feature: where it is used, and whether it was
implemented **once and reused** or **replicated**.

**Source of truth:** the working tree at `1.4.0` (§1–§6, the findings).
**Status:** resolved — see §0 for where each feature lives now.
**Companion document:** [`DESIGN-AND-LAYOUT.md`](./DESIGN-AND-LAYOUT.md) — _how_
each surface looks. This document is about _how the code is factored_.

---

## 0. Resolution — where each feature lives now

This audit was taken at `1.4.0`, before the module/design refactor. Everything
from §1 onwards is kept as the record of what was found and why; this section
says what each finding became. Each duplicate was replaced by one canonical
implementation, every consumer was migrated to it, and the old copies were
deleted — no wrappers were kept for compatibility.

| #   | Base feature             | Was        | Now — the one source of truth                                                                                                                                                                                                                                                |
| --- | ------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Note storage             | PARTIAL    | `createStoredList` (`src/storage/stored-list.ts`) owns read/write/append/update/remove; `notes-repository.ts` is built on it                                                                                                                                                 |
| 2   | Folder storage           | PARTIAL    | the same `createStoredList`; `folders-repository.ts` is built on it                                                                                                                                                                                                          |
| 3   | Folder tree derivation   | REPLICATED | `src/domain/folder-grouping.ts`, generic over `FolderLike`: `indexFoldersByParent`, `flattenFolderTree` (orphan/cycle recovery), `buildFolderTree` (built from it), `getDescendantFolderIds`, `countInFolder`. `ui/teams/folders.ts` and `flattenFolderTreeForMenu` are gone |
| 4   | Folder assignment UI     | REPLICATED | `FolderSelect` (`src/ui/FolderSelect.tsx`, one indent rule) for selects; the row menu's checked list for moves; `FolderMenu` for a folder's own actions                                                                                                                      |
| 5   | Folder name validation   | REPLICATED | `nameProblem` + `FOLDER_NAME_MAX` (`domain/folder.ts`), applied by `NameField` (`ui/kit/NameField.tsx`) at every entry point; `TEAM_NAME_MAX` (`ui/teams/limits.ts`, tested against the server contract)                                                                     |
| 6   | Folder defaults          | MODULE     | unchanged; written through `usePreferences`                                                                                                                                                                                                                                  |
| 7   | Note edit/save flow      | REPLICATED | `NoteEditor` (`src/ui/NoteEditor.tsx`) — composer, viewer, row menu, team note                                                                                                                                                                                               |
| 8   | Note delete + confirm    | REPLICATED | `InlineConfirm` (`ui/kit/InlineConfirm.tsx`) everywhere; deletes go through `useNoteMutations().remove`                                                                                                                                                                      |
| 9   | Note "shared" predicate  | MISSING    | `isSharedNote` / `mayMutateNote` (`domain/note.ts`)                                                                                                                                                                                                                          |
| 10  | Note preview clamping    | PARTIAL    | `NoteRow` is the one row (site groups, folders, Pinned)                                                                                                                                                                                                                      |
| 11  | Relative time formatting | PARTIAL    | `relativeTime(string \| number \| Date, lang)` (`src/ui/format.ts`)                                                                                                                                                                                                          |
| 12  | Date formatting          | PARTIAL    | `formatDate`, `formatMoney` in the same module; `ui/teams/format.ts` is gone                                                                                                                                                                                                 |
| 13  | Async/busy/error state   | MISSING    | `useWork` + `Failure` (`ui/hooks/useWork.ts`) — keyed busy and failure per control; `useTeams`, `useNoteMutations`, Backup, Teams settings and Share are built on it                                                                                                         |
| 14  | Empty state              | MISSING    | `EmptyState` (`ui/kit/EmptyState.tsx`, `page` / `inline` / `compact`)                                                                                                                                                                                                        |
| 15  | Loading skeleton         | MISSING    | `Skeleton` (`ui/kit/Skeleton.tsx`, rows / tiles / chips)                                                                                                                                                                                                                     |
| 16  | Page header              | MISSING    | `Page` + `PageHeader` (`ui/kit/Page.tsx`); `Breadcrumb` for sub-pages                                                                                                                                                                                                        |
| 17  | Stagger animation        | REPLICATED | `stagger(i)` (`ui/kit/motion.ts`)                                                                                                                                                                                                                                            |
| 18  | Icon set                 | PARTIAL    | `ui/kit/icons.tsx` — one set, including `ChevronIcon` with `direction` and `.hm-mirror`; the per-icon files and `SettingsIcons.tsx` are gone                                                                                                                                 |
| 19  | Escape / submit keys     | MISSING    | `isSubmitChord`, `escapeLayer` (`ui/kit/keys.ts`). Handlers that remain hand-written are document-level (popup, selection mode, the Library's `/`) or have extra rules (search clears only when non-empty; the mention picker closes before the composer)                    |
| 20  | i18n strings             | REPLICATED | `ui/i18n.ts` holds the shared vocabulary; `TeamsStrings extends SharedStrings` and composes it, so a shared word (Cancel, Keep it, Save, Delete, New folder…) is written once per language                                                                                   |
| 21  | Anchor resolution        | PARTIAL    | `elementAtPoint` (`utils/dom.ts`) shared by selection and anchor resolution                                                                                                                                                                                                  |
| 22  | Anchor scroll-into-view  | REPLICATED | `revealElement` + `RESTORE_FLASH_MS` (`utils/dom.ts`)                                                                                                                                                                                                                        |
| 23  | Video adapters           | MODULE     | unchanged registry; the two `<video>` adapters share `pickActiveVideo` and `sourceOrOrdinalId` (`video-adapters/shared.ts`)                                                                                                                                                  |
| 24  | Video marker UI          | PARTIAL    | `PreviewPill` (`src/ui/PreviewPill.tsx`) shared by the video marker preview and the text popup                                                                                                                                                                               |
| 25  | Floating positioning     | PARTIAL    | one `useFloating(getRect, { placement })` over pure `placeBelow` / `placeAbove`; one `FloatingViewer` for element and video notes; `RailPlacement extends RailRect` (`domain/video-markers.ts`)                                                                              |
| 26  | Teams operations         | MODULE     | unchanged; rights derived once in `ui/teams/permissions.ts`                                                                                                                                                                                                                  |
| 27  | Teams folder tree        | REPLICATED | the generic domain tree (#3)                                                                                                                                                                                                                                                 |
| 28  | Personal vs team split   | PARTIAL    | `isSharedNote` (#9) and `matchesOwner` (`domain/note-owner.ts`)                                                                                                                                                                                                              |
| 29  | Domain + favicon kicker  | REPLICATED | `NoteRow`'s `showDomain`, `pageLabelFrom` (`domain/notes-grouping.ts`) for page labels                                                                                                                                                                                       |
| 30  | Settings primitives      | MODULE     | moved into `ui/kit/` (`SettingRow`, `SegmentedControl`) plus `Switch`, `Section`/`Panel`; `LanguageRow`/`AppearanceRow` (`ui/settings/ChoiceRows.tsx`) shared by the popup and the page. `SettingsGroup.tsx` is gone                                                         |

Also consolidated, beyond the table: preferences (`usePreferences`, one
optimistic write with rollback, used by popup, Library and the in-page app),
folders (`useFolders`), shortcuts (`useShortcuts` + `COMMANDS`), theme
(`resolveTheme`), the page background (`usePageBackground`), menus (`Menu`),
feedback (`InlineError` / `StatusLine` / `Busy`), avatars (`Avatar`), mention
rendering (`MentionText`), invite-link parsing (`ui/teams/invite-link.ts`), and
folder record parsing (`parseFolderRecord`, shared by storage, backup and the
Teams sync store).

**The four bugs in §5:**

| Bug                                    | Fix                                                                                                                                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 Library cannot report a failure    | `useNoteMutations` records a failure per note; `NoteRow` shows it as an `InlineError` beside the row. `HameshApp` reports through the same hook (`onFailure`). The pin toggle is guarded by `mayMutateNote` like every other write |
| 5.2 Long pinned notes unreadable       | Pinned renders `NoteRow`, which has "Show more"                                                                                                                                                                                    |
| 5.3 Nested folders flat on a team note | One `FolderSelect`, indenting with non-breaking spaces                                                                                                                                                                             |
| 5.4 Orphaned team notes disappear      | One `resolveFolderId(folderId, knownIds)`; team Library notes resolve their folder against the known folders, so an orphan is unfiled                                                                                              |

And one found on the way: `buildFolderTree` dropped folders whose parent was
missing; it is now built from `flattenFolderTree`, which recovers them at the
top level.

**Guards against regression:** `tests/ui/tokens.test.ts` (no numeric font sizes,
no `font` shorthand, no self-referencing custom properties, motion intent
shapes, no `:dir(`), `tests/ui/no-native-dialogs.test.ts`,
`tests/ui/team-limits.test.ts`, `tests/ui/team-permissions.test.ts`,
`tests/ui/format.test.ts`, and the domain tests for the folder tree, folder
records and note predicates.

---

## Verdict legend

| Verdict        | Meaning                                                                      |
| -------------- | ---------------------------------------------------------------------------- |
| **MODULE**     | Implemented once, correctly shared, no meaningful duplication. Leave alone.  |
| **PARTIAL**    | A real module exists, but some call sites bypass it or re-derive part of it. |
| **REPLICATED** | The logic exists 2+ times. Needs extraction into a module.                   |
| **MISSING**    | The concept exists 3+ times with no abstraction at all. Needs a new module.  |

---

## 1. Executive verdict

| #   | Base feature                      | Verdict        | Copies                  | Sites    |
| --- | --------------------------------- | -------------- | ----------------------- | -------- |
| 1   | **Note storage** (notes repo)     | **PARTIAL**    | 4 loops                 | 4        |
| 2   | **Folder storage** (folders repo) | **PARTIAL**    | 4 loops                 | 4        |
| 3   | **Folder tree derivation**        | **REPLICATED** | 3                       | 3        |
| 4   | **Folder assignment UI**          | **REPLICATED** | 5 widgets               | 5        |
| 5   | **Folder name validation**        | **REPLICATED** | 5 rules                 | 5        |
| 6   | **Folder defaults**               | **MODULE**     | 1                       | 3        |
| 7   | **Note edit/save flow**           | **REPLICATED** | 4 editors               | 4        |
| 8   | **Note delete + confirm**         | **REPLICATED** | 4                       | 4        |
| 9   | **Note "shared" predicate**       | **MISSING**    | 8 sites                 | 8        |
| 10  | **Note preview clamping**         | **PARTIAL**    | 3 shells                | 9        |
| 11  | **Relative time formatting**      | **PARTIAL**    | 1 fmt, 4 shims          | 8        |
| 12  | **Date formatting**               | **PARTIAL**    | 1 dup                   | 1        |
| 13  | **Async/busy/error state**        | **MISSING**    | 0 hooks                 | 6+       |
| 14  | **Empty state**                   | **MISSING**    | 12                      | 12       |
| 15  | **Loading skeleton**              | **MISSING**    | 9                       | 9        |
| 16  | **Page header**                   | **MISSING**    | 6                       | 6        |
| 17  | **Stagger animation**             | **REPLICATED** | 4 sites                 | 4        |
| 18  | **Icon set**                      | **PARTIAL**    | 12 in a settings island | 30+      |
| 19  | **Escape / submit keys**          | **MISSING**    | 7 handlers              | 9        |
| 20  | **i18n strings**                  | **REPLICATED** | 2 tables, 6 keys        | 8        |
| 21  | **Anchor resolution**             | **PARTIAL**    | 3 families              | 3        |
| 22  | **Anchor scroll-into-view**       | **REPLICATED** | 2                       | 2        |
| 23  | **Video adapters**                | **MODULE**     | 1 registry              | 4        |
| 24  | **Video marker UI**               | **PARTIAL**    | 2                       | 5        |
| 25  | **Floating positioning**          | **PARTIAL**    | 2 systems               | 2        |
| 26  | **Teams operations**              | **MODULE**     | 1 registry              | 1        |
| 27  | **Teams folder tree**             | **REPLICATED** | 1                       | 1 (of 2) |
| 28  | **Personal vs team split**        | **PARTIAL**    | 8 tests                 | 8        |
| 29  | **Domain + favicon kicker**       | **REPLICATED** | 4 rules                 | 4        |
| 30  | **Settings primitives**           | **MODULE**     | 3 shared                | 8        |

**Headline:** ~11 features are genuine modules. ~19 are replicated or missing.
The duplication is concentrated in **UI composition** (empty/skeleton/header/
confirm/stagger/icons) and in **state plumbing** (async/busy/error, shared-note
predicate), not in the domain layer — the domain layer is in good shape.

---

## 2. Genuine modules — keep as they are

These were implemented once and reused correctly. Do not refactor.

| Module                                | File                                                                                 | Reused by                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Notes grouping (sort, filter, derive) | `src/domain/notes-grouping.ts`                                                       | Library, folders, Teams merge. Deliberately exports `sortNotesWithPinnedFirst` for `folder-grouping.ts` to reuse |
| Page key                              | `src/domain/page-key.ts`                                                             | content, library, teams                                                                                          |
| Folder tree build                     | `src/domain/folder-grouping.ts` (partial)                                            | Library tree, composer picker, folder-delete cascade                                                             |
| Default folder rules                  | `src/domain/preferences.ts`                                                          | composer, video quick note, storage                                                                              |
| Note / folder / workspace models      | `src/domain/{note,folder,workspace}.ts`                                              | everywhere                                                                                                       |
| Anchor models                         | `src/domain/{anchor,text-anchor,video-anchor}.ts`                                    | content script                                                                                                   |
| Backup                                | `src/domain/backup.ts`                                                               | Backup section, import/export                                                                                    |
| Release notes                         | `src/domain/release-notes.ts`                                                        | What's New                                                                                                       |
| Shortcuts                             | `src/domain/shortcut.ts`                                                             | popup, settings                                                                                                  |
| Open-note cross-tab restore           | `src/entrypoints/notes/openNote.ts`                                                  | library rows                                                                                                     |
| Video adapter registry                | `src/content/video-adapters/registry.ts`                                             | all 3 adapters                                                                                                   |
| Teams operations registry             | `src/teams/operations.ts`                                                            | all Teams UI                                                                                                     |
| Teams money/date format               | `src/ui/teams/format.ts`                                                             | billing, members, invitations, overview                                                                          |
| i18n / language resolution            | `src/ui/i18n.ts`                                                                     | every surface                                                                                                    |
| Settings primitives                   | `src/ui/{SettingRow,SegmentedControl,SettingsGroup}.tsx`                             | popup, full settings, Teams settings                                                                             |
| Brand + note icons                    | `src/ui/{MarginMark,Favicon,PinIcon,PlayIcon,AttachedText,FolderGlyph,StarIcon}.tsx` | every surface                                                                                                    |
| Teams slot pattern                    | `src/ui/NoteShareSlot.ts`                                                            | `NoteRow`, `NoteActionsMenu` — degrades to `null` in non-Teams builds. **This is the right pattern**             |

`NoteShareSlot` deserves emphasis: it is the model the codebase should copy. It
solves "Teams code needed in non-Teams code" by injecting through context rather
than by branching.

---

## 3. Feature catalogue

### 3.1 Notes

#### 3.1.1 Note storage — **PARTIAL**

`src/storage/notes-repository.ts` has the right shape (per-page buckets,
domain functions doing the work). But the read-modify-write loop is written out
**four times**, and `setPinned` / `setFolder` are byte-identical except for the
domain function:

```ts
// notes-repository.ts:101  setPinned          // :126  setFolder — identical but for the call
const existing = await this.getForPage(pageKey);
const index = existing.findIndex((n) => n.id === noteId);
if (index === -1) return null;
const updated = setNotePinned(existing[index], pinned); // ← setNoteFolder
existing[index] = updated;
const key = storageKey(pageKey);
await storage.setItem(`local:${key}`, existing);
return updated;
```

`delete` (`:81`) is the same shape with `filter`. `update` (`:66`) is the same
shape plus `validateNoteContent`.

`src/storage/folders-repository.ts` repeats all four again (`:34, :42, :53, :61`).

**Why it matters:** `validateNoteContent` is called from exactly one place
(`:67`). Any write path added outside these loops silently skips validation.

**Extraction** — one keyed-collection primitive both repos are built on:

```ts
// src/storage/keyed-collection.ts
export function createKeyedCollection<T extends { id: string }>(
  prefix: string,
): {
  read(key: string): Promise<T[]>;
  find(key: string, id: string): Promise<T | null>;
  update(key: string, id: string, fn: (item: T) => T): Promise<T | null>;
  remove(key: string, id: string): Promise<boolean>;
  write(key: string, items: T[]): Promise<void>;
};
```

#### 3.1.2 Note edit/save flow — **REPLICATED (4 editors, 2 contracts)**

| Editor       | File                             | Escape    | Ctrl/Cmd+Enter | Error surface        |
| ------------ | -------------------------------- | --------- | -------------- | -------------------- |
| Composer     | `src/ui/Composer.tsx:70,73`      | ✅        | ✅             | ✅ `role=alert`      |
| NoteViewer   | `src/ui/NoteViewer.tsx:76`       | ✅ 3-step | ❌             | ✅                   |
| Team note    | `src/ui/teams/TeamNotePage.tsx`  | ✅        | ❌             | ✅ `.hm-field-error` |
| Actions menu | `src/ui/NoteActionsMenu.tsx:436` | ✅        | ✅             | ❌ **none**          |

Two different submit contracts in one feature. `validateNoteContent` exists in
`src/domain/note.ts` and is used by the repository — **no editor calls it.**

The editors also disagree on the error class: `.hm-error` (`tokens.css:782`,
used by Composer/NoteViewer/FolderPicker) vs `.hm-field-error` (`teams.css:340`,
used by TeamNotePage).

**Extraction:**

```ts
// src/ui/useNoteEditor.ts
export function useNoteEditor(initial: string): {
  editing: string | null;
  content: string;
  dirty: boolean;
  error: string | null;
  start(): void;
  cancel(): void;
  save(content: string): void;
};
```

One owner of the Escape ladder + Ctrl/Cmd+Enter + `dirty` + validation, used by
all four. **This also fixes the silent-failure bug in §5.1.**

#### 3.1.3 Note delete + confirm — **REPLICATED (4 copies, 2 stylesheets)**

| Site                                   | Copy        | CSS class                  | Has Escape / focus mgmt |
| -------------------------------------- | ----------- | -------------------------- | ----------------------- |
| `src/ui/teams/InlineConfirm.tsx:47-78` | ✅ best     | `.hm-confirm`              | ✅ both                 |
| `src/ui/NoteViewer.tsx:157-179`        | hand-rolled | inline styles              | ❌                      |
| `src/ui/FolderTree.tsx:348-371`        | hand-rolled | `.hm-folder-node__confirm` | ❌                      |
| `src/ui/NoteActionsMenu.tsx:462-485`   | hand-rolled | `.hm-folder-node__confirm` | ❌                      |

`InlineConfirm`'s own doc comment (`:21-25`) _identifies_ the three sibling
implementations and then adds a fourth copy instead of extracting:

> _"Hamesh confirms in place everywhere else (the note viewer's delete step, the
> actions menu's), and `window.confirm` is the one thing on the Teams page that
> broke that"_

The divergence costs CSS: `.hm-confirm` lives in `teams.css:326`, its Notes twin
in `notes-library.css:996`, and `teams.css:602` needs a `.hm-tile .hm-confirm`
override purely because of the split. The `keepIt` string is duplicated in
`i18n.ts:21` and `teams/strings.ts:131`.

**Extraction:** promote `InlineConfirm` to `src/ui/InlineConfirm.tsx` and migrate
the other three. Kills 3 components, 1 stylesheet, 1 duplicate string key, and
closes a test-coverage gap (only `InlineConfirm` is tested).

#### 3.1.4 "Is this note shared?" — **MISSING (8 independent tests)**

The single most-repeated predicate in the codebase, and it has no name.
`src/domain/note.ts:136-147` documents a helper that was never extracted:

> _"its presence is what every caller checks before offering to edit, delete, pin
> or file a note."_

| Site                                    | Expression                                 |
| --------------------------------------- | ------------------------------------------ |
| `src/ui/NoteViewer.tsx:63`              | `const shared = !!note.team;`              |
| `src/ui/NoteActionsMenu.tsx:143`        | `const shared = !!note.team;`              |
| `src/content/HameshApp.tsx:1331`        | `isLocal` = `!…find()?.team`               |
| `src/ui/teams/NoteFilter.tsx:26`        | `if (owner === 'mine') return !note.team;` |
| `src/ui/teams/NoteFilter.tsx:29`        | `note.team?.id !== owner.teamId`           |
| `src/ui/NoteRow.tsx:105,161`            | `note.team && (…)`                         |
| `src/teams/page-notes.ts:46`            | `note.team ? … : undefined`                |
| `src/entrypoints/notes/App.tsx:549,568` | `note.team ? … : undefined`                |

Two data shapes for the same split: the Library keeps `notes` + `shared.notes`
concatenated (`notes/App.tsx:308`); the content script keeps `notesRef` +
`teamNotesRef` merged at `HameshApp.tsx:644`.

**Extraction:**

```ts
// src/domain/note.ts
export function isSharedNote(note: Pick<Note, 'team'>): boolean;
export function mayMutateNote(note: Pick<Note, 'team'>): boolean; // = !isSharedNote
```

`src/ui/teams/ShareNoteAction.tsx:31-34` in particular re-derives "is this note
still personal" from scratch instead of calling the ownership predicate that
already exists in `NoteFilter.tsx`.

#### 3.1.5 Note preview clamping — **PARTIAL, with a live bug**

The expandable-preview pattern exists three times and is correct twice:

| Shell               | `data-expanded`             | CSS escape rule            | Toggle              |
| ------------------- | --------------------------- | -------------------------- | ------------------- |
| `NoteRow`           | ✅ `:117, :134`             | ✅ `notes-library.css:713` | ✅ `ResizeObserver` |
| `WebsiteGroup`      | ✅ `:60, :79`               | ✅                         | ✅                  |
| **`PinnedSection`** | ❌ — `PinnedSection.tsx:91` | ❌ **no rule exists**      | ❌                  |

**See §5.2 — this is a user-visible truncation bug.**

#### 3.1.6 Domain + favicon kicker — **REPLICATED (4 rules)**

Same visual element, four near-identical CSS rules and four JSX sites:

| Site                             | Rule                                             |
| -------------------------------- | ------------------------------------------------ |
| `src/ui/NoteRow.tsx:93-98`       | `.hm-note-row__domain` (`notes-library.css:671`) |
| `src/ui/PinnedSection.tsx:83-87` | `.hm-pinned__kicker` (`:480`)                    |
| `src/ui/WebsiteGroup.tsx:55`     | `.hm-group__domain` (`:550`)                     |
| `src/ui/ContinueSection.tsx:44`  | `.hm-continue__domain` (`:420`)                  |

`NoteRow.tsx:95-96` also calls `extractDomain(note.originalUrl)` twice in
adjacent JSX.

**Extraction:**

```tsx
// src/ui/DomainKicker.tsx
export function DomainKicker({
  domain,
  size = 14,
  className,
}: {
  domain: string;
  size?: number;
  className?: string;
}): JSX.Element;
```

#### 3.1.7 Note title derivation — **PARTIAL (good helper, 3 weaker re-derivations)**

`derivePageLabel` (`notes-grouping.ts:159`) is the correct implementation and is
used by `NoteRow.tsx:101` and `notes-grouping.ts:184`. But `TeamNotePage.tsx`
re-derives it three times, weaker each time:

```tsx
// :179  breadcrumb
{trail(note.pageTitle || extractDomain(note.originalUrl))}
// :189  heading
<bdi>{note.pageTitle || extractDomain(note.originalUrl)}</bdi>
// :191  domain span
<span className="hm-team-note__domain">{extractDomain(note.originalUrl)}</span>
```

Divergences: falls back to **hostname** instead of **pathname**; no `.trim()`;
no `try/catch` around `new URL`. A YouTube note with no captured title shows
`youtube.com` here and `/watch` in the Library.

**Extraction:** export a `pageLabel(note)` that takes the minimal shape both
`Note` and the cached team note satisfy, and use it at `:179` / `:189`.

---

### 3.2 Folders

Folders are the best-modelled feature in the codebase and the most
inconsistently _consumed_. The domain layer is right; the UI is copied five times.

#### 3.2.1 Two parallel folder domains

|                | Local (personal)                               | Teams (shared)                              |
| -------------- | ---------------------------------------------- | ------------------------------------------- |
| Model          | `src/domain/folder.ts:9`                       | `src/teams/sync-store.ts:16` `CachedFolder` |
| IDs            | `crypto.randomUUID()` (`:47`)                  | server ULIDs (`operations.ts:51`)           |
| Timestamps     | ISO `string`                                   | epoch `number`                              |
| Storage        | `chrome.storage.local['local:hamesh:folders']` | IndexedDB `sync:<teamId>`                   |
| Tree / flatten | `src/domain/folder-grouping.ts`                | `src/ui/teams/folders.ts`                   |
| Note link      | `Note.folderId?: string`                       | `TeamNote.folderId: string \| null`         |

These are two genuinely different things that happen to share vocabulary. They
should **not** be unified into one model — but their _derivation_ logic should be.

#### 3.2.2 Folder tree derivation — **REPLICATED (3 copies, 2 in one file)**

The parent-bucketing map is written out three times. Twice in the _same file_,
byte-identical:

```ts
// src/domain/folder-grouping.ts:48-52   (buildFolderTree)
// src/domain/folder-grouping.ts:83-87   (getDescendantFolderIds) — IDENTICAL
const childrenByParent = new Map<string | null, Folder[]>();
for (const folder of folders) {
  const bucket = childrenByParent.get(folder.parentId);
  if (bucket) bucket.push(folder);
  else childrenByParent.set(folder.parentId, [folder]);
}

// src/ui/teams/folders.ts:14-18         (flattenFolders) — third copy, renamed
```

Name sorting is likewise written three times: `folder-grouping.ts:31`,
`folder-grouping.ts:69`, `teams/folders.ts:24` — all
`.sort((a, b) => a.name.localeCompare(b.name))`.

Cycle guards differ: the local version uses a `visiting` set around the
recursion; the Teams version uses a permanent `seen` set **plus an orphan
recovery pass** (`teams/folders.ts:37-39`). The Teams version is strictly more
robust — the local one silently drops a folder whose parent id dangles.

The Teams copy duplicates `buildFolderTree` + `flattenFolderTreeForMenu` in one
function. The only thing preventing reuse is the **type**: `CachedFolder` has
numeric timestamps, `Folder` has ISO strings.

**Extraction:** make the tree builder generic over `{ id, name, parentId }`.

```ts
// src/domain/folder-grouping.ts
export interface FolderLike {
  id: string;
  name: string;
  parentId: string | null;
}
export function indexFoldersByParent(
  folders: readonly FolderLike[],
): Map<string | null, FolderLike[]>;
export function flattenFolderTree<T extends FolderLike>(
  folders: readonly T[],
): { folder: T; depth: number; parent: T | null }[];
```

Then `ui/teams/folders.ts` collapses to a type alias plus `countInFolder`.

**Wasteful composition worth fixing while here:** `FolderPicker.tsx:69` builds an
entire tree — including note bucketing, the unfiled bucket, pinned sorts and
cycle guards — and then discards all of it except a flat list:

```ts
() => flattenFolderTreeForMenu(buildFolderTree(folders, []).tree),
```

#### 3.2.3 Folder assignment UI — **REPLICATED (5 widgets for one concept)**

| #   | Widget               | File                                | Create | Nested | Rename | Delete | Defaults | Current-folder marker |
| --- | -------------------- | ----------------------------------- | ------ | ------ | ------ | ------ | -------- | --------------------- |
| A   | Composer picker      | `src/ui/FolderPicker.tsx:174`       | ✅     | ❌     | ❌     | ❌     | ✅       | ❌                    |
| B   | Library tree         | `src/ui/FolderTree.tsx:77`          | ✅     | ✅     | ✅     | ✅     | ❌       | ✅                    |
| C   | Row move menu        | `src/ui/NoteActionsMenu.tsx:341`    | ✅     | ❌     | ❌     | ❌     | ❌       | ✅                    |
| D   | Team note `<select>` | `src/ui/teams/TeamNotePage.tsx:257` | ❌     | ❌     | ❌     | ❌     | ❌       | ❌                    |
| E   | Team overview tiles  | `src/ui/teams/TeamOverview.tsx:182` | ✅     | ❌     | ✅     | ✅     | ❌       | count                 |

**D is the weak copy and has a visible bug — see §5.3.**

Three different indent techniques for the same concept:

| Site                      | Technique                                                   |
| ------------------------- | ----------------------------------------------------------- |
| `FolderPicker.tsx:194`    | `{'\u00A0\u00A0'.repeat(depth)}` — non-breaking space ✅    |
| `TeamNotePage.tsx:268`    | `{' '.repeat(depth * 2)}` — ASCII space ❌ collapses        |
| `NoteActionsMenu.tsx:365` | `style={{ paddingInlineStart: 12 + depth * 14 }}` (buttons) |
| `FolderTree.tsx:266`      | `style={{ paddingInlineStart: depth * 16 }}`                |

**Extraction:** one `<FolderSelect>` covering the `<select>`, `menuitemradio`
and inline-tree presentations, with a single `folderOptionLabel(folder, depth)`
so the indent unit cannot drift again.

#### 3.2.4 Folder name validation — **REPLICATED (5 rules, 5 strictness levels)**

| Site                                              | Rule                                  |
| ------------------------------------------------- | ------------------------------------- |
| `src/domain/folder.ts:30-42` `validateFolderName` | non-empty after trim, ≤100 chars      |
| `src/ui/FolderPicker.tsx:76`                      | ✅ **uses it**                        |
| `src/ui/FolderTree.tsx:486,493`                   | `value.trim()` only — no length limit |
| `src/ui/NoteActionsMenu.tsx:255,418`              | `newFolderName.trim()` only           |
| `src/ui/teams/TeamOverview.tsx:96` create         | `newFolder.trim()`                    |
| `src/ui/teams/TeamOverview.tsx:110` rename        | **`renaming.name` — never trimmed**   |

A folder renamed in Teams can end up with leading/trailing whitespace; renamed in
the Library it cannot. `MAX_NAME_LENGTH = 100` is enforced at exactly one of six
sites.

#### 3.2.5 "Unfiled" rule — **REPLICATED (4 definitions, 1 weaker)**

| Site                            | Rule                                               | Correct? |
| ------------------------------- | -------------------------------------------------- | -------- |
| `folder-grouping.ts:57-64`      | `folderId && folderIds.has(folderId)` else unfiled | ✅       |
| `ui/teams/folders.ts:51-52`     | `!n.folderId \|\| !known.has(n.folderId)`          | ✅       |
| `ui/teams/TeamNotePage.tsx:262` | `folderId && folderIds.has(folderId)`              | ✅       |
| `ui/teams/NoteFilter.tsx:29`    | `!note.team.folderId` — **no existence check**     | ❌       |

`NoteFilter` hides orphaned team notes entirely — a note whose folder was deleted
on the server matches neither the folder filter nor the Unfiled filter. See §5.4.

A fifth representation is invented in `FolderTree.tsx:18`:
`const UNFILED_ID = '__unfiled__'`, resolved back to `undefined` at `:418`.

#### 3.2.6 Defensive folder parsers — **REPLICATED (3 implementations)**

| File                            | Function             | Strictness                         |
| ------------------------------- | -------------------- | ---------------------------------- |
| `src/domain/folder.ts:63-81`    | `parseFolderState`   | requires string timestamps         |
| `src/domain/backup.ts:66-77`    | `isImportableFolder` | additionally requires non-empty id |
| `src/teams/sync-store.ts:51-64` | `parseFolder`        | requires **number** timestamps     |

Same drop-malformed-entry philosophy, three times.

#### 3.2.7 Folder strings — **REPLICATED (2 tables, divergent copy)**

| Concept        | `src/ui/i18n.ts`                                                            | `src/ui/teams/strings.ts`                                |
| -------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| rename         | `:214` `'Rename folder'`                                                    | `:279` `'Rename'`                                        |
| delete         | `:215` `'Delete folder'`                                                    | `:280` `'Delete'`                                        |
| delete confirm | `:216` _"...notes (and any sub-folders) will become unfiled, not deleted."_ | `:281` _"Delete {name}? The notes in it stay, unfiled."_ |
| unfiled        | `:218` `'Unfiled'`                                                          | `:283` `'Unfiled'`                                       |
| no folder      | `:220` `'No folder'`                                                        | `:285` `'No folder'`                                     |
| move to        | `:219` `'Move to folder'`                                                   | `:284` `'Move to'`                                       |

Plus one dead string: `teams/strings.ts:98,282,516` `noTeamFolders: 'No folders
yet.'` is declared in all three locales and **never referenced** — `TeamOverview`
uses `nothingYet` instead.

#### 3.2.8 Folder glyph — **REPLICATED (2 SVGs, one of them a different glyph)**

`src/ui/FolderGlyph.tsx:6-13` — `13×13`, `viewBox="0 0 14 14"`,
`strokeWidth="1.1"`, with `className` pass-through.

`src/ui/teams/TeamOverview.tsx:387-403` — a _different_ glyph
(`viewBox="0 0 16 16"`, `strokeWidth="1.4"`, different path), with this comment:

```tsx
/** A folder outline, the same one the Library's folder view draws. */
```

It is not the same one. It exists only because it needed its own CSS class
(`teams.css:556` `.hm-tile__glyph`) — and `FolderGlyph` already accepts
`className`. One-line fix.

#### 3.2.9 Default folders — **MODULE ✅**

`resolveDefaultFolderId` / `withPageDefaultFolder` / `withGlobalDefaultFolder`
(`src/domain/preferences.ts:186-219`) are implemented once and reused by the
composer, the video quick note and preferences storage. This is the model the
rest of §3.2 should follow.

Two gaps worth noting (not duplication): teams have no default-folder concept,
and `folderDefaults` is not included in the backup payload (`backup.ts:79`), so
defaults are silently lost on restore.

---

### 3.3 Anchors

#### 3.3.1 Anchor models — **MODULE ✅**

`src/domain/{anchor,text-anchor,video-anchor}.ts` each define a shape, and each
is created in one place and consumed in one place. Correctly three separate
types — they genuinely differ.

#### 3.3.2 Anchor resolution — **PARTIAL**

Three resolution modules (`anchor-resolution.ts`, `text-anchor-resolution.ts`,
plus video resolution inline in the content script). Each is single-implementation,
which is right. But `elementFromPoint` is implemented twice with different care:

- `src/domain/anchor-resolution.ts:46` — safe, with `scrollX/Y` correction (`:198`)
- `src/content/HameshApp.tsx:1157` — raw

"Anchor unavailable" detection is likewise re-derived per family rather than
shared, which is why the three families' warning messages
(`NoteViewer.tsx` element vs text variants) are near-duplicates with different
wording.

#### 3.3.3 Anchor scroll-into-view — **REPLICATED (2 copies)**

Same shape written twice in the same file:

- `src/content/HameshApp.tsx:1003-1018` — elements
- `src/content/HameshApp.tsx:1750-1766` — text

Both: check `prefers-reduced-motion` → `scrollIntoView({ block: 'center' })` →
`setTimeout(clear)`. The text version resolves `Range → Element` inline with an
unguarded `parentElement`.

**Extraction:** one `scrollAnchorIntoView(anchor, rect)` helper.

#### 3.3.4 The restore-flash duration mirror — **correct coupling, fragile mechanism**

`1400ms` is intentionally shared between CSS and JS so the DOM node is removed
as the animation ends (`tokens.css:284-285` says so explicitly). The coupling is
legitimate; the _mechanism_ is the problem — three literals and a prose comment:

```
tokens.css:294        animation: hm-restore-pulse 1400ms var(--hm-ease-out);
HameshApp.tsx:1010-12 const timer = window.setTimeout(…, 1400);
HameshApp.tsx:107     const TEXT_FLASH_MS = 1400;
```

**Extraction:** promote to a token and read it from JS, rather than extracting
the constant into TS (which would just re-create the mirror).

---

### 3.4 Video

#### 3.4.1 Video adapters — **MODULE ✅**

`registry.ts` + a `types.ts` contract, with three adapters (YouTube, HTML5
generic, custom timeline) that register cleanly. This is the best-factored
extensibility point in the codebase.

Two small shared helpers are duplicated across adapters rather than living in a
`video-adapters/shared.ts`: a "most active element" picker and
`srcThenOrdinalId` for host matching.

#### 3.4.2 Video marker UI — **PARTIAL**

`src/ui/video/` has five well-separated components (`VideoMarker`,
`VideoMarkerCluster`, `VideoMarkerClusterList`, `VideoMarkerPreview`,
`VideoQuickNote`). Correctly separated.

The duplication is between the **video** and **text** hover previews, which are
nearly the same widget:

- `src/ui/video/VideoMarkerPreview.tsx:22-29` — dot + text + timestamp
- `src/ui/TextNotePopup.tsx:53-56` — dot + text, no timestamp

`TextNotePopup` reuses `.hm-video-preview` classes but emits
`.hm-video-preview__text`, and `tokens.css:1099-1111` `.hm-text-popup__text` is
**dead code** — nothing produces it. Consequence: the text popup renders at
12.5px when the intended 13.5px rule is unreachable, and its RTL font swap is
unreachable too.

**Extraction:** one `<PreviewPill>` + a shared `.hm-truncate-line` class. Fixes
the font bug as a side effect.

#### 3.4.3 Video rail placement — **PARTIAL**

`getRailPlacement` and its geometry live in the component file
(`HameshApp.tsx:1471-1558`), while the types `RailPlacement` /
`RailRect` are declared in two different places (`HameshApp.tsx:201`,
`video-markers.ts:5`). The capability-branch geometry is untested domain logic
sitting in a component, and it has no `dir` parameter — which is why video
markers are the one marker family with no RTL handling.

---

### 3.5 Teams

#### 3.5.1 Teams operations registry — **MODULE ✅**

`src/teams/operations.ts` centralises every server call behind one registry.
Every Teams UI component goes through it. This is the correct pattern.

One correctness gap: `:92` does not import `CreateTeamRequest` for client-side
pre-validation, so an empty or oversized team name is not caught before the
network call — the guarantee `api.ts:121-126` advertises.

#### 3.5.2 `useTeams` — **MODULE, but unreachable from the rest of the app**

`src/ui/teams/useTeams.ts:64` implements exactly the right async model:

```ts
const [failure, setFailure] = useState<PageFailure | null>(null);
const [pending, setPending] = useState<readonly (string | null)[]>([]);
busy: pending.includes(PAGE),
working: (key: string) => pending.includes(key),
failed:  (key: string) => (failure && failure.key === key ? failure.code : null),
```

Per-control busy state and per-control error reporting — so a failure says
_which_ button failed, not just that something did. **No other surface can reach
it**, because it takes a `TeamsClient`.

Meanwhile the notes side hand-rolls the same thing four times in one file:

```
HameshApp.tsx:1239  handleSave        setBusy(true); setError(null); try{…} catch{…} finally{…}
HameshApp.tsx:1336  handleUpdate      (same)
HameshApp.tsx:1358  handleTogglePin   (same, minus busy — by design, per :1355)
HameshApp.tsx:1374  handleDelete      (same)
```

And `grep useAsync|useRun|useBusy|useMutation|useResource|useDebounce` over
`src/` returns **zero matches**. There is no async-state hook in the codebase.

**Extraction:** lift `useTeams`'s model into a generic hook, then have `useTeams`
and all note mutations build on it.

```ts
// src/ui/useAsync.ts
export function useAsync<T, A extends unknown[]>(
  fn: (...a: A) => Promise<T>,
  deps: unknown[],
): { run(...a: A): Promise<T | null>; busy: boolean; error: string | null; clear(): void };

// keyed variant for the per-control case
export function useKeyedAsync(): {
  run(key: string, fn: () => Promise<void>): Promise<void>;
  working(key: string): boolean;
  failed(key: string): string | null;
};
```

Also duplicated: the `prefsRepo.watch` + `cancelled` boot effect at
`HameshApp.tsx:320`, `notes/App.tsx:205`, `popup/App.tsx:60`; `foldersRepo.watch`
at `HameshApp.tsx:345` / `notes/App.tsx:244`; theme detection at three sites.

#### 3.5.3 Personal vs team split — **PARTIAL (good design, scattered calls)**

The _architecture_ is right:
`NoteShareSlot.ts:15-38` injects Teams affordances through context; `library-notes.ts:9-16`
merges personal + team notes in one place; `personal-notes.ts:12-16` injects
forget/keep so Teams never touches personal storage.

The _calls_ are scattered — see §3.1.4 (8 sites).

#### 3.5.4 Teams sync layer — **MODULE ✅ (a real separation, not duplication)**

Worth calling out as a **non**-finding, because it looks like duplication:

- `src/teams/sync-store.ts` — private state in IndexedDB: sync cursor, note→page
  index (the server is never told the page), folder list
- `src/teams/page-cache.ts` — the public read model in `chrome.storage.local`,
  per Hamesh page, holding only that page's team notes

`page-cache.ts` exists **precisely because** the index in `sync-store` must stay
private from the content script. `sync.ts:26-35` injects the per-page buckets
into the delta loop; `page-notes.ts:19-39` adapts the cached subset. This is the
layering working as designed.

The one smell: defensive parsing is done separately in each store (deliberate —
zod must not reach the content bundle), which is a third copy of the
folder-parser idea from §3.2.6.

---

### 3.6 Cross-cutting

#### 3.6.1 Relative time — **PARTIAL (1 formatter, 2 string keys, 4 shims)**

`relativeTime(iso: string, lang)` at `src/ui/i18n.ts:509` is a good
implementation with 8 call sites. Three problems:

**(a) It lives in the locale table.** `i18n.ts` is strings; `relativeTime` is a
formatter. Meanwhile the actual formatter module is at `src/ui/teams/format.ts`
— outside `teams/` in name only for `formatDate`/`formatMoney`, which
`src/ui/TeamsSection.tsx` (a non-Teams file) needs.

**(b) Two string keys for one job.** `i18n.ts` has `editedAgo`, used by
`NoteRow:158`, `NoteViewer:182,191`, `PinnedSection:95`. `teams/strings.ts:83,267,501`
has `noteEdited: (when) => \`Edited ${when}\`` — the same phrase, duplicated.

**(c) Four coercion shims.** Because `relativeTime` only accepts a `string`, four
call sites hand-coerce a `number` epoch:

```
src/ui/teams/MentionsInbox.tsx:126   relativeTime(new Date(entry.createdAt).toISOString(), lang)
src/ui/teams/CommentThread.tsx:185   relativeTime(new Date(comment.createdAt).toISOString(), lang)
src/ui/teams/TeamNotePage.tsx:194    relativeTime(new Date(note.updatedAt).toISOString(), lang)
src/ui/teams/TeamOverview.tsx:139    relativeTime(new Date(snapshot.syncedAt).toISOString(), lang)
```

**Extraction:** one `src/ui/format.ts` that owns all four formatters and accepts
both timestamp shapes:

```ts
export function relativeTime(when: string | number | Date, lang: Lang): string;
```

This single move fixes (a), (b) and (c) at once.

#### 3.6.2 Date formatting — **PARTIAL (1 bypass)**

`src/ui/teams/format.ts:4` `formatDate` is imported by four Teams surfaces —
`TeamMembers:6`, `TeamInvitations:6`, `BillingPanel:6`, `TeamsView:11`. And then
re-implemented inline in `src/ui/TeamsSection.tsx:110-111`:

```ts
const formatDate = (ms: number) =>
  new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(ms));
```

One-line fix: import it.

#### 3.6.3 Empty state — **MISSING (12 hand-written copies)**

```
src/entrypoints/notes/App.tsx:719, 733, 746      (3 in one file)
src/entrypoints/popup/App.tsx:219
src/ui/teams/TeamsView.tsx:176, 194, 210
src/ui/teams/MentionsInbox.tsx:88, 108
src/ui/teams/TeamNotePage.tsx:162
src/ui/teams/TeamOverview.tsx:169               (--inline variant)
src/ui/teams/CommentThread.tsx:303              (--inline variant)
```

Every one is `<div className="hm-empty hm-fade-in">` + `MarginMark 28/3` +
`__title` + `__body` + optional action. Only the strings differ. `MarginMark`
itself is correctly shared.

`TeamsView.tsx:176` and `MentionsInbox.tsx:88` render the **identical**
signed-out state with the **identical** `strings.signedOutTitle` /
`signedOutBody`.

```tsx
// src/ui/EmptyState.tsx
export function EmptyState({
  title,
  body,
  action,
  inline,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  inline?: boolean;
}): JSX.Element;
```

#### 3.6.4 Loading skeleton — **MISSING (9 hand-written copies)**

```
src/entrypoints/notes/App.tsx:713        (3 rows)
src/entrypoints/popup/App.tsx:212        (2 rows)
src/ui/teams/TeamsView.tsx:163           (3 rows)
src/ui/teams/MentionsInbox.tsx:98        (3 rows)
src/ui/teams/TeamOverview.tsx:163, 349   (--tiles / --chips variants)
src/ui/teams/TeamMembers.tsx:75          (2 rows)
src/ui/teams/TeamNotePage.tsx:150        (2 rows)
src/ui/teams/CommentThread.tsx:293       (2 rows)
```

`TeamsView.tsx:162` hoists its skeleton into a local `const` — good local reuse,
but nothing shares it across files.

```tsx
// src/ui/Skeleton.tsx
export function Skeleton({
  rows = 3,
  variant,
}: {
  rows?: number;
  variant?: 'tiles' | 'chips';
}): JSX.Element;
```

#### 3.6.5 Page header — **MISSING (6 copies)**

`<header className="hm-notes-page__header">` + `MarginMark 20/3.5` + `<h1>`:

```
src/entrypoints/notes/App.tsx:618, 658   (identical to each other)
src/ui/LibrarySettingsView.tsx:101
src/ui/WhatsNewView.tsx:75
src/ui/teams/TeamsView.tsx:360           (byte-identical to App.tsx:658 apart from the title)
src/ui/teams/TeamPeople.tsx:51           (--sub modifier)
```

#### 3.6.6 Stagger animation — **REPLICATED (4 sites, 3 step values)**

```
src/ui/PinnedSection.tsx:73              i * 30
src/ui/ContinueSection.tsx:34            i * 30
src/entrypoints/notes/App.tsx:808        Math.min(i * 30, 240)
src/ui/WhatsNewView.tsx:58               Math.min((offset + i) * 40, 240)
```

The same pattern with a different step and cap each time — exactly what a
component parameterises.

#### 3.6.7 Icon set — **PARTIAL**

`src/ui/SettingsIcons.tsx` holds 12 icons but is a settings-only island — only
`BackupSection`, `LibrarySettingsView`, `SettingsView`, `Sidebar` and
`TeamsSection` import it. Meanwhile `FolderTree.tsx` privately defines
`ChevronIcon:508`, `PlusIcon:530`, `PencilIcon:538`, `TrashIcon:552`, and
`NoteActionsMenu.tsx:496` a `CurrentFolderCheck`. There are also four independent
check/close glyphs (`NoteViewer:214`, `NoteFilter:86`, `FolderPicker:141`,
`NoteActionsMenu:496`) and three chevrons (`NoteRow:141`, `WebsiteGroup:67`
identical `M2 3.5 L5 6.5 L8 3.5`; `FolderTree:519` a variant; plus
`SettingsView:69` and `popup/App.tsx:263` a back-chevron duplicate).

**Extraction:** promote `SettingsIcons.tsx` → `src/ui/icons/index.ts`; add
`Chevron`, `Plus`, `Pencil`, `Trash`, `Check`, `Close`, `Back`.

#### 3.6.8 Keyboard handling — **MISSING (7 independent handlers)**

| Site                                  | Binding                                      |
| ------------------------------------- | -------------------------------------------- |
| `src/ui/Composer.tsx:70,73`           | Escape → cancel; Ctrl/Cmd+Enter → submit     |
| `src/ui/NoteActionsMenu.tsx:200`      | Escape, "one level at a time"                |
| `src/ui/NoteActionsMenu.tsx:412`      | Enter (bare) → create folder                 |
| `src/ui/NoteActionsMenu.tsx:436`      | Ctrl/Cmd+Enter → save edit                   |
| `src/ui/NoteViewer.tsx:76`            | Escape ladder (3 steps) — **no Ctrl+Enter**  |
| `src/ui/FolderPicker.tsx:113,117`     | Enter (explicitly _not_ Ctrl) → save; Escape |
| `src/ui/FolderTree.tsx:486,487`       | Enter → save; Escape                         |
| `src/content/HameshApp.tsx:1089,1140` | Escape ×2 → clear selection                  |

The "Escape unwinds one level at a time" rule is documented in a comment at
`NoteActionsMenu.tsx:124` and re-implemented in four places. Ctrl/Cmd+Enter — the
standard submit chord — exists in 2 of 4 note editors.

**Extraction:**

```ts
// src/ui/keys.ts
export function useEscape(onEscape: () => void, active = true): void; // with a shared level stack
export function onSubmitChord(e: React.KeyboardEvent, submit: () => void): boolean;
```

Making "one level at a time" a property of the hook rather than four hand-written
ladders is the win.

#### 3.6.9 i18n — **REPLICATED (2 tables, 6 overlapping keys)**

`src/ui/i18n.ts` (`Strings`) and `src/ui/teams/strings.ts` (`TeamsStrings`) are
maintained in lockstep across 3 locales each, with overlapping keys and one
genuinely divergent pair:

| Key                        | `i18n.ts`               | `teams/strings.ts`                                               |
| -------------------------- | ----------------------- | ---------------------------------------------------------------- |
| `cancel`                   | `:18` `'Cancel'`        | `:19` `'Cancel'` — same                                          |
| `keepIt`                   | `:21` `'Keep it'`       | `:131` `'Keep it'` — same                                        |
| `delete`                   | `:20` `'Delete'`        | `:272` `'Delete'` — same                                         |
| `deleteConfirm`            | `:23` no args           | `:71` `deleteConfirm(team)` — **different signature, same name** |
| `deleteFolder`             | `:78` `'Delete folder'` | `:96` `'Delete'` — **different values**                          |
| `editedAgo` / `noteEdited` | `:…` `'Edited {when}'`  | `:267` `` `Edited ${when}` `` — **same, duplicated**             |

**Extraction:** a shared base table both extend.

```ts
// src/ui/strings/base.ts
export interface SharedStrings { cancel; keepIt; delete; editedAgo; … }
export type Strings       = SharedStrings & NotesStrings;
export type TeamsStrings = SharedStrings & TeamsStringsOnly;
```

The Teams build must keep tree-shaking away; the base table has no Teams
imports, so this is safe.

---

## 4. Proposed module set

Consolidating everything above into the target module surface:

```
src/domain/
  note.ts            + isSharedNote(), mayMutateNote()
  folder-grouping.ts + indexFoldersByParent(), generic flattenFolderTree()
  page-label.ts        (new) pageLabel() — shared by NoteRow + TeamNotePage
  format.ts            (new) relativeTime/formatDate/formatMoney — string|number|Date
  folder-tree.ts       (new) folderOptionLabel() — one indent unit

src/storage/
  keyed-collection.ts  (new) the read-modify-write loop, once

src/ui/
  EmptyState.tsx       (new) ← 12 copies
  Skeleton.tsx         (new) ← 9 copies
  PageHeader.tsx       (new) ← 6 copies
  InlineConfirm.tsx    (promote from ui/teams/) ← 3 copies + 1 stylesheet
  DomainKicker.tsx     (new) ← 4 copies
  useNoteEditor.ts     (new) ← 4 editors, 2 contracts
  useAsync.ts          (new) ← 0 hooks today; model lifted from useTeams
  useNoteMutations.ts  (new) ← 6 hand-rolled mutators
  keys.ts              (new) ← 7 handlers
  FolderSelect.tsx     (new) ← 5 folder widgets
  icons/               (promote from SettingsIcons.tsx) + Chevron/Plus/Pencil/Trash/Check/Close
  strings/base.ts      (new) shared i18n vocabulary
```

---

## 5. Bugs that exist _because_ of the duplication

Four are verified defects where a copy diverged from its original.

### 5.1 Notes Library cannot report a failure

`src/entrypoints/notes/App.tsx:470-504` (`handleDeleteFolder`, `handleMoveNote`)
has **no error state at all** — a failed write is silently swallowed.
`NoteActionsMenu.tsx:266` likewise, so a failed edit from the menu closes the
panel with no message.

Cause: `useTeams`'s error model is unreachable from non-Teams code, so every
other surface hand-rolled its own — and this one rolled nothing.

Related, same cause: `src/ui/Composer.tsx:53-56` has a staleness guard for a
`folderId` that no longer exists; `HameshApp.tsx:1361` (`handleTogglePin`)
bypasses the `isLocal` guard that `handleUpdate`/`handleDelete` use (`:1352`,
`:1389`) and its dependency array omits `isLocal`.

### 5.2 Long pinned notes are unreadable

```
PinnedSection.tsx:91        <p className="hm-pinned__preview" dir="auto">
notes-library.css:490-497   .hm-pinned__preview { -webkit-line-clamp: 2 }
notes-library.css:713       .hm-note-row__preview[data-expanded='true']  ← escape rule exists
```

There is **no** `.hm-pinned__preview[data-expanded='true']` rule anywhere, and
`PinnedSection` never sets `data-expanded` or renders a toggle. Every other
clamp in the feature is escapable (`NoteRow:117,134`, `WebsiteGroup:60,79`,
`FolderTree:389,448,512`). The pinned section is the sole exception, so a long
pinned note is permanently truncated to two lines with no "Show more".

Cause: the expandable-preview shell was written three times and the third copy
was never finished.

### 5.3 Nested folders are invisible on a team note

```
FolderPicker.tsx:194        {'\u00A0\u00A0'.repeat(depth) + folder.name}   ← non-breaking space
TeamNotePage.tsx:268        {' '.repeat(depth * 2)}                        ← ASCII space (0x20)
```

Verified at the character-code level. HTML collapses runs of ASCII whitespace, so
on a team note page a folder nested inside another renders at the same indent
level as its parent.

Cause: the indent unit was chosen twice and not centralised.

### 5.4 Orphaned team notes disappear from the Library

`src/ui/teams/NoteFilter.tsx:29`:

```ts
return owner.folder.id === null ? !note.team.folderId : note.team.folderId === owner.folder.id;
```

No existence check. A team note whose folder was deleted on the server
(`folderId` still set, folder gone) matches **neither** the folder filter **nor**
the Unfiled filter, so it is unreachable. `teams/folders.ts:51-52` handles
exactly this case correctly with `!n.folderId || !known.has(n.folderId)`.

Cause: the "unfiled" rule has four definitions and this one is the weakest.

---

## 6. Prioritised plan

Ordered by (lines removed) ÷ (risk). The first four are behaviour-preserving.

| #   | Action                                                                                                      | Copies killed      | Risk                                      |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------- |
| 1   | `PinnedSection` expand toggle (§5.2)                                                                        | —                  | **none** — fixes a real bug               |
| 2   | `src/ui/format.ts`; fix `TeamsSection` import; delete 4 `toISOString` shims; merge `editedAgo`/`noteEdited` | 6                  | very low                                  |
| 3   | Promote `InlineConfirm` → `src/ui/`; migrate 3 sites; merge the two CSS homes                               | 4 + 1 sheet        | low                                       |
| 4   | Import `FolderGlyph` in `TeamOverview`; fix `folderOptionLabel`; fix `validateFolderName` at 5 sites        | 5                  | low                                       |
| 5   | `<EmptyState>` (§3.6.3)                                                                                     | 12                 | low                                       |
| 6   | `<Skeleton>` (§3.6.4) + `<PageHeader>` (§3.6.5)                                                             | 15                 | low                                       |
| 7   | `useAsync` + `useNoteEditor` + `useNoteMutations` (§3.5.2, §3.1.2) — **fixes §5.1**                         | 10                 | medium                                    |
| 8   | `isSharedNote` (§3.1.4); un-gate `handleTogglePin`                                                          | 8                  | low                                       |
| 9   | Generic folder tree (§3.2.2) — kills the 3 copies incl. the two in one file                                 | 3                  | medium                                    |
| 10  | `<FolderSelect>` (§3.2.3)                                                                                   | 5 widgets → 1      | medium                                    |
| 11  | `keyed-collection` (§3.1.1); both repos                                                                     | 8 loops            | medium                                    |
| 12  | `src/ui/keys.ts` + `<Chevron>` + icon consolidation (§3.6.7, §3.6.8)                                        | 14                 | low                                       |
| 13  | `strings/base.ts` (§3.6.9)                                                                                  | 6 keys × 3 locales | medium — needs RTL/locale regression pass |
| 14  | `PageHeader`/`DomainKicker`/`Stagger` extras                                                                | 5                  | low                                       |

**Sequencing note:** do 1–6 before 7–14. Items 1–6 are each independently
mergeable and individually testable; item 7 is the one that touches behaviour
and should go in on its own with the existing `HameshApp.*.test.tsx` suite as
the net.

**Tests already in place that will catch regressions:** `tests/ui/no-native-dialogs.test.ts`
(scan for `window.confirm`), `tests/ui/tokens.test.ts`, the `HameshApp.*.test.tsx`
suite, `tests/ui/InlineConfirm.test.tsx`. Worth adding: a test that pins
`InlineConfirm` usage so a fifth copy can't appear, and a test that pins
`validateFolderName` at every folder-name entry point.

---

## Appendix — file:line index

| Concern                         | Location                                                                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Note model + `team` doc comment | `src/domain/note.ts:136-147, 180, 208`                                                                                                                   |
| Folder model + validation       | `src/domain/folder.ts:9, 30, 44, 63`                                                                                                                     |
| Folder tree (3 copies)          | `src/domain/folder-grouping.ts:31, 48-52, 69, 83-87, 106`; `src/ui/teams/folders.ts:14, 24`                                                              |
| Note storage loops              | `src/storage/notes-repository.ts:66, 81, 101, 126`                                                                                                       |
| Folder storage loops            | `src/storage/folders-repository.ts:34, 42, 53, 61`                                                                                                       |
| Async (none exists)             | `grep useAsync\|useRun\|useBusy\|useMutation` → 0                                                                                                        |
| Correct async model             | `src/ui/teams/useTeams.ts:64, 66, 68, 173-176`                                                                                                           |
| Hand-rolled mutators            | `src/content/HameshApp.tsx:1239, 1336, 1358, 1374`                                                                                                       |
| Silent failure                  | `src/entrypoints/notes/App.tsx:470-504`; `src/ui/NoteActionsMenu.tsx:266`                                                                                |
| `note.team` predicate (8)       | `NoteViewer:63`; `NoteActionsMenu:143`; `HameshApp:1331`; `NoteFilter:26,29`; `NoteRow:105,161`; `page-notes:46`; `notes/App:549,568`                    |
| Confirm (4)                     | `ui/teams/InlineConfirm:47`; `NoteViewer:157`; `FolderTree:348`; `NoteActionsMenu:462`                                                                   |
| Confirm CSS split               | `notes-library.css:996`; `teams.css:326, 602`                                                                                                            |
| Empty states (12)               | `notes/App:719,733,746`; `popup/App:219`; `TeamsView:176,194,210`; `MentionsInbox:88,108`; `TeamNotePage:162`; `TeamOverview:169`; `CommentThread:303`   |
| Skeletons (9)                   | `notes/App:713`; `popup/App:212`; `TeamsView:163`; `MentionsInbox:98`; `TeamOverview:163,349`; `TeamMembers:75`; `TeamNotePage:150`; `CommentThread:293` |
| Page headers (6)                | `notes/App:618,658`; `LibrarySettingsView:101`; `WhatsNewView:75`; `TeamsView:360`; `TeamPeople:51`                                                      |
| Time formatting                 | `i18n.ts:509`; shims `MentionsInbox:126`, `CommentThread:185`, `TeamNotePage:194`, `TeamOverview:139`; dup key `teams/strings:83,267,501`                |
| Date formatting dup             | `teams/format.ts:4` vs `TeamsSection.tsx:110-111`                                                                                                        |
| Folder widgets (5)              | `FolderPicker:174`; `FolderTree:77`; `NoteActionsMenu:341`; `TeamNotePage:257`; `TeamOverview:182`                                                       |
| Folder indent bug               | `FolderPicker:194` (NBSP) vs `TeamNotePage:268` (ASCII space)                                                                                            |
| Folder validation (6)           | `folder.ts:30`; `FolderPicker:76`; `FolderTree:486,493`; `NoteActionsMenu:255,418`; `TeamOverview:96,110`                                                |
| Unfiled rule (4)                | `folder-grouping:57`; `teams/folders:51`; `TeamNotePage:262`; `NoteFilter:29`                                                                            |
| Folder parsers (3)              | `folder.ts:63`; `backup.ts:66`; `sync-store.ts:51`                                                                                                       |
| Folder strings                  | `i18n.ts:214-220` vs `teams/strings.ts:278-285`                                                                                                          |
| Folder glyph dup                | `FolderGlyph.tsx:6` vs `TeamOverview.tsx:387`                                                                                                            |
| Preview clamp bug               | `PinnedSection.tsx:91`; `notes-library.css:490, 713`                                                                                                     |
| i18n overlap                    | `i18n.ts:18-23, 78-79` vs `teams/strings.ts:19, 71, 96, 131`                                                                                             |
| Key handlers (9)                | `Composer:70,73`; `NoteActionsMenu:200,412,436`; `NoteViewer:76`; `FolderPicker:113,117`; `FolderTree:486,487`; `HameshApp:1089,1140`                    |
| Stagger (4)                     | `PinnedSection:73`; `ContinueSection:34`; `notes/App:808`; `WhatsNewView:58`                                                                             |
| Scroll restore (2)              | `HameshApp.tsx:1003-1018`, `:1750-1766`                                                                                                                  |
| 1400ms mirror                   | `tokens.css:294`; `HameshApp.tsx:107, 1010`                                                                                                              |
| Video dead CSS                  | `tokens.css:1099-1111`; `TextNotePopup.tsx:54`                                                                                                           |
| Video rail types                | `HameshApp.tsx:201` vs `video-markers.ts:5`                                                                                                              |
| Teams operations                | `src/teams/operations.ts` (registry)                                                                                                                     |
| Domain kicker (4)               | `NoteRow:93`; `PinnedSection:83`; `WebsiteGroup:55`; `ContinueSection:44`                                                                                |
| Title re-derivation             | `TeamNotePage.tsx:179, 189, 191` vs `notes-grouping.ts:159`                                                                                              |
