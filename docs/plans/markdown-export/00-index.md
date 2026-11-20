# Markdown export for Obsidian and Notion

**Goal:** take any page, folder or the whole library out to Obsidian or Notion, shaped by what
the notes are (notes, a glossary, a video timeline, a checklist).
**Status:** in progress
**Canvas:** https://claude.ai/artifact/85WGz7qMJZtJ3zkoFheiNZ (boards A–F)
**Flow tree:** [plan.excalidraw](plan.excalidraw) from [flow.json](flow.json)
**Background:** [PROPOSAL.md](PROPOSAL.md) · [MONETIZATION.md](MONETIZATION.md) ·
[FORMAT.md](FORMAT.md) (the formatting rules every renderer follows)

## Scope

- In: capture of section heading and video chapter; export engine; four layouts with inference
  and a per-folder / per-site choice; Obsidian and Notion renderers; zip; export dialog with a
  layout picker and a live preview; entry points in the note menu, folder menu and Settings;
  release prep for 2.3.0 (stops before the tag).
- Out: import back from Markdown, live vault sync, team comments in the export, AI summaries,
  "notes that lost their place" (its own release, [lost-notes](../lost-notes/PROPOSAL.md)).

## Decisions

| Concern         | Decision                                                                     | Why                                                                                                     | Rejected                        |
| --------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Price           | Free, with a mandatory "Exported from Hamesh" line                           | Reach first; export is a trust feature                                                                  | Paid visuals, referral unlock   |
| Zip             | adopt `fflate` (`zipSync`), loaded with `import()`                           | MIT, 2026-07 release, few kB                                                                            | JSZip (size, GPL option), build |
| YAML            | build: JSON-string scalars                                                   | flat values only                                                                                        | `yaml` at runtime               |
| Layouts         | `notes`, `glossary`, `timeline`, `checklist`; inferred per group, changeable | Real backup: 15/22 notes are vocabulary                                                                 | One fixed shape                 |
| Layout previews | Our own drawn thumbnails + a live preview of the person's own notes          | Obsidian/Notion screenshots are their copyrighted, trademarked UI; a live preview shows the real result | Official screenshots            |
| Page identity   | `platform:videoId` for video notes, `pageKey` otherwise                      | All YouTube notes share one `pageKey`                                                                   | `pageKey` alone                 |
| Mermaid check   | `mermaid.parse()` in a jsdom test (devDependency)                            | Catch a broken diagram before a person does                                                             | Eyeballing                      |

## Phases and parts

| #   | Part                                         | Phase | Status | Depends on |
| --- | -------------------------------------------- | ----- | ------ | ---------- |
| 01  | [Capture section and chapter](01-capture.md) | A     | done   | none       |
| 02  | [Export model and escaping](02-model.md)     | B     | done   | 01         |
| 03  | [Layouts and renderers](03-renderers.md)     | C     | done   | 02         |
| 04  | [Export UI](04-ui.md)                        | D     | todo   | 03         |
| 05  | [Release prep](05-release.md)                | E     | todo   | 04         |

Each phase is its own PR, merged once CI is green. The release tag waits for the owner.

## Verification commands

| Level                             | Command                                                   |
| --------------------------------- | --------------------------------------------------------- |
| Tasks                             | `node scripts/plan-check.mjs docs/plans/markdown-export`  |
| Unit                              | `pnpm test`                                               |
| E2E                               | `pnpm build && pnpm test:e2e e2e/markdown-export.spec.ts` |
| Typecheck / lint / format / build | `pnpm check`                                              |

## Risks and open questions

- Notion import details shift without notice: renderer sticks to CommonMark + GFM tables, task
  lists and `mermaid` fences; checked against the examples in Phase E.
- GitHub was unreachable from this machine when work started (DNS). Branches stay local until
  it is back; PRs are opened and merged then.
