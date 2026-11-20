# 02 Export model and escaping

**Phase:** B
**Depends on:** 01
**Status:** todo

## Goal

Turn notes and folders into one model every renderer reads: pages, sites, groups with a layout,
order, sections. Plus the small string helpers that make the output safe.

## Files

- Create: `src/domain/export/model.ts` (`buildExportModel`, `pageIdentity`, `cleanTitle`, `orderKey`)
- Create: `src/domain/export/layout.ts` (`ExportLayout`, `inferLayout`, `groupKeyFor`)
- Create: `src/domain/export/text.ts` (`escapeBlock`, `escapeCell`, `truncateWords`, `yamlString`, `mermaidLabel`)
- Create: `src/domain/export/file-names.ts` (`safeFileName`, `assignPaths`)
- Change: `src/domain/preferences.ts` (`ExportPreferences { flavor, layouts }`)

## Steps

- [ ] 1. `escapeBlock`, `escapeCell`, `truncateWords`, `yamlString`, `mermaidLabel` (FORMAT rules 2, 3, 10, 13)
  - Test: `tests/domain/export/text.test.ts`: every rule, Arabic text untouched, `#2` escaped
- [ ] 2. `safeFileName` and `assignPaths` (rules 17, 18)
  - Test: `tests/domain/export/file-names.test.ts`: forbidden characters, `CON`, dots, 80 cap, stable clash suffix
- [ ] 3. `pageIdentity`, `cleanTitle`, `orderKey`
  - Test: `tests/domain/export/model.test.ts`: two YouTube videos stay two pages; `(93) … - YouTube` cleaned; order by text position, element y, timestamp
- [ ] 4. `buildExportModel(notes, folders, scope)`: pages with kind, dates, folders, sections; groups (folders, then each site's unfiled notes) in scope
  - Test: `tests/domain/export/model.test.ts`: page/folder/all scopes, sub-folders included, a page in two folders lists both
- [ ] 5. `inferLayout` and `groupKeyFor` (FORMAT: Inference)
  - Test: `tests/domain/export/layout.test.ts`: vocabulary → glossary, videos → timeline, long notes → notes, never checklist, under 3 notes stays notes
- [ ] 6. `ExportPreferences` in `Preferences` with defaults and a defensive parse (flavor `obsidian`, layouts `{}`)
  - Test: `tests/domain/preferences.test.ts`: defaults, bad flavor dropped, unknown layout dropped

## Phase integration test

`tests/domain/export/model.test.ts` runs the owner's anonymised backup shape (fixture) end to end.

## Done when

- All steps ticked; `buildExportModel` gives the same model twice for the same input.

## Notes
