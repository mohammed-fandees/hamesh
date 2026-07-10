/**
 * Captures Chrome Web Store screenshots from the REAL built extension running
 * against a deterministic demo page — not staged mockups. Requires `pnpm build`
 * to have produced `.output/chrome-mv3` first.
 *
 * Output: docs/chrome-web-store/screenshots/0N-*.png at exactly 1280x800
 * (Chrome Web Store's primary recommended screenshot size).
 *
 * Usage: pnpm build && node scripts/capture-store-screenshots.mjs
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXT = path.resolve(ROOT, '.output', 'chrome-mv3');
const DEMO_HTML = fs.readFileSync(
  path.resolve(ROOT, 'docs', 'chrome-web-store', 'source', 'demo-page.html'),
  'utf8',
);
const OUT_DIR = path.resolve(ROOT, 'docs', 'chrome-web-store', 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

if (!fs.existsSync(EXT)) {
  console.error('Build the extension first: pnpm build');
  process.exit(1);
}

const WIDTH = 1280;
const HEIGHT = 800;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(DEMO_HTML);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}/`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

async function main() {
  const server = await startServer();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamesh-shots-'));
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      `--window-size=${WIDTH},${HEIGHT}`,
    ],
    viewport: { width: WIDTH, height: HEIGHT },
  });

  const page = await ctx.newPage();
  await page.goto(server.url);
  await page.waitForTimeout(600);

  const activate = () =>
    page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));

  // ---- 02: Selection mode — hover outline + instruction pill over the headline ----
  await activate();
  await page.waitForTimeout(150);
  const titleBox = await page.locator('[data-demo="title"]').boundingBox();
  await page.mouse.move(titleBox.x + titleBox.width / 2, titleBox.y + titleBox.height / 2);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT_DIR, '02-select-element.png') });
  console.log('captured 02-select-element.png');

  // ---- 03: Composer open, mid-typing, anchored to the third paragraph ----
  const p3Box = await page.locator('[data-demo="p3"]').boundingBox();
  await page.mouse.move(p3Box.x + p3Box.width / 2, p3Box.y + 10);
  await page.mouse.click(p3Box.x + p3Box.width / 2, p3Box.y + 10);
  await page.waitForTimeout(300);
  await page
    .locator('.hm-card textarea')
    .fill('The retention-practice point applies directly to how we onboard new users.');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT_DIR, '03-write-in-context.png') });
  console.log('captured 03-write-in-context.png');

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(400);

  // ---- 01: Hero shot — note open in context, showing the whole concept at once ----
  await page.locator('.hm-marker').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, '01-contextual-notes.png') });
  console.log('captured 01-contextual-notes.png');

  // Close the viewer before reload so the "restored" shot starts clean.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // ---- 04: Return and restore — reload, marker reappears automatically ----
  await page.reload();
  await page.waitForTimeout(700);
  await page.locator('.hm-marker').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: path.join(OUT_DIR, '04-return-and-restore.png') });
  console.log('captured 04-return-and-restore.png');

  // ---- 05: Edit the note ----
  await page.locator('.hm-marker').first().click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT_DIR, '05-edit-your-note.png') });
  console.log('captured 05-edit-your-note.png');

  await page.close();
  await ctx.close();
  await server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
