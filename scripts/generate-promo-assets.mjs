/**
 * Renders the Chrome Web Store promotional images from brand-token HTML
 * sources using real font rendering (Playwright/Chromium), at exact required
 * pixel dimensions — small tile 440x280, marquee 1400x560.
 *
 * Usage: node scripts/generate-promo-assets.mjs
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.resolve(ROOT, 'docs', 'chrome-web-store', 'source');
const OUT = path.resolve(ROOT, 'docs', 'chrome-web-store', 'promotional');
fs.mkdirSync(OUT, { recursive: true });

const TARGETS = [
  { file: 'promo-small-tile.html', out: 'small-tile-440x280.png', width: 440, height: 280 },
  { file: 'promo-marquee.html', out: 'marquee-1400x560.png', width: 1400, height: 560 },
];

async function main() {
  const browser = await chromium.launch();
  for (const t of TARGETS) {
    const page = await browser.newPage({ viewport: { width: t.width, height: t.height } });
    await page.goto(pathToFileURL(path.join(SRC, t.file)).href);
    await page.waitForTimeout(300); // allow web fonts to finish loading
    await page.screenshot({ path: path.join(OUT, t.out) });
    console.log(`captured ${t.out} (${t.width}x${t.height})`);
    await page.close();
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
