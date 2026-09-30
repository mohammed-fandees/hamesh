# Hamesh Teams: the extension side

Hamesh Teams lets people share notes with a team. The server that stores team
data is a separate, private service; this document covers only what lives in
this repository: the extension's Teams client and the public wire contract it
speaks (`packages/teams-contract`).

Personal notes are unaffected. They stay in `chrome.storage.local`, are never
uploaded, and work exactly as before whether Teams is on, off, or absent.

## The rule everything follows

**The extension is an untrusted client.** Anyone can read this code, change it,
or call the API without it. So the extension decides nothing that matters:

- It never sends who the user is, which plan they have, what role they hold,
  or what limits apply. The server derives all of that from the session.
- It shows what the server last said, and nothing else. There is no plan,
  price, limit, role check or expiry date written into the extension. If the
  server can't be reached, the UI says so; it does not guess.
- Every server answer is validated against the contract (`strictObject`
  schemas, so unknown fields are refused too). An answer that doesn't match is
  a `bad_response` and is never partly used.

The server enforces every permission on every request. Hiding a button in the
extension is a courtesy, not a control.

## Build configuration

Teams is compiled in only when a build is given both values:

| Variable               | Example                               | Notes                                                     |
| ---------------------- | ------------------------------------- | --------------------------------------------------------- |
| `WXT_TEAMS_API_ORIGIN` | `https://api.example.com`             | A bare origin. `https` only, except `http://localhost`.   |
| `WXT_GOOGLE_CLIENT_ID` | `1234-abc.apps.googleusercontent.com` | A Google OAuth client id. Public by design, not a secret. |

Put them in `.env.local` (ignored by git) or pass them in the environment.
Neither is a secret, and nothing secret belongs in the extension: anything in a
build can be read by anyone who installs it.

- **Neither set:** a local-only build. No Teams UI, no optional permissions,
  and the Teams code is dropped from the bundle (the gate is a build-time
  constant). This is what store builds are today.
- **Both set:** the manifest gains `optional_permissions: ["identity"]` and
  `optional_host_permissions: ["<origin>/*"]` (on Firefox MV2 both go in
  `optional_permissions`), and Settings shows a Teams section.
- **One set, or either malformed:** the build fails. A half-configured Teams
  must never ship.

The manifest additions are made in `wxt.config.ts`'s `build:manifestGenerated`
hook, because WXT loads `.env` files after the config file is evaluated. The
`manifest` literal itself stays static so the release tooling can still read it
without running it.

## Permissions: asked for, never assumed

Both Teams permissions are **optional**. Nothing is granted at install, and a
build with Teams asks for nothing until the user clicks **Turn on Teams** in
Settings. That click requests exactly:

- `identity`, for the Google sign-in window (`identity.launchWebAuthFlow`);
- the one API origin, and no other host.

**Turn off Teams** signs out and gives both permissions back. If the user
removes them from the browser's own extension settings instead, the background
worker sees `permissions.onRemoved` and forgets the session on this device.

## Where things run

```
Hamesh's own pages (notes.html)     Background service worker
───────────────────────────────     ─────────────────────────────────────
TeamsSection  ─ TEAMS ─────────▶    registerTeams()  (src/teams/background.ts)
  requestPermissions()                ├─ sender check: extension pages only
  (needs the click, so it             ├─ TeamsService  (status / signIn / signOut)
   runs in the page)                  ├─ Google sign-in (PKCE, state, nonce)
TeamsView     ─ TEAMS_OP ──────▶    ├─ TeamsApi      (fetch + contract checks)
  teams, members, invitations,        ├─ operation table (operations.ts)
  the plan, shared notes, folders,    ├─ delta sync    (sync.ts)
  comments, mentions                  ├─ realtime      (realtime.ts)
              ─ TEAMS_CACHE ───▶    ├─ session store (IndexedDB, token)
              ◀── TEAMS_EVENT ───    └─ sync state    (IndexedDB, cursor)
                                              │
Content script (any web page)                 │ writes
─────────────────────────────                 ▼
HameshApp ◀─── reads ─────────  storage.local: team notes, filed by page
```

- **The session token lives only in the background worker.** It is kept in
  IndexedDB under the extension's own origin, not in `chrome.storage.local`,
  because content scripts can read `storage.local` and a content script runs
  inside whatever web page it's on. Pages never receive the token: a `TEAMS`
  reply carries the account's status and nothing else.
- **Only Hamesh's own pages may drive Teams.** The worker answers a `TEAMS`
  message only when the sender is this extension and its URL is on the
  extension's own origin. A content script's sender URL is the web page's, so
  a page (or a script injected into one) can't sign the user in or out, or
  read their account.
- **Requests go only to the configured origin**, with `credentials: 'omit'`,
  `cache: 'no-store'`, and `redirect: 'error'` so the bearer token is never
  carried anywhere else. A 401 means the server no longer honours the session,
  so it is forgotten at once.

## Signing in

The authorization-code flow with PKCE, run in the background worker:

1. Make a fresh `code_verifier` (32 random bytes), `state` and `nonce` for this
   attempt.
2. Open Google's consent page through `identity.launchWebAuthFlow`, with the
   redirect URI `identity.getRedirectURL()` (`https://<extension-id>.chromiumapp.org/`
   on Chrome).
3. Accept the redirect only if it comes back to that exact URL with the same
   `state`. Anything else is refused, so a code planted by someone else can't
   sign this browser into their account.
4. Send `{ code, codeVerifier, redirectUri, nonce }` to `POST /v1/auth/google`.
   The server exchanges the code with Google using its client secret, checks
   the ID token (including the `nonce`), and returns a session. The extension
   never says who the user is.

Clicking **Sign in** twice opens one Google window, not two.

For the exchange to succeed, the server has to know each extension build's
redirect URI. An unpacked development build gets a new extension id unless it
is pinned, so its `https://<id>.chromiumapp.org/` must be added to the
server's allowed redirect URIs as well.

## Every request goes through one table

`src/teams/operations.ts` is the whole list of things a page may ask the worker
to do: what each one accepts (a zod schema), the request it becomes, and the
shape its answer must have. An operation that is not in the table cannot be asked
for at all — `src/teams/operation-names.ts` is a plain list of strings, so the
worker can reject a name without loading the table (and so a build without Teams
carries neither).

`api.run` checks the params against that operation's schema in the one place a
request is ever built, so a path or body is only ever made of values that passed
it — whichever caller asked, a page or the worker's own sync. An id reaches a URL
only after matching the ULID pattern, a sync cursor only after matching its own,
so a page cannot steer a request somewhere else by putting a path in an id.

## Shared notes

A team's notes live on the server. This is how they reach a page without the
server ever learning which pages anyone visits.

**The worker pulls; it never asks about a page.** `GET /v1/teams/:id/changes`
answers one question — what changed since this cursor — and the worker files
everything it gets by page, under `hamesh:team-notes:<pageKey>`, exactly the way
personal notes are stored. Matching a note to a page happens on this device.

**Shared notes are in the Library too.** A reader thinks of their notes as
theirs, so the Library lists what this device stored and what its teams have
shared, together, with a chip on the row naming the team and pills for narrowing
to one of them. Sharing therefore leaves a note where it is instead of making it
vanish into another page — the team's copy is read back before the local one
goes, so the row does not blink out of the list in between. A team note in the
Library is read, not managed: its menu opens the team, and the team's own page is
where it is changed.

**The content script only reads.** It opens its own page's shelf in
`chrome.storage.local` and watches it, and that is all: no session, no request,
and no message to the worker, which refuses a content script anyway. A cached
note becomes an ordinary `Note` carrying `team` (`src/domain/note.ts`), so every
marker, anchor resolver and card works on it unchanged — and everything that
writes checks for `team` first. On the page, a shared note is read-only and says
**Shared with <team>**; it is changed from Hamesh's own pages, the only ones
allowed to ask the server.

**Sharing moves a note.** The personal note's own id travels as the idempotency
key, so sharing the same note twice is one share, and the local copy is then
forgotten — the team's copy is what the page shows from then on, and keeping both
would draw the same note twice. Unsharing is the reverse: the server hands the
note back, and it is kept as a personal note again.

**A cursor that is too old** comes back as `410 cursor_expired`. Nothing can be
reconciled from there, so the team's cache is dropped and pulled again from
nothing. Applying a round is only ever upserts and deletes keyed by note id, so
repeating one changes nothing — which is why the notes are written before the
cursor: a worker that dies in between repeats a round rather than skipping one.

**What the account says, the cache follows.** Every answer to `GET /v1/me`
rewrites the team names a page shows and drops the cache of any team the server no
longer lists. Signing out, or turning Teams off, leaves nothing behind: every
cached team note on the device goes.

## How it is laid out, and why

Teams follows the rest of the library rather than sitting beside it.

- **Notes first.** A team page opens on what the team has: its folders in a rail
  on one side, its notes on the other. Who is in the team, and the handful of
  things that end one, are folded away in panels until they are wanted.
- **The account's half is in Settings.** Joining a team and paying for one are
  not about any one team, and Settings already holds the account — signing in,
  signing out, turning Teams off. So they live there.
- **Being named is a destination.** It is the one thing in Teams addressed to a
  person rather than to a team, and it can come from any of them, so Mentions is
  its own entry in the rail with a dot when there is something new — the same
  shape What's New already has. What the dot compares against is kept on this
  device (`Preferences.teams.lastSeenMentionId`); the server is never told what
  anyone has read.

### Four patterns the page follows

- **A question is asked where the thing is.** Deleting a note for everyone,
  removing someone, handing a team over: the row itself asks, with the cautious
  answer focused and Escape backing out (`InlineConfirm`). Hamesh confirms in
  place everywhere else, and `window.confirm` — which Teams used in eight places
  — is a box in the browser's language, not the reader's, over a page that
  cannot say any more about what is about to happen.
- **Only the row that is acting says so.** `useTeams` tracks work and failure
  under a key the caller passes, so pressing Remove on one member does not grey
  out the invite form, the folder rail and the payment button. Several rows can
  be working at once, and each finishes on its own.
- **A refusal is shown beside what was refused**, not at the top of the page.
  The page-level line is kept for what the page itself failed at.
- **Nothing there yet is a state, not a grey line.** Empty states carry the
  margin mark, say what to do, and offer the control that does it; what is still
  loading is a skeleton, as in the Library.

## Comments and mentions

A discussion belongs to a team note, and is read and written where the note is
managed — the Teams page — never on the web page the note is attached to. The
worker answers Teams messages only from the extension's own pages, and a content
script runs inside whatever page it is on, so there is no way to reach a comment
from there, and no exception is made to let one.

**A mention is an id, never a name.** A body carries `<@USERID>` and nothing
else. Names are resolved when a comment is drawn, from the team's own member
list, so renaming yourself renames you in every comment you were ever named in,
and no comment can carry a name the server did not vouch for. The composer only
ever offers people the server listed as members of that team.

**What a comment declares is derived from what it says.** The `mentions` sent
alongside a body come from the body itself (`mentionsIn`), never from a separate
list the UI kept — and the operation table refuses a comment whose declared
mentions are not exactly the tokens its text contains, before the server refuses
it too. Nobody can be notified out of a comment that never named them.

The tokens themselves live in `packages/teams-contract/mentions.ts`, which
carries no schemas, so reading and writing them costs a client nothing but a
regular expression.

**Where you were named** (`GET /v1/me/mentions`) is the one place in Teams the
extension asks about the account rather than about a team, because only the
server sees every team at once. The ids in those entries are read by asking each
team it lists for its members — the same request that team's own page makes.

## Realtime: a poke, never the content

`POST /v1/realtime/tickets` returns a single-use, short-lived ticket and the
`wss://` URL to open. The client checks that URL against its own configured API
origin — same host, the matching scheme, an `/v1/` path — before connecting to
it: the server says where, but it does not get to say somewhere else.

A frame carries only a sequence number or an id, never note text, a name, an
email or a URL, and every frame is parsed against the contract's own schema;
anything else is ignored rather than guessed at. `changed` means "pull", and the
pull goes through the ordinary authorized API — so a socket that lingers for a
moment after someone's access ends cannot show them anything.

`comments` names one note, and the worker passes it on to Hamesh's own pages as
a `TEAMS_EVENT` — the only message that travels worker → page, carrying the two
ids and nothing else. A page showing that note's discussion reads it again
through the ordinary path; a page showing anything else ignores it.
`runtime.sendMessage` reaches the extension's own pages and never a content
script, and it rejects when no page is open, which is the ordinary case.

The socket is a convenience, never the source of truth. The server ends each
connection's authorization lease on a timer (`revoked: expired`), which is a
reconnection with a fresh ticket rather than a refusal; any other reason stops
the link and sends the worker back to `GET /v1/me` to find out what is true now.
An MV3 service worker the browser shut down has no socket at all, so the worker
pulls on a five-minute alarm as well: a missed poke is a delay, not a note nobody
ever sees.

## Trying it against a server on this machine

Signing in needs Google, and Google needs a redirect URI registered for this
exact build — which an unpacked build changes every time it is loaded. That is a
lot of ceremony for trying a feature against `wrangler dev`, so there is a way to
hand the worker a session the **local** server already issued:

1. In the API repo, with `wrangler dev` running: `pnpm dev:session`. It writes a
   session row into the local D1 file — the same row a sign-in would have
   written, with the same token shape and the same HMAC — and prints the token.
   It is not an endpoint and adds no route: the Worker's code is untouched, so
   there is nothing here that could exist in production.
2. Build the extension with `pnpm build:local` (or `pnpm dev:local`), pointing
   `WXT_TEAMS_API_ORIGIN` at `http://localhost:8787`.
3. Settings → Teams, turn Teams on as usual, then paste the token into **Sign in
   with a local token**.

It is not a way past authentication. The token has to be one the server itself
issued; the worker stores it exactly as it stores a Google sign-in's, and the
server checks it on every request afterwards — a made-up one is refused with a
401 the first time it is used, and the session is dropped.

`--mode dev` is the only switch. It is a build constant, not an environment
variable (`__HAMESH_DEV_SIGN_IN__`, defined in `wxt.config.ts`), because a key
added to `import.meta.env` is read at runtime rather than folded — which would
leave the code behind it in every build. Folded, a normal build carries no trace:
not the component, not its wording, not the message name, and not the worker's
handler for it, which is what actually refuses the message. WXT's own dev server
runs in mode `development`, so `pnpm dev` does not turn it on by accident.

## The contract package

`packages/teams-contract` is the wire contract: request and response schemas,
error codes, and realtime message shapes. It is public on purpose. It describes
what crosses the wire and nothing about how the server stores or decides
anything (see its README for what may and may not go in it). The extension
imports it for types and for validating answers.

## Tests

`tests/teams/` covers the client in isolation: config validation, the session
store (against `fake-indexeddb`), the API client's contract checks and 401
handling, PKCE (RFC 7636 test vector), state and redirect checking, the service's
states, the sender check, the operation table (including the ids and cursors it
refuses), the page cache, delta sync (including an expired cursor and a repeated
round), the realtime link (including the URLs it will not connect to), and how the
cache follows the account, and how the mention tokens are read and written.
`tests/ui/` covers the Settings section — including that the permission prompt is
requested synchronously from the click — the Teams page, the account's half of it
in Settings, sharing a note, the shared-notes panel, a note's discussion, writing
a comment and naming someone in it, where you were named, the inline
confirmation (including that nothing happens until it is answered), that work and
failure are reported per row rather than per page, and which notes the Library's
filter keeps.
`tests/content/HameshApp.team-notes.test.tsx` covers what a team note looks like
on the page it belongs to.

## Builds without Teams carry none of it

Measured, not assumed — a store build of this work against the same build of
`main`, both with no Teams configuration at all:

| Entry                |   main |    now |     Δ |
| -------------------- | -----: | -----: | ----: |
| `background.js`      |  12.43 |  12.43 |     0 |
| `chunks/notes-*.js`  |  57.51 |  58.03 | +0.52 |
| `assets/notes-*.css` |  17.15 |  17.15 |     0 |
| `content.js`         | 319.22 | 319.59 | +0.37 |
| whole build          | 704.58 | 705.38 | +0.80 |

(kilobytes.) The redesign touches shared components — the note row, the actions
menu, the rail — so it is the change most able to leak, and the residue is 0.8 kB
of markup that never renders. Two earlier rounds of measuring had already found
three things shipping regardless, all fixed:

- **A stylesheet is not tree-shaken.** `import './teams.css'` is collected while
  the bundler transforms modules, not by the tree-shaker, so every Teams rule
  shipped even though every component that used them was dropped. Read as a
  string instead (`import css from './teams.css?inline'`, applied behind the
  build constant — see `src/ui/teams/styles.ts`), it is an ordinary value, and an
  unused value is dropped like any other.
- **A runtime guard is not a build-time one.** The account row in Settings was
  gated on `{teams && …}`, and the rail's Teams entry on `{showTeams && …}` —
  both only ever false at runtime, so their markup shipped too. Each tests the
  constant first now, which is what the notes chunk being 2.3 kB below where it
  started comes from.

What is left in a store build is the scaffolding that makes the optional part
optional: a context with nothing in it, an unset prop, a chip that never renders,
and the one check that a note does not belong to a team. No contract, no zod, no
endpoint, no cache key, no CSS rule and no Teams wording anywhere in it.

Every Teams entry point tests `import.meta.env.WXT_TEAMS_API_ORIGIN` as the first
thing in its own body, so the bundler folds the branch away and drops everything
it reached. Measure the same way, and read the exit code before the sizes: WXT
leaves a previous `.output` in place when a build fails, so a failed build
measures the one before it.

## What comes next

This is the whole extension client: configuration, permissions, sign-in, teams,
members, invitations, the plan, shared notes, folders, comments, mentions and
realtime. What remains is the end-to-end audit across both sides.

Deliberately left out, and worth saying plainly:

- An in-page marker that looks different for a shared note. That is a decision
  for the design system, not for this code.
- Any state of a reader's own on a team note — pinning one, or filing it into one
  of their personal folders. Both would need local state about something that
  lives on the server, and neither is described by the wire.
- A comment count on the in-page card. The sync stream carries notes and folders,
  not discussions, so the client has no honest way to show one without asking the
  server about the page being read — which is the one thing the design will not
  do.
