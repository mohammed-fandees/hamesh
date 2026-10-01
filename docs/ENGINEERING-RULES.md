# Engineering rules

The rules every change to Hamesh follows. Each one is here because breaking it
cost us a bug, a leak or a redo. A PR that breaks a rule says so, and why, in
its description.

Read with: [architecture.md](architecture.md), [DESIGN-AND-LAYOUT.md](DESIGN-AND-LAYOUT.md),
[teams-client.md](teams-client.md), [RELEASING.md](RELEASING.md), [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## 1. Two builds, one source

Hamesh ships two builds from this repo: the **store build** (no Teams) and the
**Teams build** (`WXT_TEAMS_API_ORIGIN` set).

- **Gate Teams with the build constant**, `import.meta.env.WXT_TEAMS_API_ORIGIN`,
  as the first thing in the branch it guards, so the bundler removes the whole
  branch from the store build. Never gate on a runtime value alone.
- **Teams styles are imported `?inline`** and applied by the component that
  needs them (`<style>{css}</style>`, or `teams/styles.ts` on Hamesh's own
  pages). A plain `import './x.css'` survives tree-shaking and ships anyway.
- **Teams permissions and manifest keys** (`sidePanel`, `side_panel`, the API
  origin) are added only in `wxt.config.ts`'s Teams branch.
- **Check for leaks before every PR that touches Teams.** Move `.env` and
  `.env.local` aside, run `npx wxt build`, and confirm:
  - the manifest's permissions are still `storage, activeTab, favicon, alarms`;
  - `grep -r` in `.output/` finds none of the new Teams class names, strings or ops;
  - then put the env files back and rebuild the Teams build.

## 2. Where code may live

- **The premium backend and Teams internals live in the private
  `hamesh-api` repo**, never here. This repo holds the client and the shared
  contract (`packages/teams-contract`) only.
- **No secret, account number or payment detail in this repo** — not in code,
  tests, docs or fixtures. Payment instructions come from the server.
- `hamesh-api` pins the contract to a **merged** commit of `main` here; re-pin
  after the contract changes, never to a branch.

## 3. The content script runs inside someone else's page

- **It never holds the session.** The worker answers it only through the narrow
  `TEAMS_PAGE` channel (`src/teams/page-channel.ts`). Every op:
  - validates its input by hand (ULIDs, lengths);
  - checks that the sender is this extension's content script, in a top frame;
  - acts only on a note the worker holds for the page the browser reports;
  - and lets the server decide.
- A new op needs a validator case, a handler case, and tests for both the
  allowed and the refused path.
- **Never send the page a third-party URL to load.** A picture is fetched by the
  worker and handed over as a `data:` URL (`people-cache.ts`). No emails reach
  the content script.
- **Content-script modules stay zod-free and contract-free.** They ship in every
  build; parse stored values by hand, as `page-cache.ts` does.

## 4. Shadow DOM rules

Everything Hamesh draws on a page lives in a shadow root.

- **Outside-click and focus logic reads `event.composedPath()`**, never
  `event.target`. A document listener sees every press inside the shadow root
  as a press on its host. Our menus closed before their items could be clicked
  because of this.
- **Only `tokens.css` is in the shadow root.** Any other rule a component needs
  over a page comes with it. Rules that must not leak into Hamesh's own pages
  start with `:host` (see `note-menu.css`).
- The scope's `pointer-events` is `none`; anything clickable sets `auto`.
- Clicks on Hamesh UI must be recognised by `isOnHameshUi` (`HameshApp.tsx`) —
  add any new floating surface (a portaled menu, a dialog) to it.

## 5. Design

- **An approved canvas is built as drawn.** Every element in a canvas frame is
  present: buttons, menus, counts, chips, empty states, footers. Reuse logic,
  not looks. If a component's existing look differs, add a variant. Before
  calling it done, screenshot it beside the frame. Anything left out is named
  in the PR, never dropped silently.
- **Tokens only.** Colours, spacing, radii, shadows and motion come from
  `tokens.css`; `font-size` is always a `--hm-text-*` token
  (`tests/ui/tokens.test.ts` enforces it). Add any new stylesheet to that
  test's `SHEETS`.
- **Light and dark, Arabic and English.** Every surface is checked in RTL and
  LTR, and in both themes. Use logical properties (`inset-inline-start`,
  `border-start-end-radius`). A glyph that points along the line of reading uses
  `hm-mirror`.
- **People are told apart.** An `Avatar` gets `seed={userId}` wherever the id is
  known, so its monogram takes that person's tone.

## 6. Words

- Every string exists in **English and Arabic**: `src/ui/i18n.ts` for the core
  extension, `src/ui/teams/strings.ts` for Teams. Never hard-code text in a
  component.
- Arabic is written as it is spoken in a UI, not translated word for word.
  Counts take the right form (`منذ ساعتين`, `3 أيام`, `11 يومًا` — see
  `format.ts`).
- Strings a store build needs live in `i18n.ts`, even when Teams uses them too.

## 7. Data and schemas

- **New metadata goes in a nested object**, never as new flat fields on `Note` or
  `Preferences`.
- **A server migration ships with its rollback** (`migrations/rollback/`). After
  switching to a branch with a new migration, run `pnpm db:migrate:local`.
  A `500` on an endpoint that reads a new column almost always means this
  was skipped.
- A delete answers with no body (`undefined`). Never test a mutation's success
  with `!== null` against a fake that returns `null`.

## 8. State and effects (React)

- No `setState` synchronously in an effect (`react-hooks/set-state-in-effect`).
  Await inside the effect, or move the update into a callback or animation frame.
- An effect that subscribes returns its unsubscribe. Storage watches
  (`watchPageNotes`, `watchPeople`) are how one surface learns another changed
  something. Don't rely on a single read.
- When a note moves (shared to a team), every surface drops its old copy at
  once. A note is never drawn twice.

## 9. Tests

- Every behaviour change carries a test that fails without it. That includes
  bugs: reproduce first, then fix.
- UI tests use roles and accessible names, scoped with `within()` when a name
  repeats.
- A fake of an API answers the way the real one does.
- Teams paths in vitest set the gate with `vi.stubEnv('WXT_TEAMS_API_ORIGIN', …)`.
- E2E browser profiles go in the OS temp dir and must be deleted after each test
  (the existing specs don't yet — hundreds of them once filled the disk).
- Scratch specs used for screenshots (`e2e/zz-*.spec.ts`) are deleted before
  committing.

## 10. Before every PR

1. `npx prettier --check .`, `npx tsc --noEmit -p .`, `npx eslint .`, `npx vitest run`.
2. The store-build leak check (§1), if Teams was touched.
3. Screenshots of every changed surface: RTL and LTR, light and dark.
4. **Stage files by name.** Never `git add -A` or `commit -a`: other work may
   be sitting in the tree.
5. The PR description lists:
   - what changed;
   - how it was checked;
   - what was **not** checked (for example, "not tried against a real signed-in session").

## 11. Releases

See [RELEASING.md](RELEASING.md). In short:

- bump `package.json` and `wxt.config.ts` together;
- add a dated `CHANGELOG.md` section for this repo's maintainers;
- add a `release-notes.ts` entry for users, in both languages, with no file
  names or root causes;
- tag `vX.Y.Z` from `main`.

**Versioning:**

- **MINOR** for features a store user gets.
- **PATCH** for fixes.
- **MAJOR** when what a store user gets changes in kind — for Hamesh, the day
  Teams is in the store build. It needs its store privacy disclosure and the
  release workflow's Teams variables.
