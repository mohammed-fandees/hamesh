import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Hamesh E2E — drives the REAL extension UI (selection mode → composer →
 * marker → viewer → edit → delete), not just the storage layer.
 *
 * Requires the extension to be built first: `pnpm build` (Playwright's
 * webServer config runs it). The unpacked build lives in `.output/chrome-mv3`.
 *
 * Selection mode is started with a deterministic `hamesh:activate` DOM event
 * (see src/entrypoints/content.ts) — reliable in headless Chrome and
 * capability-equivalent to the toolbar button.
 */

const EXTENSION_PATH = path.resolve(import.meta.dirname, '..', '.output', 'chrome-mv3');
const FIXTURE_HTML = fs.readFileSync(
  path.resolve(import.meta.dirname, 'fixtures', 'test-page.html'),
  'utf8',
);

// Content scripts don't run on file:// URLs by default, so serve over HTTP.
function startServer(): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(FIXTURE_HTML);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}/test-page.html`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function launch(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamesh-e2e-'));
  // `--headless=new` is required: the legacy headless mode can't load
  // extensions. Passing headless:false keeps Playwright from adding the old flag.
  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });
}

async function activateAndSelect(page: Page, testId: string): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));
  await expect(page.locator('.hm-capture')).toBeVisible();
  const box = await page.locator(`[data-testid="${testId}"]`).boundingBox();
  if (!box) throw new Error(`no box for ${testId}`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.click(cx, cy);
  await expect(page.locator('.hm-card textarea')).toBeVisible();
}

async function createNote(page: Page, testId: string, text: string): Promise<void> {
  await activateAndSelect(page, testId);
  await page.locator('.hm-card textarea').fill(text);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.hm-marker')).toHaveCount(1);
}

test.describe('Hamesh core flows', () => {
  let context: BrowserContext;
  let server: { url: string; close: () => Promise<void> };

  test.beforeEach(async () => {
    server = await startServer();
    context = await launch();
  });
  test.afterEach(async () => {
    await context.close();
    await server.close();
  });

  test('E2E 1 — create, see marker, reload, restore, open, verify content', async () => {
    const page = await context.newPage();
    await page.goto(server.url);
    await expect(page.locator('[data-testid="page-title"]')).toHaveText('Hamesh Test Page');

    const content = 'Retention curve applies to onboarding drop-off.';
    await createNote(page, 'article-heading', content);

    // Reload → marker restored
    await page.reload();
    await expect(page.locator('.hm-marker')).toHaveCount(1);

    // Open → content correct
    await page.locator('.hm-marker').click();
    await expect(page.locator('.hm-card .hm-note-body')).toHaveText(content);

    await page.close();
  });

  test('E2E 2 — create, edit, persist edit, delete, verify removal', async () => {
    const page = await context.newPage();
    await page.goto(server.url);

    await createNote(page, 'para-one', 'Original note content.');

    // Open + edit
    await page.locator('.hm-marker').click();
    await page.getByRole('button', { name: 'Edit' }).click();
    const edited = 'Updated — the edit persisted correctly.';
    await page.locator('.hm-card textarea').fill(edited);
    await page.getByRole('button', { name: 'Save changes' }).click();

    // Reload → edited content persists
    await page.reload();
    await expect(page.locator('.hm-marker')).toHaveCount(1);
    await page.locator('.hm-marker').click();
    await expect(page.locator('.hm-card .hm-note-body')).toHaveText(edited);

    // Delete (with confirmation)
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('.hm-marker')).toHaveCount(0);

    // Reload → still gone
    await page.reload();
    await expect(page.locator('.hm-marker')).toHaveCount(0);

    await page.close();
  });

  test('E2E 3 — SPA navigation changes page identity and re-evaluates markers', async () => {
    const page = await context.newPage();
    await page.goto(server.url);

    await createNote(page, 'article-heading', 'A note on the first virtual page.');
    await expect(page.locator('.hm-marker')).toHaveCount(1);

    // Client-side navigate to a different path → different page key → marker clears
    await page.evaluate(() => history.pushState({}, '', '/other-page.html'));
    await expect(page.locator('.hm-marker')).toHaveCount(0);

    // Navigate back → original page key → marker restored
    await page.evaluate(() => history.back());
    await expect(page.locator('.hm-marker')).toHaveCount(1);

    await page.close();
  });
});
