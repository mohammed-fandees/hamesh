# 05 Release prep

**Phase:** E
**Depends on:** 03, 04
**Status:** done

## Goal

Everything 2.3.1 needs except the tag, which waits for the owner.

## Files

- Change: `package.json`, `wxt.config.ts` (2.3.1)
- Change: `CHANGELOG.md`, `src/domain/release-notes.ts`, `README.md` (What's new)

## Steps

- [x] 1. Version 2.3.1 in both files
  - Test: `tests/release/version.test.ts`
- [x] 2. Dated CHANGELOG section; release notes in English and Arabic, no file names
  - Test: `tests/domain/release-notes.test.ts`; `pnpm release:validate --tag=v2.3.1`
- [x] 3. README "What's new"
  - Test: none (copy)
- [x] 4. Full suite, store-build check, plan check at 100%
  - Test: `pnpm check`, `pnpm test:e2e`, `node scripts/plan-check.mjs docs/plans/lost-notes`

## Phase integration test

`pnpm test:e2e`.

## Done when

- Release PR merged; no tag pushed. The owner says when to tag `v2.3.1`.

## Notes

- Full run (2026-11-24, store build, everything through #147 in): `pnpm check` green (1415 unit
  tests); `pnpm test:e2e` 144/144; `pnpm release:validate --tag=v2.3.1 --previous-ref=v2.3.0`
  green, permissions unchanged (`activeTab, alarms, favicon, storage`).
- What's New covers lost notes, kept notes on the page and team notes. The usage-sharing bubble
  is in the changelog only, as the owner asked: it is for us, not the reader.
- Putting a team note back needs `hamesh-api` to accept `anchor` (part 07, step 10). Tag only
  after that is deployed.
- Version: 2.3.1 as the owner asked (rules §11 would make it 2.4.0).
- Release date 2026-11-24 in the changelog and What's New: change it if the tag goes out later.
