# 05 Release prep

**Phase:** E
**Depends on:** 04
**Status:** done

## Goal

Everything 2.3.0 needs except the tag, which waits for the owner.

## Files

- Change: `package.json`, `wxt.config.ts` (2.3.0)
- Change: `CHANGELOG.md`, `src/domain/release-notes.ts`
- Change: `README.md` (What's new, Features), `docs/chrome-web-store/STORE_LISTING.md`

## Steps

- [x] 1. Render every layout in both tools from the fixture library
  - Test: `tests/domain/export/render.integration.test.ts`
- [x] 2. Version 2.3.0 in both files, CHANGELOG section, release notes in English and Arabic
  - Test: `tests/domain/release-notes.test.ts`; `pnpm release:validate --tag=v2.3.0`
- [x] 3. README and store listing lines
  - Test: none (copy)
- [x] 4. Full suite, leak check of the store build, plan check at 100%
  - Test: `pnpm check`, `pnpm test:e2e`, `node scripts/plan-check.mjs docs/plans/markdown-export`

## Phase integration test

`pnpm test:e2e`.

## Done when

- Release PR merged; no tag pushed. The owner says when to tag `v2.3.0`.

## Notes

- Full run (2026-11-20): `pnpm check` green (1298 unit tests, typecheck, lint, format, build);
  `pnpm release:validate --tag=v2.3.0` green; e2e 140 of 141 on the Teams build. The one failure,
  `whats-new.spec.ts` "sits at the bottom of the sidebar", counts 4 sidebar items and the Teams
  build has 6; on the store build it passes with the export spec (8 of 8). It predates this work.
- Store build: permissions `storage, activeTab, favicon, alarms`, no side panel. Its content
  script mentions `hm-consent` only in `isOnHameshUi`, as on `main`.
- Release date 2026-11-20 in the changelog and What's New: change it if the tag goes out later.
