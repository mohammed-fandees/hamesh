# Contributing to Hamesh

Contributions are welcome. Hamesh is released under the
[PolyForm Noncommercial License 1.0.0](LICENSE), which lets anyone use, change,
and redistribute it for noncommercial purposes.

## Workflow

1. Branch off `main`: `git switch -c feat/short-description` (or `fix/…`, `chore/…`, `docs/…`).
2. Make focused changes with clear commits (Conventional Commits encouraged).
3. Run the full gate locally: `pnpm check` (typecheck + lint + format + unit tests + build).
   For extension behaviour changes, also run `pnpm test:e2e`.
4. Open a pull request into `main`. The PR **title** becomes the squash-merge
   commit subject — use a Conventional Commit style.
5. Ensure CI is green and address review comments. Branches are deleted on merge.

## Conventions

- **Commits / PR titles:** `type: summary` — `feat`, `fix`, `chore`, `docs`,
  `test`, `refactor`, `perf`, `ci`.
- **Formatting/linting:** enforced by Prettier + ESLint; run `pnpm format` before pushing.
- **Tests:** keep meaningful coverage of domain/storage logic; don't weaken
  assertions to make CI pass.
- **Privacy:** never introduce network calls, telemetry, or storage of form/input
  values. Hamesh is local-only by design.

## Versioning & releases

Semantic Versioning. The version lives in `package.json` and `wxt.config.ts`
(kept in sync). Releases are cut from `main` by pushing a `vMAJOR.MINOR.PATCH`
tag — see [docs/RELEASING.md](docs/RELEASING.md).

## Licensing your contribution

By opening a pull request you confirm that:

1. You wrote the contribution yourself, or you otherwise have the right to submit it.
2. Your contribution goes out to everyone under the same PolyForm Noncommercial
   License 1.0.0 that covers the rest of Hamesh.
3. You also grant Mohammed Fandees a perpetual, worldwide, irrevocable,
   royalty-free right to use your contribution and to relicense it under other
   terms, including commercial ones.

Point 3 is there so Hamesh can sell a commercial license later without having to
track down every past contributor for permission. It does not take your copyright
away: you keep it, and your work stays available to everyone under the
noncommercial license.
