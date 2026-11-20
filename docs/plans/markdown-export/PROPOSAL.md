# Markdown export for Obsidian and Notion — proposal

Status: **decisions taken 2026-11-20, design in progress.** Nothing here is built yet.

**Owner's decisions (2026-11-20):**

- Personal export is **free**, and every file ends with an "Exported from Hamesh" line and link.
  The line is **always there**; the dialog offers no switch (owner, 2026-11-20). A team digest export goes into Teams plans in a
  later release ([MONETIZATION.md](MONETIZATION.md)).
- **Capture the section heading and video chapter** with every new note from this release on
  (`Note.capture`, §4).
- **Obsidian and Notion ship together** in 2.3.0.
- Design first: a **design canvas** and an **Excalidraw flow tree** before any code.
- **Canvas** (pending approval): https://claude.ai/artifact/85WGz7qMJZtJ3zkoFheiNZ —
  A folder export (Arabic, light), B one page (English, dark), C entry points, D states.
  Flow tree: [plan.excalidraw](plan.excalidraw) (from [flow.json](flow.json)).
- The Library lists notes under each website and has no page row, so the page entry point lives in
  every note's menu ("Copy the page's notes as Markdown", "Export the page's notes…").
  "Copy" uses the remembered flavor with no dialog. Settings' Backup panel becomes
  "Backup and export" with a third row.

Related: [00-index.md](00-index.md) · [FORMAT.md](FORMAT.md) · [MONETIZATION.md](MONETIZATION.md) · [lost-notes](../lost-notes/PROPOSAL.md)

## 1. Goal

Let people take their margin out of the browser and into the tool where they think: Obsidian or
Notion. The export does more than list notes. It rebuilds the page around them: notes in the order
they sit on the page or in the video, grouped by the section or chapter they belong to, with a map,
a timeline and a table where each one helps.

Non-goals for this release: importing Markdown back into Hamesh, live two-way sync with a vault,
exporting other people's comments outside the Teams build, and any AI summary (it would break the
"no note leaves your device" promise).

## 2. Who exports, and what they need

| #   | Person                         | What they write in Hamesh                  | What the export must give them                                                    |
| --- | ------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------- |
| 1   | Student watching a lecture     | Video moments (`Alt+V`)                    | A study sheet in time order, each line a link back to the second it was written   |
| 2   | Researcher / reader            | Notes on exact words (`Alt+T`)             | A literature note: the quote, then the thought, in page order, with the source    |
| 3   | Developer reading docs         | Words and elements (code blocks, diagrams) | One file per docs page that links to the others, so the vault graph connects them |
| 4   | Designer / PM reviewing a site | Element notes (`Alt+H`)                    | A review table: where on the page, what's wrong, which page                       |
| 5   | Shopper / comparer             | Notes across several sites                 | One overview that compares sites side by side                                     |
| 6   | Language learner               | Words with a meaning as the note           | Term and meaning pairs, ready for flashcards                                      |
| 7   | Team member (Teams build)      | Shared notes with comments                 | A discussion digest: the note, then the replies, and who said what                |

Arabic and English content both have to read correctly. Obsidian and Notion set the direction of
each line from its first strong letter, so the export never forces a direction. It only avoids
starting an Arabic line with a Latin token (like a timestamp link) where that would flip the line.
That is why the time sits in its own table column, not in the middle of an Arabic sentence.

## 3. What gets exported

**Scopes**, from where the person already is:

- One page or one video: from the page's menu in the Library (`WebsiteGroup` / `NoteActionsMenu`),
  as **Copy as Markdown** (clipboard) or **Download .md**.
- One folder: from the folder menu, as a `.zip`.
- Everything: Settings → Backup, beside the JSON backup, as a `.zip`.

**Two flavors**, chosen once and remembered in `Preferences.export` (a nested object):

|                       | Obsidian                                  | Notion                                                                        |
| --------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| Page properties       | YAML frontmatter                          | A small two-column table at the top (Notion import does not read frontmatter) |
| Quote + note          | `> [!quote]` callout                      | Plain `>` quote, then the note                                                |
| Links between files   | `[[wikilinks]]` (feed the graph view)     | Relative `.md` links (Notion links pages inside one zip)                      |
| Per-note link target  | Block id `^hm-<id>`                       | None                                                                          |
| Diagrams              | Mermaid code blocks                       | Mermaid code blocks (Notion renders `mermaid`)                                |
| Spatial map of a page | `.canvas` file (JSON Canvas, open format) | Mermaid map only                                                              |
| Table of every note   | `Hamesh notes.base` (Obsidian Bases)      | `Hamesh notes.csv` (imports as a database)                                    |

## 4. The shape of one page file

1. **Properties**: title, source URL, site, kind (`article` / `video` / `mixed`), note count,
   created, updated, folders, tags `hamesh` and `hamesh/<kind>`, and a stable `hamesh_page` id.
2. **Header**: a callout with the source link and "N notes · last written …".
3. **The map**, picked by what the page holds:
   - video notes → a timeline (Mermaid flowchart, grouped by chapter);
   - text and element notes → a mind map of the page (Mermaid `mindmap`, grouped by section);
   - fewer than 3 notes → no diagram. A diagram of two dots is noise.
4. **At a glance**: a table, one row per note, in page or video order.
5. **The notes**: one heading per section or chapter, then each note in order. A text note shows its
   quote first, an element note shows what it was on (`image`, `code`, `table`…), a video note
   shows its time as a link.

Order comes from what the anchor already stores: `textPosition.start` for words,
`fallbackDocumentPosition.y` for elements, `timestamp` for video moments.

**Sections and chapters need one new capture.** Today a note doesn't record the heading above it
or the video chapter it was written in. Proposal: from this release on, the composer records them
in a new nested object, `Note.capture = { section?: string; chapter?: string }`, so a heading is
read once, at write time, from the page the person is on. Older notes have none; they export in
page order under a single "Notes" heading. Nothing is read from the page at export time.

## 5. The vault zip

```
Hamesh/
  Hamesh.md                      overview: counts, a pie of notes per site, every page, every folder
  Hamesh notes.base              Obsidian only: a live table of every page file
  Hamesh notes.csv               Notion only: one row per note → a Notion database
  Sites/<site>/<page title>.md   one file per page
  Sites/<site>/<page title>.canvas   Obsidian only, pages with 3+ notes on words or elements
  Folders/<folder path>.md       one file per folder: what's in it, as links
```

- **One file per page, not per note.** Per-note files flood a vault, and block ids still let
  someone link a single note (`[[Page#^hm-01jd]]`).
- **Re-exporting replaces, never duplicates.** File names are stable (title, then a short id
  suffix if two pages share a title). The overview says that `Hamesh/` belongs to the export, so
  the reader keeps their own writing outside it.
- **The `Folders/` notes are what makes the graph.** Pages link to their site and folders, so
  Obsidian's graph view draws sites, folders and pages as one picture, with no extra work.

## 6. Engineering

**Where it runs.** Only in Hamesh's own pages (Library, Settings). Never in the content script, so
nothing grows in a stranger's page and the store build stays the same size there.

**Modules** (all pure, all in `src/domain/export/`, tested without a DOM):

- `export-model.ts`: notes + folders → pages, sites, sections, order. The one place that decides
  order and grouping; both flavors render from it.
- `markdown.ts`: escaping. Note content is the person's own text and stays as typed, line breaks
  included. Only what would break the structure is escaped: a line starting `#`, `>`, `|` inside a
  table cell, `---` inside the body.
- `frontmatter.ts`: every value written as a JSON string, which is valid YAML, so a title like
  `Yes: no` or `#1` can never become a different type.
- `mermaid.ts`: labels always in `"…"`, quotes and brackets replaced with Mermaid entities,
  trimmed to 60 characters, ids generated (never taken from content).
- `csv.ts`: UTF-8 with a BOM (so Excel shows Arabic), RFC 4180 quoting, and any cell starting
  with `=`, `+`, `-`, `@` prefixed with `'` so a spreadsheet never runs it as a formula.
- `canvas.ts`: JSON Canvas layout, sections as groups, notes around the page card.
- `file-names.ts`: strips `\ / : * ? " < > | # ^ [ ]`, Windows reserved names (`CON`, `NUL`…),
  trailing dots, and `..`; caps at 80 characters; resolves clashes.
- `render-obsidian.ts`, `render-notion.ts`, `render-csv.ts`, `render-base.ts`.

**Libraries**

```
Concern: writing a .zip in the browser
Options: fflate, client-zip, JSZip, build
Decision: adopt fflate (zipSync), loaded with import() only when a zip export starts
Why: MIT, last published 2026-07, tree-shakes to a few kB for zipSync, no dependencies
Rejected: JSZip (heavier, dual MIT/GPL licence); client-zip (stream API, more than we need)

Concern: YAML frontmatter
Options: yaml (already a devDependency), build
Decision: build (JSON-string scalars)
Why: we only write flat scalars and string lists; shipping a YAML parser for that is waste

Concern: Mermaid / Canvas / CSV output
Decision: build. Each is a small string format we fully control and test.
```

**Download** uses a `Blob` and an `<a download>` click, as the JSON backup does. No `downloads`
permission, so no new store review question.

**Teams build.** Shared notes are already in the Library (`library-notes.ts`). They export with a
"Shared with <team>" property. Comments are not exported in this release (see §1).

## 6a. Learned from a real backup (2026-11-20)

The owner's own backup (22 notes, 13 pages, 9 folders) was run through a preview of the Obsidian
renderer. Every one of these is now a rule, and each gets a unit test in Phase B or C:

- **Every YouTube note shares one `pageKey`** (`https://www.youtube.com/watch`). A page in the
  export is therefore `platform + videoId` for a video note and `pageKey` for everything else;
  grouping by `pageKey` alone would merge every video into one file.
- **YouTube titles carry the unread-notification count**, e.g. `(93) …title… - YouTube`. The
  leading `(N) ` and the trailing ` - YouTube` are stripped.
- **Titles contain `|`** (podcast episode titles). Inside a wikilink alias in a table that splits
  the row. Aliases replace `|` with `–` and drop `[` `]`.
- **A folder can be called `Hamesh`**, the same as the export root. Every wikilink is written as a
  full path with an alias (`[[Hamesh/Folders/Hamesh|Hamesh]]`), and the overview file is
  `نظرة عامة.md` / `Overview.md`, never `Hamesh.md`.
- **A note can be just `#2`.** Escaped to `\#2` so it stays text.
- **Vocabulary is a real use**: 15 of 22 notes are a word and its meaning. The folder note's table
  (word · meaning · page) turns that folder into a glossary with no special mode.
- **One page can sit in two folders** (notes on one page filed differently). The page lists both.
- **Pages with one note** get no map and no "at a glance" table; most real pages are like this.

## 7. Phases and tests

| Phase | What                                                                    | Tests                                                                                                                                    |
| ----- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A     | `capture` field: record section heading and video chapter at write time | Unit: heading lookup on fixture DOMs; YouTube chapter from a fixture player; old notes parse unchanged                                   |
| B     | Export model + escaping + file names                                    | Unit: ordering per anchor type, grouping, every escaping rule, Arabic titles, clashes                                                    |
| C     | Obsidian and Notion renderers, CSV, Base, Canvas                        | Snapshot tests against the files in `examples/`; every Mermaid block checked with `mermaid.parse()` in a jsdom test (devDependency only) |
| D     | UI: export dialog, page/folder/all entry points, clipboard              | Component tests by role; e2e: export a fixture page and unzip it                                                                         |
| E     | Release 2.3.0: notes, store listing line, screenshots                   | Manual import into a real Obsidian vault and a real Notion workspace                                                                     |

## 8. Risks

- **Notion import details shift without notice** (frontmatter, link resolution inside a zip).
  Phase E imports into a real workspace before release; the Notion renderer avoids anything that
  isn't plain Markdown plus `mermaid`.
- **Mermaid versions differ** between Obsidian and Notion. Only flowchart, mindmap and pie are
  used, all long supported.
- **Large libraries.** A few thousand notes build in memory in well under a second; the zip is
  built once, at the click, not kept.
