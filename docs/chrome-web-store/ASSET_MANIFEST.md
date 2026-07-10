# Asset Manifest

Every visual asset prepared for submission, how it was produced, and its QA status. All dimensions below were verified **programmatically** by reading each PNG's IHDR chunk, not assumed from the generation script.

## Screenshots (`screenshots/`)

Captured from the **real, built extension** (`pnpm build` → `.output/chrome-mv3`) running against a deterministic demo article page (`source/demo-page.html`), via `scripts/capture-store-screenshots.mjs` (Playwright, `--headless=new`, viewport locked to 1280×800). No staged mockups, no fabricated UI — every pixel is the actual product.

| #   | File                        | Dimensions | Format    | What it shows                                                      | Story beat                |
| --- | --------------------------- | ---------- | --------- | ------------------------------------------------------------------ | ------------------------- |
| 1   | `01-contextual-notes.png`   | 1280×800   | PNG (RGB) | A saved note open in place, next to the paragraph that inspired it | Core promise, shown whole |
| 2   | `02-select-element.png`     | 1280×800   | PNG (RGB) | Selection mode: accent outline on the headline + instruction pill  | Select                    |
| 3   | `03-write-in-context.png`   | 1280×800   | PNG (RGB) | The composer, mid-typing, attached to the selected paragraph       | Write                     |
| 4   | `04-return-and-restore.png` | 1280×800   | PNG (RGB) | Page reloaded; the marker has reappeared automatically             | Return                    |
| 5   | `05-edit-your-note.png`     | 1280×800   | PNG (RGB) | The note reopened in edit mode                                     | Manage                    |

**QA performed:** dimensions verified via PNG IHDR read (all exactly 1280×800, matching Chrome Web Store's recommended screenshot size); PNG signature validated; no duplicate files (MD5 comparison); visually inspected each image for clipping, unreadable text, or broken layout — none found. Content is English only, consistent with the "English primary listing" strategy in `STORE_LISTING.md`.

**Known gap, not blocking:** no Arabic-locale product screenshots yet. If/when an Arabic store listing is added (see `STORE_LISTING.md`'s language strategy), regenerate a parallel set with a `browser.i18n` override or an Arabic demo page — the capture script and demo-page pattern both support this with minor edits.

**To regenerate after a UI change:** `pnpm build && node scripts/capture-store-screenshots.mjs`.

## Promotional images (`promotional/`)

Rendered from brand-token HTML sources (`source/promo-small-tile.html`, `source/promo-marquee.html`) via `scripts/generate-promo-assets.mjs` (Playwright, real font rendering — IBM Plex Sans/Sans Arabic/Serif, same fonts as the landing page and extension UI). Not photographs of the extension; these are composed brand graphics, which is standard practice for this asset type and was chosen because the small tile in particular is too small to legibly show live UI.

| File                     | Dimensions | Purpose                                       | Required or optional                                   |
| ------------------------ | ---------- | --------------------------------------------- | ------------------------------------------------------ |
| `small-tile-440x280.png` | 440×280    | Store search results / category browsing tile | Commonly requested by the dashboard; treat as required |
| `marquee-1400x560.png`   | 1400×560   | Featured placement banner                     | Optional — only used if Google features the extension  |

**Design notes:** paper background, clay accent mark, IBM Plex Sans Arabic for هامش and IBM Plex Serif italic for "Hamesh" — identical token values to `landing/index.html` and `src/ui/tokens.css`. The marquee includes a small recreation of the real composer card (same corner radius, connector stub, and button styles as the shipped UI) so it stays visually truthful without being a raw screenshot. Text kept minimal per Chrome Web Store guidance against overcrowded promotional images. No fake Chrome browser chrome is drawn — the small window-dot decoration is a generic, unbranded "app window" cue, not a claimed Chrome screenshot.

**QA performed:** dimensions verified via PNG IHDR read (exact match); Arabic glyph rendering visually inspected (هامش renders correctly, properly shaped, no tofu/missing-glyph boxes); mixed Arabic/English layout inspected for spacing issues — none found.

**To regenerate after a brand/token change:** `node scripts/generate-promo-assets.mjs` (no build step needed — these don't depend on the extension bundle).

## Icons (`icons/`)

Copied from `public/icon/` (the same files the production manifest references) — not redesigned, since the audit found the existing set already meets requirements.

| File                 | Dimensions | Source manifest use                               | Format                  |
| -------------------- | ---------- | ------------------------------------------------- | ----------------------- |
| `store-icon-128.png` | 128×128    | Chrome Web Store listing icon requirement         | PNG, RGBA (transparent) |
| `toolbar-16.png`     | 16×16      | `manifest.icons["16"]`, favicon-scale UI          | PNG, RGBA               |
| `toolbar-32.png`     | 32×32      | `manifest.icons["32"]`                            | PNG, RGBA               |
| `manifest-48.png`    | 48×48      | `manifest.icons["48"]`, extension management page | PNG, RGBA               |
| `manifest-96.png`    | 96×96      | `manifest.icons["96"]`                            | PNG, RGBA               |

**Source of truth:** `scripts/generate-icons.mjs` — a dependency-free rasterizer that draws the exact brand margin-mark glyph (same path data as `src/ui/MarginMark.tsx` and the landing page's inline SVGs) with 4× supersampled anti-aliasing, in the approved clay color (`#B5502F`).

**QA performed:** all five files confirmed RGBA with real alpha transparency (required for correct rendering on both light and dark Chrome toolbars); dimensions verified via PNG IHDR read; visually inspected at native size — the glyph remains crisp and recognizable even at 16×16; consistent single-color treatment across all sizes (no inconsistent logo variants).

## Social preview (already existed, referenced for completeness)

`landing/assets/og.png` (1200×630) — used by the landing page's Open Graph/Twitter Card meta tags, generated by `scripts/generate-og.mjs`. Not a Chrome Web Store asset, listed here only because it shares the same brand-asset generation pattern.

## Source files (`source/`)

Editable inputs kept for future regeneration, not themselves submission assets:

- `demo-page.html` — the deterministic article page used for screenshot capture.
- `promo-small-tile.html`, `promo-marquee.html` — the HTML/CSS sources for the promotional images.

`privacy.html` was moved out of this folder — the actual, publicly-hosted, bilingual privacy policy now lives at `landing/privacy.html` (see `PRIVACY_POLICY.md`).
