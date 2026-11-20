# 03 Layouts and renderers

**Phase:** C
**Depends on:** 02
**Status:** todo

## Goal

Render the model as files for Obsidian or Notion, in the layout chosen for each group, and pack
them into a zip. Pure functions from model to `Map<path, string>`.

## Files

- Create: `src/domain/export/strings.ts` (export labels, English and Arabic)
- Create: `src/domain/export/mermaid.ts` (mindmap, timeline flowchart, pie)
- Create: `src/domain/export/render.ts` (`renderExport(model, options)`: page, folder, overview files for both flavors and all four layouts)
- Create: `src/domain/export/extras.ts` (Obsidian `.canvas` and `.base`, Notion `.csv`)
- Create: `src/domain/export/archive.ts` (`toZip(files)` via `fflate`, `toSingleFile`)
- Change: `package.json` (`fflate` dependency, `mermaid` devDependency)

## Steps

- [ ] 1. Export labels in both languages, with Arabic counts (`ملاحظة واحدة`, `ملاحظتان`, `3 ملاحظات`, `11 ملاحظة`)
  - Test: `tests/domain/export/strings.test.ts`: count forms, dates in the Latin digits Hamesh uses
- [ ] 2. Mermaid builders
  - Test: `tests/domain/export/mermaid.test.ts`: `mermaid.parse()` accepts every builder's output, including Arabic and hostile labels
- [ ] 3. Page renderer for `notes` and `timeline`, both flavors (properties, info line, map, at a glance, notes, footer)
  - Test: `tests/domain/export/render.test.ts`: Obsidian callouts and block ids; Notion plain quotes, properties table, no HTML; footer always present
- [ ] 4. Page renderer for `glossary` and `checklist`
  - Test: `tests/domain/export/render.test.ts`: glossary table with context sentence; checklist task lines with the quote under each
- [ ] 5. Folder and site files per layout, overview with pie and pages table
  - Test: `tests/domain/export/render.test.ts`: glossary folder sorted A→Z; links are full-path wikilinks (Obsidian) or encoded relative links (Notion); alias never holds `|`
- [ ] 6. Obsidian `.canvas` (pages with 3+ word or element notes), `.base`; Notion `.csv` (BOM, quoting, formula guard)
  - Test: `tests/domain/export/extras.test.ts`: canvas is valid JSON Canvas with an edge per note; CSV guards `=1+1`
- [ ] 7. `toZip` and `toSingleFile`
  - Test: `tests/domain/export/archive.test.ts`: unzip round trip keeps every path and byte; a path with `..` is refused

## Phase integration test

`tests/domain/export/render.integration.test.ts`: the anonymised real-backup fixture rendered for
both flavors with inferred layouts; every table row has its column count; every diagram parses.

## Done when

- All steps ticked; output matches FORMAT.md rule by rule.

## Notes
