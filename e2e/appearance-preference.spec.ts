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
 * Verifies the Phase 3 appearance preference against the real content-script
 * UI in a loaded Chromium extension — "Match website" (the pre-existing
 * adaptive behavior, still the default), forced Light/Dark overriding the
 * host page, live propagation to an already-open tab, and a
 * malformed-stored-value fallback. Same approach as
 * language-preference.spec.ts: the popup isn't reliably automatable, so
 * preference writes are issued from the background service worker — the
 * same chrome.storage.local write the popup's "setAppearance" performs.
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
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamesh-e2e-appearance-'));
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

async function activateAndSelect(page: Page, testId: string): Promise<void> {
  await waitForHameshReady(page);
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

/** Writes the preferences key exactly as the repository does — the raw
 *  chrome.storage.local key with the `local:` storage-area prefix stripped
 *  (see @wxt-dev/storage's key resolution). Run from the background service
 *  worker, which has unrestricted `chrome.storage` access; `chrome` isn't
 *  typed in this Node/Playwright context, hence the narrow local cast. */
async function setStoredPreference(worker: Worker, value: Record<string, unknown>): Promise<void> {
  await worker.evaluate((v) => {
    const ext = globalThis as unknown as {
      chrome: { storage: { local: { set: (items: Record<string, unknown>) => Promise<void> } } };
    };
    return ext.chrome.storage.local.set({ 'hamesh:preferences': v });
  }, value);
}

async function getWorker(context: BrowserContext): Promise<Worker> {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  return worker;
}

async function setHostDark(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.body.style.backgroundColor = 'rgb(20, 18, 15)';
  });
}

test.describe('Hamesh appearance preference', () => {
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

  test('Match Website is the default and preserves the adaptive light/dark behavior', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);

    // The fixture page has no explicit background — resolves via the OS
    // preference, which is light by default in this launch profile.
    await expect(page.locator('.hm-scope[data-hm-theme]')).toHaveAttribute(
      'data-hm-theme',
      'light',
    );

    // The host page dynamically going dark (e.g. its own theme toggle,
    // theme CSS loading async) is picked up live via the attribute
    // MutationObserver in HameshApp — no reload needed.
    await setHostDark(page);
    await expect(page.locator('.hm-scope[data-hm-theme]')).toHaveAttribute('data-hm-theme', 'dark');

    await page.close();
  });

  test('forced Light overrides a dark host page', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);
    await setHostDark(page);
    await expect(page.locator('.hm-scope[data-hm-theme]')).toHaveAttribute('data-hm-theme', 'dark');

    const worker = await getWorker(context);
    await setStoredPreference(worker, { schemaVersion: 1, language: null, appearance: 'light' });

    await expect(page.locator('.hm-scope[data-hm-theme]')).toHaveAttribute(
      'data-hm-theme',
      'light',
    );

    await page.close();
  });

  test('forced Dark overrides a light host page', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);
    await expect(page.locator('.hm-scope[data-hm-theme]')).toHaveAttribute(
      'data-hm-theme',
      'light',
    );

    const worker = await getWorker(context);
    await setStoredPreference(worker, { schemaVersion: 1, language: null, appearance: 'dark' });

    await expect(page.locator('.hm-scope[data-hm-theme]')).toHaveAttribute('data-hm-theme', 'dark');

    await page.close();
  });

  test('appearance propagates live to an already-open tab in both directions, no reload needed', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);

    const worker = await getWorker(context);
    await setStoredPreference(worker, { schemaVersion: 1, language: null, appearance: 'dark' });
    await expect(page.locator('.hm-scope[data-hm-theme]')).toHaveAttribute('data-hm-theme', 'dark');

    await setStoredPreference(worker, {
      schemaVersion: 1,
      language: null,
      appearance: 'match-website',
    });
    await expect(page.locator('.hm-scope[data-hm-theme]')).toHaveAttribute(
      'data-hm-theme',
      'light',
    );

    await page.close();
  });

  test('a malformed or unknown stored appearance value falls back to Match Website, not a broken state', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);

    const worker = await getWorker(context);
    await setStoredPreference(worker, { appearance: 'auto' });

    await page.goto(server.url);
    await waitForHameshReady(page);
    await expect(page.locator('.hm-scope[data-hm-theme]')).toHaveAttribute(
      'data-hm-theme',
      'light',
    );

    await page.close();
  });

  test('note creation, restoration, editing, and deletion are unaffected by a forced Dark appearance', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);

    const worker = await getWorker(context);
    await setStoredPreference(worker, { schemaVersion: 1, language: null, appearance: 'dark' });

    await page.goto(server.url);
    await waitForHameshReady(page);
    await expect(page.locator('.hm-scope[data-hm-theme]')).toHaveAttribute('data-hm-theme', 'dark');

    const content = 'A note created while Hamesh is forced into dark appearance.';
    await activateAndSelect(page, 'article-heading');
    await page.locator('.hm-card textarea').fill(content);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.hm-marker')).toHaveCount(1);

    await page.reload();
    await waitForHameshReady(page);
    await expect(page.locator('.hm-marker')).toHaveCount(1);
    await expect(page.locator('.hm-scope[data-hm-theme]')).toHaveAttribute('data-hm-theme', 'dark');

    await page.locator('.hm-marker').click();
    await expect(page.locator('.hm-card .hm-note-body')).toHaveText(content);
    await page.getByRole('button', { name: 'Edit' }).click();
    const edited = 'Edited while still forced dark.';
    await page.locator('.hm-card textarea').fill(edited);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('.hm-card .hm-note-body')).toHaveText(edited);

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('.hm-marker')).toHaveCount(0);

    await page.close();
  });
});
