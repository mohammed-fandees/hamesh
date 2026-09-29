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
Settings page (notes.html)          Background service worker
──────────────────────────          ─────────────────────────────────────
TeamsSection  ── TEAMS message ──▶  registerTeams()  (src/teams/background.ts)
  requestPermissions()                ├─ sender check: extension pages only
  (needs the click, so it             ├─ TeamsService   (status / signIn / signOut)
   runs in the page)                  ├─ Google sign-in (PKCE, state, nonce)
                                      ├─ TeamsApi       (fetch + contract checks)
                                      └─ session store  (IndexedDB, token)
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

## The contract package

`packages/teams-contract` is the wire contract: request and response schemas,
error codes, and realtime message shapes. It is public on purpose. It describes
what crosses the wire and nothing about how the server stores or decides
anything (see its README for what may and may not go in it). The extension
imports it for types and for validating answers.

## Tests

`tests/teams/` covers the client in isolation: config validation, the session
store (against `fake-indexeddb`), the API client's contract checks and 401
handling, PKCE (RFC 7636 test vector), state and redirect checking, the
service's states, and the sender check. `tests/ui/TeamsSection.test.tsx` covers
the Settings section, including that the permission prompt is requested
synchronously from the click.

## What comes next

This is the foundation: configuration, permissions, sign-in and the account
summary. Team management, shared notes and folders, comments, and realtime
build on it and follow the same rules.
