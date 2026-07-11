# Store Listing Copy

> **Canonical data has moved to [`listing.yaml`](./listing.yaml).** This file now holds only the rationale,
> alternatives considered, and localization strategy behind those values — not the values themselves, to avoid
> two sources of truth for the same strings. See
> [ADR 0001 §4](../releases/adr/0001-release-architecture.md#4-decision-metadata-stays-manual-repo-yaml-is-the-sole-source-of-truth-for-what-would-sync-if-it-could)
> for why a structured file exists alongside this prose doc, and why none of it can be synced to the Chrome Web
> Store automatically.
>
> **Two corrections made while migrating this content (2026-07-10), documented here rather than applied
> silently:**
>
> 1. The previous version of this file, and the rest of `docs/chrome-web-store/`, was written and audited
>    against **v0.1.0**. The product is now **v0.2.0** (Settings screen, language/appearance preferences — see
>    `CHANGELOG.md`) and, per the landing page's install link, already has a **live** Chrome Web Store listing.
>    `listing.yaml`'s copy is otherwise unchanged from what was written for v0.1.0 — it has **not** been rewritten
>    for v0.2.0's feature set. That's a product/marketing content decision for the owner, not something this
>    infrastructure change should do silently. The one thing this migration did remove is the description's
>    "CURRENT SCOPE (v0.1.0)" paragraph, because a hardcoded stale version number in a file titled "canonical" is
>    actively misleading, not just outdated — regenerating the rest of the copy for v0.2.0 is left open.
> 2. This file's "Official website / homepage" guidance (see `SUBMISSION_GUIDE.md`) previously guessed
>    `https://hamesh.fandees.tech` as the likely landing domain, not yet confirmed deployed. The landing page's
>    own `<link rel="canonical">` shows the actual live domain is **`https://hamesh.app`** — `listing.yaml` uses
>    the confirmed domain, not the guess.

---

## Product name

**Recommended (used in `listing.yaml`):** `Hamesh — Contextual Notes`

**Alternative:** `Hamesh: Notes in Context`

**Rationale:** The Arabic brand mark هامش ("margin") is the product's core identity (see the approved brand
system), but the Chrome Web Store name field is Latin-searchable and title-cased in practice; leading with the
Latin transliteration plus a short English qualifier keeps the listing discoverable by English-speaking
searchers while the icon, screenshots, and description carry the Arabic-first identity. Do not keyword-stuff the
title (policy-prohibited); one clear qualifier is enough.

## Short description / summary (max 132 characters, confirmed official limit)

An alternative English phrasing was considered and rejected in favor of the one now in `listing.yaml`:

> Leave a note exactly where it belongs on any web page — restored automatically when you return. Fully local.
> (108 / 132 characters)

**Why the version in `listing.yaml` instead:** it states the mechanism (attach to an element), the payoff
(restored on return), and the privacy posture (local-only, no account) — the three facts users most need before
installing — in the fewest words. The alternative leads with the brand line ("where it belongs") from the
landing page/brand system, which is more evocative but spends more characters on tone versus fact; use it if the
owner prefers brand voice over information density.

## Detailed description

No official hard character cap was confirmed for this field (`docs/releases/RESEARCH.md` §7) — the validator
treats length as advisory only. See `listing.yaml` for the current EN/AR copy.

**Localization note:** the Arabic copy is not a literal word-for-word translation of the English — tone and
phrasing were adapted naturally (per the brand system's "Arabic-first, naturally localized" direction), while
keeping every factual claim (privacy behavior, feature list) identical between languages, since both must be
equally truthful.

## Category

**Recommended: Productivity** (used in `listing.yaml`).

**Rationale:** Chrome Web Store's exact current category taxonomy could not be independently confirmed via
public documentation (see `README.md`'s sourcing table) — the dashboard's live category dropdown is the
authoritative source. "Productivity" is the closest and most durable fit across the taxonomy's various
historical revisions, since Hamesh is a note-taking/annotation tool, not a developer tool, not a content
blocker, and not an accessibility tool. **Action required:** confirm the exact available option text in the
live dashboard dropdown before submitting; if a more specific "Note-taking" or "Web & Browsers" style option
exists at submission time, prefer it.

## Language / localization strategy

- **Primary listing language for initial submission:** English, because Chrome Web Store review and most
  discovery traffic defaults to the store's configured locale, and English maximizes reviewer clarity during the
  first submission.
- **Arabic is added as a second listing language** via the dashboard's localization feature — `listing.yaml`
  carries both `locales.en` and `locales.ar` today so both are reviewed together in the same PR, even though
  only English is used for the very first submission.
- **In-product language:** already implemented and verified — Hamesh's UI follows the browser's extension
  locale (`src/ui/i18n.ts`), defaulting to English and switching to Arabic (RTL) automatically; this is
  independent of the store listing language and works today regardless of which listing language is live.
- Keep brand naming consistent everywhere: **هامش** and **Hamesh**, never anglicized or re-transliterated
  differently across fields.
