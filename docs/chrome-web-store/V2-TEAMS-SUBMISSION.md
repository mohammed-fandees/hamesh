# 2.0.0 — submitting Hamesh with Teams

From 2.0.0 the store package includes **Hamesh Teams**. This file supersedes, for 2.0.0 and later,
the "no account / no data leaves the device" answers in `PRIVACY_PRACTICES.md`,
`PERMISSION_JUSTIFICATIONS.md`, `REVIEWER_NOTES.md` and `PRIVACY_POLICY.md`. Those files remain
true for **personal notes**, which are unchanged.

The public policy is `landing/privacy.html` (<https://hamesh.fandees.tech/privacy.html>), and the
terms are `landing/terms.html`. Every answer below follows them. If the two ever disagree, fix the
code or the policy first; never fix only this sheet.

## Before you submit — owner actions

1. **Repository variables** (GitHub → Settings → Secrets and variables → Actions → **Variables**).
   Without them the release workflow stops rather than ship a package without Teams:
   - `WXT_TEAMS_API_ORIGIN` = `https://api.hamesh.fandees.tech`
   - `WXT_GOOGLE_CLIENT_ID` = the production OAuth client id (the one in `hamesh-api`'s
     production `GOOGLE_CLIENT_ID`)
2. **Google OAuth client:** its authorized redirect URI must be the store extension's own
   `https://giajamkkehcoienhhlcfgcckahjjbgnc.chromiumapp.org/`. The production API's
   `ALLOWED_REDIRECT_URIS` and `EXTENSION_ORIGINS` already name that id.
3. **Production API** is deployed with every migration (through `0007_user_avatar`), and
   `/v1/plans` returns the payment instructions and the current terms version.
4. **The landing site** is deployed, so `privacy.html` and `terms.html` match this release.
5. **A reviewer account:** grant a Google account you control an active entitlement from the
   admin console, so a reviewer can create a team without paying. Put its address in the
   reviewer notes below. Don't put its password anywhere in this repo.

## Permissions — dashboard justifications

| Permission                          | Kind                                                                | Justification (paste)                                                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sidePanel`                         | required, **no install warning**                                    | Shows a shared note's discussion in Chrome's side panel beside the page it belongs to, when the user opens it from the note. It reads nothing from the page.                  |
| `identity`                          | **optional** — requested only when the user presses _Turn on Teams_ | Opens Google's sign-in window (`launchWebAuthFlow`) for the optional Hamesh Teams feature. Never requested at install; given back when Teams is turned off.                   |
| `https://api.hamesh.fandees.tech/*` | **optional host** — same moment as `identity`                       | The only server Hamesh talks to, for the optional Teams feature: the notes a user chooses to share, their team's comments, and the plan. Given back when Teams is turned off. |

Unchanged: `storage`, `activeTab`, `favicon`, `alarms` and the `<all_urls>` content script — see
`PERMISSION_JUSTIFICATIONS.md`.

The worker also fetches team members' profile pictures from `*.googleusercontent.com` (https
only, ≤ 64 KB, no cookies, no referrer). That host serves `Access-Control-Allow-Origin: *`, so
**no host permission** is needed. The pictures are stored on the device as `data:` URLs, so a web
page never requests them.

## Privacy practices — dashboard answers for 2.0.0

"Collected" means it leaves the device. Everything here concerns **only users who turn on Teams**.
Personal notes collect nothing, as before.

| Category                            | 2.0.0 answer              | What, exactly                                                                                                                                                                                                                |
| ----------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personally identifiable information | **Yes** (Teams)           | Google account id, email, display name, profile-picture address; emails of people a member invites.                                                                                                                          |
| Authentication information          | **Yes** (Teams)           | A session token issued by the Teams server after Google sign-in, stored in the extension's IndexedDB and hashed on the server. No password is ever seen.                                                                     |
| Personal communications             | **Yes** (Teams)           | Comments and @ mentions written in a team.                                                                                                                                                                                   |
| Website content                     | **Yes**                   | Locally, as before. For Teams, the text, page URL and title, and element details of **notes the user explicitly shares**.                                                                                                    |
| Web history                         | **Yes** (Teams, narrowly) | The URLs of pages on which the user **explicitly shares** a note. Browsing is never sent: the page's team notes are matched on the device.                                                                                   |
| Financial and payment information   | **Yes** (Teams)           | Payment method, transaction reference, months, amount, status, terms version. No card or bank details; payment itself happens outside the extension (InstaPay).                                                              |
| User activity                       | **No**                    | A server-side security log of significant actions (for example, team created or note deleted) is kept for abuse protection, not as activity tracking. Answer _No_, and describe the log in the privacy policy (it is there). |
| Health, Location                    | **No**                    | —                                                                                                                                                                                                                            |

**Certifications.** All four can be certified truthfully:

- the data serves only Teams;
- it is not sold;
- it is not used for unrelated purposes;
- it is not used for credit.

The policy states compliance with the Limited Use requirements.

**Remote code:** No. Every script is in the package; the server returns data only.

**Data in transit:** HTTPS and WSS only (`src/teams/config.ts` refuses non-https origins outside
localhost).

**Privacy policy URL:** <https://hamesh.fandees.tech/privacy.html>

## Reviewer notes — add to `REVIEWER_NOTES.md`'s text

> **Hamesh Teams (new in 2.0.0, optional).** Personal notes work exactly as before with no
> account; the steps above still apply. To review Teams:
>
> 1. Open the toolbar popup → **Open Notes Library** → **Settings** → **Teams** → **Turn on
>    Teams**. Chrome asks for the two optional permissions.
> 2. Sign in with Google using the test account: `<reviewer account email — owner fills this in>`.
>    That account already has an active plan.
> 3. In **Teams**, create a team. In the Library, open a note's ⋮ menu → share it with the team,
>    then visit that note's page: the note now shows its author's face. Open it to see the
>    discussion and reply. The side-panel icon opens the full discussion beside the page.
> 4. **Turn off Teams** in Settings gives both optional permissions back and clears the team data
>    held on the device.

## Legal checks the owner keeps up

Not code, so not verified here. Listed so they are not forgotten:

- Lawyer review of `terms.html` and `privacy.html`.
- Egypt PDPL 151/2020: data-controller licensing with the PDPC, and authorization for
  cross-border transfer (Cloudflare). The compliance deadline is 1 November 2026.
