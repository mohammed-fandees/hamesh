# Releasing Hamesh

Hamesh uses [Semantic Versioning](https://semver.org): `vMAJOR.MINOR.PATCH`.
The version is the single source of truth in `package.json` and must match
`wxt.config.ts` (the extension manifest version).

## Steps

1. Ensure `main` is green in CI.
2. Bump the version in **both** `package.json` and `wxt.config.ts`, and add a
   dated section to `CHANGELOG.md` describing the changes.
3. Merge that to `main` via PR.
4. Tag the release commit and push the tag:

   ```bash
   git switch main && git pull
   git tag -a v0.1.0 -m "v0.1.0"
   git push origin v0.1.0
   ```

5. The **Release** workflow (`.github/workflows/release.yml`) triggers on the
   `v*.*.*` tag: it re-runs the quality gates, builds the production package with
   `pnpm zip`, generates a SHA-256 checksum, and publishes a GitHub Release with
   the extension `.zip` and checksum attached. Release notes are extracted from
   the matching `CHANGELOG.md` section.

   You can also run it manually via **Actions → Release → Run workflow** and
   supplying an existing tag.

## The artifact

The release artifact is `hamesh-<version>-chrome.zip` — the packaged Chrome
MV3 extension produced by WXT (`pnpm zip`). It contains only built files
(manifest, scripts, styles, icons) — no source, tests, or configuration. It is
suitable for manual "Load unpacked" (after extracting) and is also the basis
for Chrome Web Store submissions. Hamesh is published on the
[Chrome Web Store](https://chromewebstore.google.com/detail/hamesh-%E2%80%94-%D9%87%D8%A7%D9%85%D8%B4/giajamkkehcoienhhlcfgcckahjjbgnc);
bump the store listing separately after cutting a GitHub release (see
`docs/chrome-web-store/`).
