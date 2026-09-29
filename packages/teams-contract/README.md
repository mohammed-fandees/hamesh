# @hamesh/teams-contract

The **wire contract** between the Hamesh extension and the Hamesh Teams API:
the shape of every request and response, the error codes, and the realtime
messages. Nothing else.

It is public on purpose. Everything the extension sends and receives is
visible to anyone who reads the extension or watches its traffic, so writing
it down here hides nothing — and the API never relies on a client following
it. The server validates every request against these schemas and rejects
anything else, including fields it does not expect.

## What belongs here

- Request and response shapes, error codes, realtime message types.
- Input length limits, so the extension can validate before sending. The
  server enforces them again regardless.

## What never belongs here

- Anything about how the server stores or decides things: no table or column
  names, no SQL, no internal sequence numbers (sync cursors are opaque
  strings), no authorization rules beyond the capability names the server
  already returns to clients.
- Prices or plan limits as constants. They are data, served by `GET /v1/plans`
  and `GET /v1/me`, so they can change without a release.
- Secrets of any kind.

## How the extension uses it

The extension imports **types only** (`import type`), so zod — and the schemas
themselves — never reach the extension bundle. The server imports the schemas
and validates with them.
