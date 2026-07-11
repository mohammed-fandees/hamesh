# ADR 0001: Chrome Web Store release automation architecture

- **Status:** Accepted
- **Date:** 2026-07-10
- **Supersedes:** nothing — this is the first release-automation ADR. Prior to this, Chrome Web Store
  submission was entirely manual (`docs/chrome-web-store/SUBMISSION_GUIDE.md`), and `.github/workflows/release.yml`
  only produces a GitHub Release (zip + checksum + notes), never touching the Chrome Web Store.
- **Research backing this decision:** [`RESEARCH.md`](../RESEARCH.md).

## 1. Context

The owner wants: GitHub Release → validate → build → package → inspect → sync store metadata where supported →
upload to Chrome Web Store → **stop** → owner reviews a concrete summary → owner approves → submit for Google
review → Google approves → publish automatically. Exactly one manual gate, positioned _before_ submission to
Google, not after.

Two things discovered during research make the naive reading of that lifecycle unbuildable as literally
described, and both are resolved below rather than silently worked around:

1. **Chrome Web Store API v2 has no metadata read or write endpoint at all** (`RESEARCH.md` §2). "Synchronize
   supported metadata" therefore has an empty supported set — there is nothing to automate here today.
2. **GitHub Environments' "required reviewers" protection rule is Enterprise-Cloud-only for private
   repositories** (`RESEARCH.md` §5). Hamesh is a private repo on GitHub Pro. The prompt's preferred mechanism
   isn't available to this repo.

## 2. Decision: two workflows, split at the review-submission boundary

**Stage A — `chrome-web-store-prepare.yml`** (new, PR2). Trigger: `release: { types: [published] }`, with an
explicit in-job assertion rejecting drafts and prereleases (not relying on trigger-type filtering alone —
`RESEARCH.md` §6). Responsibilities: validate the release against the repo (version consistency, manifest,
metadata schema), build, package, inspect the zip, compute the checksum, diff permissions against the previous
release, upload the package to Chrome Web Store (`media.upload` — this is _not_ a review submission, it only
attaches a new revision to the item in draft form), and publish a Job Summary approval report. **It never calls
`publish`.** It stops there, unconditionally.

**Stage B — `chrome-web-store-submit.yml`** (new, PR3). Trigger: `workflow_dispatch` **only**, with a required
text input the operator must type by hand (the exact release tag, e.g. `v0.3.0`) that the job verifies matches
before doing anything else. Responsibility: call `publish` with `publishType: DEFAULT_PUBLISH` for that
version. Nothing else.

This satisfies "the approval boundary must be technically enforced, not merely documented": the credential
scope that can call `publish` is not reachable from any trigger except a deliberate, authenticated,
write-permission-gated manual action. There is no code path from "release published" to "submitted for review"
that doesn't pass through a human manually starting Stage B.

### Why not a single workflow with a `wait` step or a job-level manual gate?

A single workflow can't stop and resume later without a review; it would need to run continuously (impossible,
runners are ephemeral) or use a wait-for-approval action, which reduces to the same environment-protection
mechanism discussed below and rejected. Two independently-triggered workflows is the simplest thing that
actually enforces the boundary at the trigger level, not inside job logic.

## 3. Decision: the approval gate is manual `workflow_dispatch` + typed confirmation, not Environment required-reviewers

The prompt asked to strongly consider GitHub Environments with required reviewers. Investigated and rejected
for this repo, for a documented reason, not preference:

- Environments and environment secrets: available on GitHub Pro for private repos. Usable.
- The **required-reviewers protection rule** — the actual "someone must click Approve" mechanic — is
  Enterprise-Cloud-only for private repos (`RESEARCH.md` §5). Not usable today.
- A newer "required reviewer rule" (GA 2026-02-17) governs PR merge approvals via repository rulesets, not
  Actions workflow gating. Not applicable.

**Chosen mechanism:** Stage B is `workflow_dispatch`-only. `workflow_dispatch` is inherently restricted —
GitHub only lets users with **write access to the repository** trigger it, and it is never reachable from a
fork PR, a push, or any automated trigger. For a solo-owner repo (CODEOWNERS: `@mohammed-fandees`), "has write
access" and "is the owner" are the same set. Layered on top:

- **Required text input**, e.g. `confirm_tag`, that must exactly match the release tag being submitted. The
  job's first step fails closed if it doesn't match. This converts "clicked a button" into "typed the specific
  version being submitted," which is meaningfully harder to do by accident than clicking a green Run button —
  the closest available approximation of "intentional owner action" without Enterprise-only features.
- **A dedicated GitHub Environment** (`chrome-web-store-production`) scopes the CWS credentials used for
  `publish` to this job only, and carries a **deployment branch policy** (Pro-tier feature, confirmed usable)
  restricting it to protected release tags — so even if a workflow _could_ somehow be tricked into referencing
  this environment from an unexpected ref, the branch policy blocks it.
- Every `workflow_dispatch` run is permanently visible in the Actions run history with the triggering actor,
  timestamp, and inputs — satisfying the auditability requirement without needing a separate approval log.

**Documented upgrade path:** if the repo ever moves to GitHub Enterprise Cloud, add a `required reviewers`
protection rule to the `chrome-web-store-production` environment and the manual-`workflow_dispatch` trigger for
Stage B can be tightened further (e.g. auto-triggered from Stage A's completion, gated by the environment
review instead of by the operator remembering to run it). Not done now because it isn't available now — this
ADR will need a follow-up entry if that changes.

### Alternatives considered and rejected

- **Issue/PR-comment slash-command bot** (e.g. a `/approve v0.3.0` comment triggering `repository_dispatch`):
  more moving parts (a listener workflow, comment-parsing, authorization-checking who commented), more attack
  surface (comment injection, needing to verify the commenter's permission level manually since
  `issue_comment` from any user with _read_ access can comment), and no auditability advantage over
  `workflow_dispatch`, which already has built-in actor attribution and a permission check. Rejected as
  unnecessary complexity for a solo-owner repo.
- **A "release-approval" tracking issue with a checkbox**, closed manually: purely documentational, not
  technically enforced — the prompt explicitly requires the boundary be enforced, not just documented.
  Rejected.

## 4. Decision: metadata stays manual; repo YAML is the sole source of truth for what _would_ sync if it could

Because v2 has no metadata endpoint (`RESEARCH.md` §2), "Chrome Web Store listing metadata is synchronized
where officially supported" resolves to **the supported set is currently empty**. Every listing field —
name, descriptions, category, screenshots, promotional images, localization — is Developer-Dashboard-only,
permanently, until Google adds write support.

What the automation _can_ still usefully do, and does:

- Maintain one canonical, schema-validated, version-controlled file for every field CWS's dashboard exposes:
  `docs/chrome-web-store/listing.yaml` (PR1, this change). Validated for required fields, official character
  limits where confirmed, and well-formed HTTPS URLs (`tooling/release/metadata-schema.ts`).
- Generate a **diff-only** report before owner approval: this release's `listing.yaml` vs. the `listing.yaml`
  at the previous release tag, computed from git history — not against the live dashboard, because the API
  cannot read the live dashboard's values. The report explicitly labels this as a repo-vs-previous-repo
  comparison, per the requirement not to present an unreliable comparison as authoritative.
  changed/unchanged sections. (Report generation lands in PR2 alongside the rest of the approval report;
  PR1 ships the diff primitive and its tests.)
- Never write to CWS metadata, because there is no endpoint to write to. The pipeline uploads the _package_
  only. Any listing change remains a manual paste-into-dashboard action, same as today, documented in
  `docs/chrome-web-store/SUBMISSION_GUIDE.md`.

`docs/chrome-web-store/STORE_LISTING.md` previously held the same descriptions as free-form prose. It now
points at `listing.yaml` as canonical and keeps only the rationale/localization-strategy prose that doesn't
belong in structured data — avoiding two sources of truth for the same strings.

**Release notes:** CWS v2 has no per-version "what's new" field either (same evidence as above — it's simply
not part of the API surface). GitHub Release notes stay on GitHub; the permanent CWS detailed description is
never overwritten with changelog content, matching the explicit instruction not to let release notes leak into
the permanent product description.

## 5. Decision: authenticate via Workload Identity Federation, not a JSON key or OAuth refresh token

`RESEARCH.md` §4. CWS v2 adds official service-account support (one service account per publisher, linked once
in the dashboard). Rather than the JSON-key CI/CD path CWS's own docs walk through, this pipeline uses
`google-github-actions/auth` (Google's official action) with `token_format: access_token` and
`access_token_scopes: https://www.googleapis.com/auth/chromewebstore`, impersonating the linked service account
via GitHub OIDC. No long-lived credential material — JSON key or OAuth refresh token — ever exists in a GitHub
secret, on a runner disk, or anywhere else. The old OAuth-refresh-token workflow (client ID + client secret +
refresh token, the historically common approach) is explicitly not used: it's a long-lived secret with a wider
blast radius than a WIF trust relationship scoped to this one repository.

Exact GCP-side setup (project, service account, WIF pool/provider, attribute condition restricting the trust to
`mohammed-fandees/hamesh`) is a one-time-setup task documented in
[`CHROME_WEB_STORE_AUTOMATION.md`](../CHROME_WEB_STORE_AUTOMATION.md); the secrets/variables it produces are
consumed starting in PR3, when the upload/publish calls are actually implemented.

## 6. Decision: `publishType: DEFAULT_PUBLISH`, not `STAGED_PUBLISH`

Directly per the owner's stated preference and confirmed as the currently-correct value for "publish
automatically after Google approves" (`RESEARCH.md` §3). `STAGED_PUBLISH` would reintroduce exactly the second
manual gate the owner explicitly does not want. This must be re-confirmed at PR3 implementation time per the
top-level instruction to re-verify API behavior immediately before use, but nothing in current research
suggests it has changed.

## 7. Consequences

- Because metadata can't be synced, the "Metadata Review Summary" the owner sees before approving is a
  **repo-vs-previous-repo diff**, not a repo-vs-live-dashboard diff. This is a real, permanent limitation of
  the Chrome Web Store API, not a gap in this pipeline — documented prominently rather than silently.
- Because required-reviewers isn't available, the approval gate relies on repo write-access control +
  a typed confirmation + audit log, instead of a native "Approve" button with a reviewer list. This is weaker
  in one specific way (no enforced N-of-M reviewer policy) but appropriate for a solo-owner repo, and has a
  documented upgrade path if that ever changes.
- Both stages need the same CWS credential (Stage A uploads, Stage B publishes) — the split is enforced by
  _trigger reachability_, not by only one stage holding the secret. This is worth re-stating plainly: the
  security boundary is "what can cause `publish` to be called," not "who holds the secret."
- PR1 ships no workflow YAML at all — only the research, this ADR, the metadata schema/source of truth, and the
  pure, unit-tested validation/diffing primitives that PR2 and PR3 wire into actual jobs. This keeps PR1
  reviewable without asking the owner to reason about live CI behavior yet.
