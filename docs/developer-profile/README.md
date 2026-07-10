# Developer Profile Icon

A personal 128×128 icon for your Chrome Web Store **developer/publisher profile** — this represents you (Mohammed Fandees, fandees.tech) as a developer account, not the Hamesh product. It's intentionally a separate visual identity from Hamesh's own brand system, since a developer profile can host multiple unrelated extensions in the future.

## File

`developer-icon-128.png` — 128×128 PNG, verified dimensions. "MF" monogram in Space Grotesk (geometric, professional sans-serif), dark charcoal background, warm accent on the "F" with a small signature dot.

## Where this goes

Chrome Web Store Developer Dashboard → **Account** (or **Store settings**, depending on the current dashboard layout) → developer/publisher display settings. Field naming has changed across dashboard revisions; look for wherever your public developer name and icon are set, since this is distinct from any single extension's own icon (Hamesh's extension icon lives in `docs/chrome-web-store/icons/` and is unrelated to this file).

## Regenerating

Source: `source/monogram-128.html` (edit colors/type there). Rebuild with:

```bash
node scripts/generate-developer-icon.mjs
```
