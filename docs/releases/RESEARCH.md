# Chrome Web Store & GitHub Actions — API Research Snapshot

> **This is a point-in-time snapshot, not a live reference.** Recorded 2026-07-10 while designing the release
> automation pipeline (see [`adr/0001-release-architecture.md`](adr/0001-release-architecture.md)). Google and
> GitHub both revise these APIs and plan limits without much notice. **Re-verify every claim below against the
> official docs before relying on it in PR3's implementation** — do not treat this file as authoritative at
> execution time, only as a record of what was true when the architecture was decided and why it was decided
> that way.

## 1. Chrome Web Store API version

- **v1 is deprecated and supported only until 2026-10-15.** After that date, v1 requests stop working. Building
  new automation against v1 today would be building against a shutting-down API — v2 is the only viable target.
- **v2 base URL:** `https://chromewebstore.googleapis.com/v2`.
- **v2 discovery document** (authoritative machine-readable schema, fetched directly and treated as ground
  truth over prose docs): `https://chromewebstore.googleapis.com/$discovery/rest?version=v2`.

Sources: [Chrome Web Store API v1 reference](https://developer.chrome.com/docs/webstore/api/v1),
[Introducing a new Chrome Web Store API](https://developer.chrome.com/blog/cws-api-v2).

## 2. v2 API surface — confirmed via the discovery document

The entire v2 API surface, per the discovery document fetched directly, is:

| Method                                          | HTTP             | Path                                      | Purpose                                                       |
| ----------------------------------------------- | ---------------- | ----------------------------------------- | ------------------------------------------------------------- |
| `media.upload`                                  | POST (multipart) | `v2/{+name}:upload`                       | Upload a package (zip/crx) for an **existing** item. Max 2GB. |
| `publishers.items.publish`                      | POST             | `v2/{+name}:publish`                      | Submit the uploaded revision for review / publish.            |
| `publishers.items.fetchStatus`                  | GET              | `v2/{+name}:fetchStatus`                  | Poll upload/review/publish state.                             |
| `publishers.items.cancelSubmission`             | POST             | `v2/{+name}:cancelSubmission`             | Cancel a pending review submission.                           |
| `publishers.items.setPublishedDeployPercentage` | POST             | `v2/{+name}:setPublishedDeployPercentage` | Adjust staged-rollout percentage without a new review.        |

**There is no `get`, `list`, `patch`, or `update` method on `publishers.items`, and no method anywhere in v2
that reads or writes listing metadata** (name, description, category, screenshots, promotional images,
localization, support/homepage/privacy URLs). This was cross-checked three ways: the discovery document itself,
the official "Use the Chrome Web Store API" guide (which states listing metadata must be filled in via the
Developer Dashboard before an item can be published through the API), and the official v2 launch blog post
(which lists what's new — status polling, cancel-submission, staged rollout, service-account auth — and does
**not** list metadata management as a new or existing capability). The blog post additionally states v2 **does
not support creating new items** and **no longer supports changing item visibility** via API, both dashboard-only
by design.

**This is not new in v2 — the Chrome Web Store API has never exposed listing-metadata read/write.** It is a
long-standing, frequently-requested gap (see public Issue Tracker threads on this exact limitation), not an
oversight in this research.

Sources: [`publishers.items.publish` reference](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish),
[Use the Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api),
[Introducing a new Chrome Web Store API](https://developer.chrome.com/blog/cws-api-v2),
discovery doc at `chromewebstore.googleapis.com/$discovery/rest?version=v2`.

**Architectural consequence:** "synchronize supported metadata" in the desired lifecycle has an empty supported
set today. Every listing field is manual-dashboard-only. See ADR §4.

## 3. `publish` method semantics

Request (`PublishItemRequest`):

```json
{
  "publishType": "DEFAULT_PUBLISH" | "STAGED_PUBLISH",
  "skipReview": false,
  "blockOnWarnings": false,
  "deployInfos": [{ "deployPercentage": 100 }]
}
```

- **`publishType: DEFAULT_PUBLISH`** (the default if omitted) — item publishes automatically once Google's
  review passes. This is what the desired lifecycle needs ("after Google approves the update, publish it
  automatically to users") and is used for this pipeline.
- **`publishType: STAGED_PUBLISH`** — after review passes, the item is held in a stageable state and a
  _further_ API call (or dashboard action) is required to actually publish. Explicitly **not** used here — the
  owner does not want a second manual gate after Google's review.
- `blockOnWarnings: true` is worth setting so non-fatal validation warnings surface as a hard failure rather
  than silently proceeding (decide the exact posture in PR3; default is `false`/ignore-and-report).
- Idempotency of a second `publish` call against an already-submitted/published item is **not documented** —
  treat it as unsafe to blindly retry (see ADR §6, Failure Safety).

Source: [`publishers.items.publish` reference](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish).

## 4. Authentication

- **OAuth 2.0 access token, scope `https://www.googleapis.com/auth/chromewebstore`, is the only credential CWS
  API v2 accepts.** How that access token is minted is where the choice lives.
- **v2 adds official service-account support.** A Google Cloud service account's email is linked once in the
  Developer Dashboard ("Account" section). **Limitation: a publisher can link exactly one service account.**
- CWS's own docs illustrate minting the access token two ways: `gcloud auth print-access-token --impersonate-service-account=... --scopes=...` (interactive/local), or exchanging a downloaded JSON key via a hand-rolled JWT flow (their documented CI/CD path) — both are effectively "long-lived credential materializes into a short-lived token."
- **Neither CWS-specific doc mentions Workload Identity Federation (WIF)**, but WIF is a generic GCP
  capability, independent of which API is being called: `google-github-actions/auth` (Google's own official
  GitHub Action) supports `token_format: access_token` with a custom `access_token_scopes` list, which mints a
  short-lived OAuth access token for an _impersonated_ service account via GitHub's OIDC identity — no JSON key
  material ever exists, on disk or in a GitHub secret. Confirmed current and documented behavior of
  `google-github-actions/auth`.
- **Chosen approach: WIF + service-account impersonation**, scoped to `https://www.googleapis.com/auth/chromewebstore`.
  This is strictly better than the JSON-key path CWS's own doc walks through: no long-lived secret to store,
  rotate, or leak; GCP-side conditions can restrict the trust to this exact repository (and even exact
  ref/workflow) via the WIF provider's attribute condition. See ADR §5.

Sources: [Use a service account with the Chrome Web Store API](https://developer.chrome.com/docs/webstore/service-accounts),
[`google-github-actions/auth`](https://github.com/google-github-actions/auth),
[Enabling keyless authentication from GitHub Actions (Google Cloud blog)](https://cloud.google.com/blog/products/identity-security/enabling-keyless-authentication-from-github-actions).

## 5. GitHub Environments — required reviewers plan limits

This is the finding that most changed the approval-gate design.

- **Deployment protection rule "required reviewers"**: on GitHub Free, Pro, and Team, this is **only available
  for public repositories**. For private/internal repositories it requires **GitHub Enterprise Cloud**.
- **"Wait timer"** deployment protection rule: same restriction — Enterprise Cloud only for private repos.
- **"Deployment branch policies"** (restrict which branches/tags may deploy to an environment): available on
  **Pro, Team, and Enterprise Cloud** for private repos — this one _is_ usable.
- **Environments themselves, and environment secrets**, are available on Pro/Team/Enterprise for private repos
  — only the _reviewer/wait-timer protection rules_ are Enterprise-gated.
- Hamesh's repo is private, on GitHub Pro (via GitHub Education). **Required reviewers is not available to
  this repo today.** A separate, newer "required reviewer rule" (repository-ruleset based, GA'd 2026-02-17) was
  investigated as a possible alternative — it governs required approvals on **branch/tag rulesets for merges**
  (e.g. requiring a review before a PR can merge, with path-pattern scoping), not on gating a specific Actions
  workflow run. It doesn't apply here.

**Architectural consequence:** the approval gate cannot use Environment required-reviewers as designed unless
the repo moves to Enterprise Cloud. See ADR §3 for the chosen alternative (manual `workflow_dispatch` with a
typed confirmation input, scoped by a deployment-branch-policy-protected environment).

Sources: [Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments),
[Required reviewer rule is now generally available](https://github.blog/changelog/2026-02-17-required-reviewer-rule-is-now-generally-available/).

## 6. `release` webhook event activity types

- `published` fires for **any** release becoming publicly visible, including prereleases published directly
  (not via draft→prerelease transition nuances). `released` and `prereleased` are narrower, partially-overlapping
  activity types with edge cases around draft transitions that aren't worth relying on for a security boundary.
- **Decision:** trigger Stage A on `release: { types: [published] }`, then explicitly assert
  `!github.event.release.draft && !github.event.release.prerelease` as an early, visible validation step in the
  job — rather than depending on trigger-level filtering to encode that rule. This keeps the "reject prereleases"
  requirement testable and visible in the job summary instead of being an implicit consequence of which event
  type was chosen.
- `gh release create` (used by the existing `.github/workflows/release.yml`) without `--draft` fires the same
  `published` event as creating a release through the web UI — confirmed standard, documented GitHub Actions
  behavior.

Source: [Events that trigger workflows — release](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).

## 7. Store listing field limits (confirmed subset)

| Field                                                      | Limit                                | Confirmed?                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extension `name` (manifest.json, also the dashboard title) | 75 characters                        | Yes — official, "universal limit" per Chromium extensions announcement                                                                                                                                                                      |
| Summary / short description                                | 132 characters, plain text only      | Yes — official listing-requirements docs                                                                                                                                                                                                    |
| Detailed description                                       | No confirmed official hard cap found | **No.** Commonly cited community figures exist but were not found in current official docs. Treated as **soft/advisory only** in the validator — see ADR §4 and `metadata-schema.ts`. Re-check the live dashboard field at submission time. |
| Screenshots                                                | 1280×800 or 640×400, 1–5 images      | Yes                                                                                                                                                                                                                                         |
| Small promotional tile                                     | 440×280                              | Yes (commonly required)                                                                                                                                                                                                                     |
| Marquee promotional image                                  | 1400×560                             | Yes (optional, featured placement only)                                                                                                                                                                                                     |

This table matches what `docs/chrome-web-store/README.md`'s own sourcing table already recorded during the
original (v0.1.0-era) submission-prep pass — re-confirmed independently here, not taken on trust from that file.
