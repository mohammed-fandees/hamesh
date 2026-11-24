# 05 Release prep

**Phase:** E
**Depends on:** 03, 04
**Status:** pending

## Goal

Everything 2.3.1 needs except the tag, which waits for the owner.

## Files

- Change: `package.json`, `wxt.config.ts` (2.3.1)
- Change: `CHANGELOG.md`, `src/domain/release-notes.ts`, `README.md` (What's new)

## Steps

- [ ] 1. Version 2.3.1 in both files
  - Test: `tests/release/version.test.ts`
- [ ] 2. Dated CHANGELOG section; release notes in English and Arabic, no file names
  - Test: `tests/domain/release-notes.test.ts`; `pnpm release:validate --tag=v2.3.1`
- [ ] 3. README "What's new"
  - Test: none (copy)
- [ ] 4. Full suite, store-build check, plan check at 100%
  - Test: `pnpm check`, `pnpm test:e2e`, `node scripts/plan-check.mjs docs/plans/lost-notes`

## Phase integration test

`pnpm test:e2e`.

## Done when

- Release PR merged; no tag pushed. The owner says when to tag `v2.3.1`.
