/**
 * Renders the personal Chrome Web Store developer/publisher icon (128x128)
 * from docs/developer-profile/source/monogram-128.html using real font
 * rendering (Playwright/Chromium).
 *
 * Usage: node scripts/generate-developer-icon.mjs
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.resolve(ROOT, 'docs', 'developer-profile', 'source', 'monogram-128.html');
const OUT_DIR = path.resolve(ROOT, 'docs', 'developer-profile');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 128, height: 128 } });
  await page.goto(pathToFileURL(SRC).href);
  await page.waitForTimeout(300); // allow the web font to finish loading
  const outPath = path.join(OUT_DIR, 'developer-icon-128.png');
  await page.screenshot({ path: outPath });
  console.log(`captured ${outPath} (128x128)`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
