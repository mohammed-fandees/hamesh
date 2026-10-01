# Hamesh — notes for AI agents

Before any change, read [docs/ENGINEERING-RULES.md](docs/ENGINEERING-RULES.md) and follow it.
It is the framework every task here follows. The non-negotiables:

- **Two builds.**
  - Gate Teams with `import.meta.env.WXT_TEAMS_API_ORIGIN`.
  - Import Teams CSS `?inline`.
  - Run the store-build leak check before any Teams PR.
- **Private repo boundary.** Backend and Teams server code belong in the private `hamesh-api` repo.
  No secrets or payment details here.
- **The content script runs in a stranger's page.**
  - It never gets the session; it only uses the `TEAMS_PAGE` channel.
  - It is never handed a third-party URL to load.
  - Inside the shadow root, use `composedPath()`, not `target`.
- **Approved canvas = build it as drawn.** Use tokens only. Check RTL + LTR, light + dark, Arabic
  - English.
- **Tests.**
  - Every change gets a test that fails without it.
  - Fakes answer like the real API.
  - Delete scratch `e2e/zz-*` specs.
- **Commits and PRs.**
  - Stage files by name.
  - PRs say what was and wasn't verified.
- **Talking to the owner.** Reply in Arabic.
