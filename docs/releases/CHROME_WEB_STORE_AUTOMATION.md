# Chrome Web Store Release Automation

> **Implementation status:** PR1 (this change) ships research, the architecture decision, the
> store-listing source of truth, and the validation/diffing tooling — all read-only, no GitHub
> Actions workflow changes, no Chrome Web Store API calls. PR2 adds the release-triggered
> build/package/inspect/checksum pipeline and the approval report. PR3 adds authentication,
> package upload, the owner-approval gate, and post-approval submission/publish. Sections below
> are written for the finished pipeline and each one states which PR it lands in.

See [ADR 0001](adr/0001-release-architecture.md) for the full reasoning behind every decision
summarized here, and [RESEARCH.md](RESEARCH.md) for the underlying API findings and their
sources.

## Architecture

Two independently-triggered GitHub Actions workflows, split exactly at the review-submission
boundary:

```
GitHub Release published
        │
        ▼
┌───────────────────────────────────────────┐
│ Stage A — chrome-web-store-prepare.yml     │   trigger: release (published), not draft/prerelease
│  (PR2 + PR3)                               │
│                                             │
│  validate → build → package → inspect      │
│  → checksum → diff permissions             │
│  → validate listing.yaml → upload to CWS   │   (media.upload — NOT a review submission)
│  → publish Job Summary approval report     │
│  → STOP                                    │
└───────────────────────────────────────────┘
        │
        │   (nothing automated crosses this line)
        │
        ▼  owner reads the approval report, then manually runs Stage B
┌───────────────────────────────────────────┐
│ Stage B — chrome-web-store-submit.yml      │   trigger: workflow_dispatch ONLY
│  (PR3)                                     │
│                                             │
│  verify typed confirmation input matches   │
│  the release tag → call publish            │
│  (publishType: DEFAULT_PUBLISH)            │
└───────────────────────────────────────────┘
        │
        ▼
  Google reviews → auto-publishes on approval (no further manual step)
```

**Why this boundary is real, not just documented:** Stage B is only reachable through
`workflow_dispatch`, which GitHub restricts to users with write access to the repository, is
never triggered by a push/PR/fork, and requires a typed confirmation input matching the release
tag before the job does anything. There is no automated path from "release published" to
"submitted for Google review." See ADR 0001 §2–3 for why this replaces GitHub Environments'
required-reviewers protection rule (Enterprise-Cloud-only for private repos — not available on
this repo's GitHub Pro plan).

**Why metadata sync is mostly absent:** Chrome Web Store API v2 has no endpoint to read or write
listing metadata (name, descriptions, category, screenshots, promotional images, localization).
This isn't a scope decision — there's nothing to call. `docs/chrome-web-store/listing.yaml` is
the validated, version-controlled source of truth for that copy, and the approval report includes
a **repo-vs-previous-repo-release diff** of it (never repo-vs-live-store, which the API can't
support). Every listing field stays a manual Developer Dashboard paste, same as today
(`docs/chrome-web-store/SUBMISSION_GUIDE.md`). See ADR 0001 §4.

## One-Time Setup

_(Consumed starting in PR3, when the upload/publish calls are implemented. Documented now so the
GCP-side setup can happen independently of code review.)_

### Google Cloud

1. Create (or reuse) a Google Cloud project dedicated to this automation.
2. Enable the **Chrome Web Store API** on that project.
3. Create a Google Cloud **service account** (no IAM roles are required on the service account
   itself beyond what's needed for impersonation, below).
4. Create a **Workload Identity Federation pool and provider** trusting GitHub's OIDC issuer
   (`token.actions.githubusercontent.com`), with an **attribute condition restricting the trust to
   this repository** (`assertion.repository == 'mohammed-fandees/hamesh'`) — and, if practical,
   further restricted to the specific workflow file path for Stage B so Stage A's credential
   scope can't be reused to call `publish`.
5. Grant the WIF pool's identity `roles/iam.workloadIdentityUser` on the service account, so
   GitHub Actions can impersonate it.

No JSON key is ever created or downloaded — that's the point of using WIF (ADR 0001 §5).

### Chrome Web Store Developer Dashboard

1. Open the **Account** section of the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Add the service account's email as the linked service account. **A publisher can only link one
   service account** — if one is already linked for another purpose, this pipeline needs to reuse
   it rather than replace it.

### GitHub repository configuration

1. Create a GitHub Environment named `chrome-web-store-production`.
2. Add a **deployment branch policy** restricting it to protected tags/branches (Pro-tier feature,
   confirmed available for this private repo — ADR 0001 §3). Required-reviewers protection is
   **not** available on this plan; do not assume it's configured even though the environment
   exists.
3. Store the secrets/variables below in that environment (not at the repository level), so
   Stage A and Stage B are the only workflows that can read them.

## Secrets and Variables

| Name                             | Kind     | Purpose                                                                   | Where it comes from                               |
| -------------------------------- | -------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Variable | Full resource name of the WIF provider                                    | Output of the WIF provider creation step above    |
| `GCP_SERVICE_ACCOUNT_EMAIL`      | Variable | The impersonated service account's email                                  | Output of the service account creation step above |
| `CHROME_WEB_STORE_ITEM_ID`       | Variable | The published item's id (also recorded informationally in `listing.yaml`) | Developer Dashboard item URL                      |

No long-lived secret (JSON key, OAuth refresh token, client secret) is stored anywhere in this
design — see ADR 0001 §5 for why. If a future change ever needs one, it must go in the
`chrome-web-store-production` environment's secrets, never a repository-level or organization-level
secret, and never referenced from a workflow that also runs on `pull_request` or fork triggers.

**Rotation:** WIF trust is keyless, so there's no credential to rotate on a schedule — rotate by
revoking and recreating the WIF provider/pool binding if compromise is suspected.
**Revocation:** remove the service account's link in the Developer Dashboard, and/or delete the
WIF pool/provider in Google Cloud; either independently cuts off automation access.

## Normal Release Flow

1. Prepare the release: land product changes on `main` through normal reviewed PRs.
2. If the release changes anything user-facing about the listing, update
   `docs/chrome-web-store/listing.yaml` in the same PR (or a follow-up PR) and let CI validate it
   (`pnpm release:validate` — PR1, available today).
3. Bump `package.json` and `wxt.config.ts` versions together, add a `## [X.Y.Z]` section to
   `CHANGELOG.md` (existing convention, unchanged by this pipeline).
4. Merge to `main`.
5. Create a GitHub Release (tag `vMAJOR.MINOR.PATCH`, matching the version bumped in step 3) —
   today via `.github/workflows/release.yml` (tag push or manual dispatch); this workflow is
   unchanged by this pipeline and continues to build the GitHub-hosted zip/checksum/notes.
6. **(PR2)** Publishing that release fires Stage A: validation re-runs, the extension is rebuilt
   for provenance, the zip is inspected (forbidden files, manifest sanity), a checksum is
   computed, permissions are diffed against the previous release, `listing.yaml` is validated, the
   package is uploaded to Chrome Web Store, and a Job Summary approval report is produced.
   **Stage A never calls `publish`.**
7. Owner reads the approval report: version, package checksum/size, permission diff (expansions
   highlighted), listing metadata diff, and confirmation that no review submission has happened
   yet.
8. **(PR3)** Owner manually runs Stage B (`workflow_dispatch`), typing the release tag as the
   required confirmation input.
9. Stage B calls `publish` with `publishType: DEFAULT_PUBLISH` for that version.
10. Google reviews the submission.
11. On approval, Google publishes the update automatically — no further manual step.

## Failure Recovery

_(Fleshed out further as PR2/PR3 add the operations described; the principles are fixed now.)_

- **Invalid release** (draft, prerelease, malformed tag, version mismatch): Stage A's validation
  step fails before any build/upload happens. Fix the release or the repo state and re-publish
  correctly — `pnpm release:validate` (PR1) can be run locally first to catch this before ever
  creating the GitHub Release.
- **Build/package/inspection failure:** Stage A stops; nothing is uploaded. Re-run after fixing
  the underlying issue on `main` and cutting a new release.
- **Upload failure:** Stage A stops; the store item is left in whatever state the last successful
  upload (if any) produced. No submission has happened, so there's nothing to undo.
- **Metadata validation failure:** blocks the whole run before upload — `listing.yaml` must be
  fixed and re-merged.
- **Approval rejected / never granted:** the uploaded-but-unsubmitted revision simply sits in the
  Developer Dashboard. No cleanup is required by the pipeline; the owner can re-run Stage A later
  (e.g. after a new release) to upload a corrected package, or delete the stale draft revision
  manually in the dashboard if desired.
- **Submission failure after approval:** Stage B fails loudly with the exact API error and the
  store item's reported state (`fetchStatus`); the pipeline does not blindly retry non-idempotent
  `publish` calls (`publish`'s idempotency on repeat calls isn't documented — RESEARCH.md §3), so
  a failed Stage B run requires the owner to check `fetchStatus` before manually re-running.
- **Google rejects the review:** surfaces in the Chrome Web Store Developer Dashboard directly;
  outside this pipeline's control. Fix the extension/listing and go through Stage A again with a
  new release.
- **Accidental GitHub Release creation:** deleting the release does **not** retroactively undo
  anything Stage A already did (upload has no "undelete" concept to rely on) — if Stage A already
  ran, treat it the same as "approval never granted": harmless until someone manually runs Stage B.

## Testing

`pnpm test` runs `tests/release/*.test.ts` alongside the rest of the suite — no production Chrome
Web Store API calls are made by any test. Covers tag/version matching, manifest version/permission
extraction, metadata schema validation (including confirmed character limits and URL validation),
permission diffing, dry-run behavior, package path resolution, and package inspection. See
`tooling/release/` for the implementation and [ADR 0001](adr/0001-release-architecture.md) for why
each module is shaped the way it is.

Local dry-run validation (no mutation, works today):

```sh
pnpm release:validate --tag=v0.2.0 --previous-ref=v0.1.0
```
