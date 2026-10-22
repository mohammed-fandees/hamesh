# Asset Manifest

Every visual asset prepared for submission, how it was produced, and its QA status. All dimensions below were verified **programmatically**, not assumed from the generation script.

## Screenshots (`screenshots/`)

Composed brand graphics, not raw captures: each is drawn from the landing page's own stylesheets and demo markup (the same pieces the landing's feature scenes animate), with a caption beside it. They replace the earlier set of five raw captures from the built extension (2026-10). Rendered from `source/screenshot-*.html` (with `source/store-stills.css`) by `scripts/generate-promo-assets.mjs`.

| #   | File                       | Dimensions | Format    | What it shows                                                                                             |
| --- | -------------------------- | ---------- | --------- | --------------------------------------------------------------------------------------------------------- |
| 1   | `01-overview.png`          | 1280×800   | PNG (RGB) | Everything at once: the promise, its terms (free, no account, local notes, Teams' free plan), eight tiles |
| 2   | `02-teams.png`             | 1280×800   | PNG (RGB) | A shared note on a page with its author's face, and its discussion with an @mention                       |
| 3   | `03-notes-on-words.png`    | 1280×800   | PNG (RGB) | Tinted words and the composer attached to them (Alt+T)                                                    |
| 4   | `04-notes-on-a-moment.png` | 1280×800   | PNG (RGB) | A quick note on a video, and its mark on the timeline (Alt+V)                                             |
| 5   | `05-notes-library.png`     | 1280×800   | PNG (RGB) | The Notes Library: personal and team notes, a pinned one, search and filters                              |

**Content:** English, light theme. Every person in them is a made-up name and every site an example domain. The discussion in `02-teams.png` paraphrases points readers made in public reviews of the book, under invented names; it quotes no one.

**QA performed:** dimensions and pixel format read with `ffprobe` (all exactly 1280×800, RGB, no alpha); each visually inspected for clipping, overlap and legibility; the output of the script compared pixel for pixel with the reviewed renders (identical for all but `04`, whose video glow gradient differs imperceptibly).

**Not a capture of the running extension.** `scripts/capture-store-screenshots.mjs` still captures the real product on `source/demo-page.html`, under the old file names; this set does not come from it.

## Promotional images (`promotional/`)

Rendered from `source/promo-small-tile.html` and `source/promo-marquee.html` by `scripts/generate-promo-assets.mjs`, with the same fonts and tokens as the landing page.

| File                     | Dimensions | Purpose                                       | Required or optional                                   |
| ------------------------ | ---------- | --------------------------------------------- | ------------------------------------------------------ |
| `small-tile-440x280.png` | 440×280    | Store search results / category browsing tile | Commonly requested by the dashboard; treat as required |
| `marquee-1400x560.png`   | 1400×560   | Featured placement banner                     | Optional — only used if Google features the extension  |

**Design:** the mark is the margin. A ruled notebook page with its margin line; one phrase is tinted, and the mark itself, at its exact proportions and in its one fixed orientation, reaches from those words into the margin to hold what was written there. In the small tile what is written there is the name, "Hamesh"; in the marquee, a note beside the landing's own hero copy.

**QA performed:** dimensions and pixel format read with `ffprobe` (exact sizes, RGB); the small tile checked at half size, where the ruled page becomes texture and the mark and name stay legible.

## Icons (`icons/`)

| File                 | Dimensions | Use                                               | Format                  |
| -------------------- | ---------- | ------------------------------------------------- | ----------------------- |
| `store-icon-128.png` | 128×128    | The dashboard's **Store icon** field              | PNG, RGBA (transparent) |
| `toolbar-16.png`     | 16×16      | `manifest.icons["16"]`, favicon-scale UI          | PNG, RGBA               |
| `toolbar-32.png`     | 32×32      | `manifest.icons["32"]`                            | PNG, RGBA               |
| `manifest-48.png`    | 48×48      | `manifest.icons["48"]`, extension management page | PNG, RGBA               |
| `manifest-96.png`    | 96×96      | `manifest.icons["96"]`                            | PNG, RGBA               |

**Store icon:** rendered from `source/store-icon.html` by `scripts/generate-promo-assets.mjs`, following Chrome's image guidelines: a 96×96 clay tile (rounded, with a subtle top-to-bottom gradient) inside 16px of fully transparent padding on every side, and the mark in paper colour, stem on the left as everywhere else. No edge and no shadow, so the padding stays clear; the clay reads on light and dark backgrounds alike. It is no longer a copy of `public/icon/128.png`: the package keeps the plain mark for Chrome's toolbar.

**Toolbar and manifest icons:** copied from `public/icon/` (the files the production manifest references), drawn by `scripts/generate-icons.mjs` in the clay colour (`#B5502F`).

**QA performed:** the store icon's padding verified fully transparent (alpha 0 on all four 16px bands); checked over white and over `#202124`; every file confirmed RGBA at the stated size.

## Social preview (already existed, referenced for completeness)

`landing/assets/og.png` (1200×630) — used by the landing page's Open Graph/Twitter Card meta tags, generated by `scripts/generate-og.mjs`. Not a Chrome Web Store asset, listed here only because it shares the same brand-asset generation pattern.

## Source files (`source/`)

Editable inputs kept for regeneration, not themselves submission assets. They link the landing's stylesheets (`../../../landing/css/`), so a token change there carries through on the next render.

- `screenshot-overview.html`, `screenshot-teams.html`, `screenshot-words.html`, `screenshot-moment.html`, `screenshot-library.html`, and `store-stills.css`: the five screenshots.
- `promo-small-tile.html`, `promo-marquee.html`: the promotional images.
- `store-icon.html`: the store icon.
- `demo-page.html`: the article page `scripts/capture-store-screenshots.mjs` captures the real extension on.

**To regenerate:** `node scripts/generate-promo-assets.mjs`, or `PLAYWRIGHT_CHANNEL=chrome node scripts/generate-promo-assets.mjs` to use an installed Chrome. No build step needed.

`privacy.html` was moved out of this folder — the actual, publicly-hosted, bilingual privacy policy now lives at `landing/privacy.html` (see `PRIVACY_POLICY.md`).
