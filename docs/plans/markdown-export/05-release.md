# 05 Release prep

**Phase:** E
**Depends on:** 04
**Status:** todo

## Goal

Everything 2.3.0 needs except the tag, which waits for the owner.

## Files

- Change: `package.json`, `wxt.config.ts` (2.3.0)
- Change: `CHANGELOG.md`, `src/domain/release-notes.ts`
- Change: `README.md` (What's new, Features), `docs/chrome-web-store/STORE_LISTING.md`
- Change: `docs/plans/markdown-export/examples/` (regenerated from the real renderer)

## Steps

- [ ] 1. Regenerate `examples/obsidian` and `examples/notion` with the shipped renderer
  - Test: `tests/domain/export/render.integration.test.ts` compares against them
- [ ] 2. Version 2.3.0 in both files, CHANGELOG section, release notes in English and Arabic
  - Test: `tests/domain/release-notes.test.ts`; `pnpm release:validate --tag=v2.3.0`
- [ ] 3. README and store listing lines
  - Test: none (copy)
- [ ] 4. Full suite, leak check of the store build, plan check at 100%
  - Test: `pnpm check`, `pnpm test:e2e`, `node scripts/plan-check.mjs docs/plans/markdown-export`

## Phase integration test

`pnpm test:e2e`.

## Done when

- Release PR merged; no tag pushed. The owner says when to tag `v2.3.0`.

## Notes
