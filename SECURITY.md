# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately via
[GitHub Security Advisories](https://github.com/mohammed-fandees/hamesh/security/advisories/new).
Include reproduction steps and impact. You can expect an initial response within a
few days.

## Scope

Hamesh is a browser extension that stores notes **locally** in
`chrome.storage.local`. It has no backend, no accounts, and makes no network
requests. Reports of particular interest:

- ways host-page script could read, modify, or exfiltrate stored notes;
- Hamesh UI leaking data into the host page (or vice-versa) across the Shadow DOM
  boundary;
- permission or content-script scope broader than documented;
- supply-chain risks in the build or release pipeline.

## Supported versions

Only the latest released version receives security fixes during the current
pre-1.0 phase.
