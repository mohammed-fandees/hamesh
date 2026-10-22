/**
 * Renders every Chrome Web Store graphic from its HTML source in
 * docs/chrome-web-store/source/, using real font rendering (Playwright), at the
 * store's exact pixel sizes:
 *
 *   - five 1280×800 screenshots      → screenshots/
 *   - the 440×280 small promo tile   → promotional/
 *   - the 1400×560 marquee           → promotional/
 *   - the 128×128 store icon         → icons/ (96×96 artwork, 16px transparent padding)
 *
 * The sources are built from the landing page's own stylesheets, so each page
 * is laid out at a CSS size with the target's aspect ratio and scaled to the
 * exact pixel size. The landing's icon sprite is injected so every glyph is the
 * site's own.
 *
 * Usage: node scripts/generate-promo-assets.mjs
 * With an installed Chrome instead of Playwright's bundled Chromium:
 *        PLAYWRIGHT_CHANNEL=chrome node scripts/generate-promo-assets.mjs
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STORE = path.resolve(ROOT, 'docs', 'chrome-web-store');
const SRC = path.join(STORE, 'source');

/* Hidden inline, not by the landing's `.sprite` rule: a page that doesn't load
   base.css (the icon) would otherwise give it a default 300×150 box that pushes
   the artwork out of frame. */
const sprite = fs
  .readFileSync(path.join(ROOT, 'landing', 'index.html'), 'utf8')
  .match(/<svg class="sprite"[\s\S]*?<\/svg>\s*(?=\n\s*<)/)[0]
  .replace(
    '<svg class="sprite"',
    '<svg class="sprite" style="position:absolute;width:0;height:0;overflow:hidden"',
  );

const SCREENSHOT = [1280, 800];
const TARGETS = [
  {
    file: 'screenshot-overview.html',
    out: 'screenshots/01-overview.png',
    css: [1280, 800],
    px: SCREENSHOT,
  },
  {
    file: 'screenshot-teams.html',
    out: 'screenshots/02-teams.png',
    css: [1200, 750],
    px: SCREENSHOT,
  },
  {
    file: 'screenshot-words.html',
    out: 'screenshots/03-notes-on-words.png',
    css: [1024, 640],
    px: SCREENSHOT,
  },
  {
    file: 'screenshot-moment.html',
    out: 'screenshots/04-notes-on-a-moment.png',
    css: [1024, 640],
    px: SCREENSHOT,
  },
  {
    file: 'screenshot-library.html',
    out: 'screenshots/05-notes-library.png',
    css: [1024, 640],
    px: SCREENSHOT,
  },
  {
    file: 'promo-small-tile.html',
    out: 'promotional/small-tile-440x280.png',
    css: [440, 280],
    px: [440, 280],
  },
  {
    file: 'promo-marquee.html',
    out: 'promotional/marquee-1400x560.png',
    css: [1400, 560],
    px: [1400, 560],
  },
  /* The only one with transparency: its padding must stay clear. */
  {
    file: 'store-icon.html',
    out: 'icons/store-icon-128.png',
    css: [128, 128],
    px: [128, 128],
    transparent: true,
  },
];

async function main() {
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  const browser = await chromium.launch(channel ? { channel } : {});
  for (const t of TARGETS) {
    const [width, height] = t.css;
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: t.px[0] / width,
      colorScheme: 'light',
    });
    await page.goto(pathToFileURL(path.join(SRC, t.file)).href, { waitUntil: 'networkidle' });
    await page.evaluate((svg) => document.body.insertAdjacentHTML('afterbegin', svg), sprite);
    await page.evaluate(() => document.fonts.ready);
    // Pieces that sit over a scene are placed from the measured elements.
    await page.evaluate(() => typeof window.place === 'function' && window.place());
    await page.waitForTimeout(200);
    const out = path.join(STORE, t.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, omitBackground: Boolean(t.transparent) });
    console.log(`captured ${t.out} (${t.px[0]}x${t.px[1]})`);
    await page.close();
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
