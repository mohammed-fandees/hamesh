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
  the plan, shared notes, folders     ├─ delta sync    (sync.ts)
              ─ TEAMS_CACHE ───▶    ├─ realtime      (realtime.ts)
                                      ├─ session store (IndexedDB, token)
                                      └─ sync state    (IndexedDB, cursor)
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

The socket is a convenience, never the source of truth. The server ends each
connection's authorization lease on a timer (`revoked: expired`), which is a
reconnection with a fresh ticket rather than a refusal; any other reason stops
the link and sends the worker back to `GET /v1/me` to find out what is true now.
An MV3 service worker the browser shut down has no socket at all, so the worker
pulls on a five-minute alarm as well: a missed poke is a delay, not a note nobody
ever sees.

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
cache follows the account. `tests/ui/` covers the Settings section — including
that the permission prompt is requested synchronously from the click — the Teams
page, sharing a note, and the shared-notes panel.
`tests/content/HameshApp.team-notes.test.tsx` covers what a team note looks like
on the page it belongs to.

## Builds without Teams carry none of it

Measured, not assumed — a store build of this work against the same build of
`main`, both with no Teams configuration at all:

| Entry               |     main | with shared notes |     Δ |
| ------------------- | -------: | ----------------: | ----: |
| `background.js`     | 12.43 kB |          12.43 kB |     0 |
| `chunks/notes-*.js` | 60.31 kB |          60.60 kB | +0.29 |
| `content.js`        | 318.5 kB |          319.2 kB | +0.72 |

No contract, no zod, no endpoint, no cache key and no Teams wording anywhere in
it. What is left is the scaffolding that makes the optional part optional: a
context with nothing in it, an unset prop, and the one check that a note does not
belong to a team. Every Teams entry point tests
`import.meta.env.WXT_TEAMS_API_ORIGIN` as the first thing in its own body, so the
bundler folds the branch away and drops everything it reached.

Measure it the same way, and read the exit code before the sizes: WXT leaves a
previous `.output` in place when a build fails, so a failed build measures the one
before it.

## What comes next

Comments and mentions (`packages/teams-contract/comments.ts` already describes
them) are the last part of the client, and the socket already carries their poke.
Two things are deliberately left out of shared notes for now: an in-page marker
that looks different for a shared note, which belongs to the design system rather
than to this code, and any state of a reader's own on a team note — pinning one,
or filing it into one of their personal folders.
