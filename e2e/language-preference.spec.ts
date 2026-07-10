import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Verifies the Phase 2 language preference actually reaches the live
 * content-script UI in an already-open tab — the real behavior `storage.watch`
 * is responsible for (see src/storage/preferences-repository.ts). The popup
 * itself isn't automatable here (see core-flows.spec.ts's own note on this),
 * so the preference write is issued from the background service worker,
 * exactly the same `chrome.storage.local` write the popup's "setLanguage"
 * ultimately performs.
 */

const EXTENSION_PATH = path.resolve(import.meta.dirname, '..', '.output', 'chrome-mv3');
const FIXTURE_HTML = fs.readFileSync(
  path.resolve(import.meta.dirname, 'fixtures', 'test-page.html'),
  'utf8',
);

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
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamesh-e2e-lang-'));
  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });
}

async function installReadinessHook(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as Window & { __hameshReadyPromise?: Promise<void> }).__hameshReadyPromise =
      new Promise<void>((resolve) => {
        window.addEventListener('hamesh:ready', () => resolve(), { once: true });
      });
  });
}

async function waitForHameshReady(page: Page): Promise<void> {
  await page.evaluate(
    () => (window as Window & { __hameshReadyPromise?: Promise<void> }).__hameshReadyPromise,
  );
}

/** Activates selection mode and hovers a page element, which is what actually
 *  renders the `.hm-hint` tooltip (see HameshApp's `hover` state). */
async function activateAndHover(page: Page, testId = 'article-heading'): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));
  await expect(page.locator('.hm-capture')).toBeVisible();
  const box = await page.locator(`[data-testid="${testId}"]`).boundingBox();
  if (!box) throw new Error(`no box for ${testId}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

/** Writes the preferences key exactly as the repository does — the raw
 *  chrome.storage.local key with the `local:` storage-area prefix stripped
 *  (see @wxt-dev/storage's key resolution). Run from the background service
 *  worker, which has unrestricted `chrome.storage` access; `chrome` isn't
 *  typed in this Node/Playwright context, hence the narrow local cast. */
async function setStoredPreference(
  worker: Worker,
  value: { schemaVersion: number; language: string | null },
): Promise<void> {
  await worker.evaluate((v) => {
    const ext = globalThis as unknown as {
      chrome: { storage: { local: { set: (items: Record<string, unknown>) => Promise<void> } } };
    };
    return ext.chrome.storage.local.set({ 'hamesh:preferences': v });
  }, value);
}

test.describe('Hamesh language preference', () => {
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

  test('setting the language propagates live to an already-open tab, no reload needed', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);

    // Default: no stored preference → browser UI language (en in this
    // launch profile) → LTR selection UI.
    await activateAndHover(page);
    await expect(page.locator('.hm-hint')).toContainText('Click to add a note');
    await expect(page.locator('.hm-scope[dir]')).toHaveAttribute('dir', 'ltr');
    await page.keyboard.press('Escape');

    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');

    // What the popup's "Arabic" selection ultimately does: persist to the
    // same chrome.storage.local key the repository writes.
    await setStoredPreference(worker, { schemaVersion: 1, language: 'ar' });

    // No reload: the already-open tab's content script should pick this up
    // via storage.watch and re-render in Arabic/RTL immediately.
    await expect(page.locator('.hm-scope[dir]')).toHaveAttribute('dir', 'rtl');
    await activateAndHover(page);
    await expect(page.locator('.hm-hint')).toContainText('انقر لإضافة ملاحظة');
    await page.keyboard.press('Escape');

    // Switching back to English also propagates live.
    await setStoredPreference(worker, { schemaVersion: 1, language: 'en' });
    await expect(page.locator('.hm-scope[dir]')).toHaveAttribute('dir', 'ltr');

    await page.close();
  });

  test('an unknown or malformed stored preference falls back to the browser UI language, not a broken state', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);

    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await setStoredPreference(worker, { schemaVersion: 1, language: 'fr' });

    await page.goto(server.url);
    await waitForHameshReady(page);
    await activateAndHover(page);

    await expect(page.locator('.hm-scope[dir]')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('.hm-hint')).toContainText('Click to add a note');

    await page.close();
  });
});
