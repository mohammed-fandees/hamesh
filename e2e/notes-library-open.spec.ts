import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Notes Library — Open Note flow (PR2).
 *
 * Proves the real cross-tab CONTENT_READY/RESTORE_NOTE handshake (see
 * src/entrypoints/notes/openNote.ts, src/entrypoints/content.ts,
 * src/content/HameshApp.tsx) works end to end in a real browser: clicking a
 * note in the Notes Library opens the note's original page in a new tab and
 * restores it there — scrolls to it, highlights it, opens it — without any
 * fixed wait. jsdom-based component tests can't exercise the real
 * cross-tab timing this depends on, so this is the one place that does.
 *
 * Requires the extension to be built first: `pnpm build`.
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
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamesh-e2e-notes-'));
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

async function createNote(page: Page, testId: string, text: string): Promise<void> {
  // Scroll the target into view *before* activating selection mode — its
  // bounding box (used below to compute click coordinates) is viewport-
  // relative, and the point of this test is a target that starts below the
  // fold (so restoring it later requires a real scroll).
  await page.locator(`[data-testid="${testId}"]`).scrollIntoViewIfNeeded();
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
  await page.locator('.hm-card textarea').fill(text);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.hm-marker')).toHaveCount(1);
}

async function getExtensionId(context: BrowserContext): Promise<string> {
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return new URL(sw.url()).host;
}

/** Opens the (already saved) note's marker and pins it from the viewer —
 *  the only place pinning is toggled (PR3). */
async function pinNote(page: Page): Promise<void> {
  await page.locator('.hm-marker').first().click();
  await expect(page.locator('.hm-card')).toBeVisible();
  await page.getByRole('button', { name: 'Pin this note' }).click();
  await expect(page.getByRole('button', { name: 'Unpin this note' })).toBeVisible();
  await page.keyboard.press('Escape');
}

test.describe('Notes Library — Open Note flow', () => {
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

  test('clicking a note in the Notes Library opens a new tab and restores the note there', async () => {
    const extensionId = await getExtensionId(context);

    // Create a note on an element below the fold, so restoring it requires
    // an actual scroll (para-two sits after a 400px spacer in the fixture).
    const sourcePage = await context.newPage();
    await installReadinessHook(sourcePage);
    await sourcePage.goto(server.url);
    const noteText = 'Restored via the Open Note flow.';
    await createNote(sourcePage, 'para-two', noteText);
    await sourcePage.close();

    // Open the Notes Library and drill into the note.
    const library = await context.newPage();
    await library.goto(`chrome-extension://${extensionId}/notes.html`);
    await library.getByRole('button', { name: /127\.0\.0\.1/ }).click();
    const noteLink = library.locator('.hm-note-row', { hasText: noteText });
    await expect(noteLink).toBeVisible();

    // Click opens a *new* tab — capture it and the library tab both stay open.
    const [restoredPage] = await Promise.all([context.waitForEvent('page'), noteLink.click()]);
    await restoredPage.waitForLoadState('domcontentloaded');
    expect(new URL(restoredPage.url()).pathname).toBe('/test-page.html');

    // The note viewer opens automatically on the restored page — no manual
    // re-activation — proving the CONTENT_READY/RESTORE_NOTE handshake
    // actually completed (not a fixed-wait guess).
    await expect(restoredPage.locator('.hm-card .hm-note-body')).toHaveText(noteText, {
      timeout: 10000,
    });

    // And the target element was actually scrolled into view (it starts
    // below the fold at page load). `scrollIntoView({ behavior: 'smooth' })`
    // animates asynchronously, so poll rather than asserting immediately.
    await expect
      .poll(() => restoredPage.evaluate(() => window.scrollY), { timeout: 5000 })
      .toBeGreaterThan(0);

    expect(library.isClosed()).toBe(false);
  });

  test('clicking a Continue card also opens and restores the note', async () => {
    const extensionId = await getExtensionId(context);

    const sourcePage = await context.newPage();
    await installReadinessHook(sourcePage);
    await sourcePage.goto(server.url);
    const noteText = 'Reached via the Continue shortcut.';
    await createNote(sourcePage, 'article-heading', noteText);
    await sourcePage.close();

    const library = await context.newPage();
    await library.goto(`chrome-extension://${extensionId}/notes.html`);
    const continueCard = library.locator('.hm-continue__item').first();
    await expect(continueCard).toBeVisible();

    const [restoredPage] = await Promise.all([context.waitForEvent('page'), continueCard.click()]);
    await restoredPage.waitForLoadState('domcontentloaded');

    await expect(restoredPage.locator('.hm-card .hm-note-body')).toHaveText(noteText, {
      timeout: 10000,
    });
  });

  test('pinning a note from the page surfaces it in the Notes Library Pinned section', async () => {
    const extensionId = await getExtensionId(context);

    const sourcePage = await context.newPage();
    await installReadinessHook(sourcePage);
    await sourcePage.goto(server.url);
    const pinnedText = 'This one is pinned.';
    await createNote(sourcePage, 'article-heading', pinnedText);
    const unpinnedText = 'This one is not.';
    await createNote(sourcePage, 'para-one', unpinnedText);
    await pinNote(sourcePage);
    await sourcePage.close();

    const library = await context.newPage();
    await library.goto(`chrome-extension://${extensionId}/notes.html`);

    const pinnedSection = library.getByRole('region', { name: 'Pinned' });
    await expect(pinnedSection).toBeVisible();
    await expect(pinnedSection).toContainText(pinnedText);
    await expect(pinnedSection).not.toContainText(unpinnedText);

    // Clicking the pinned entry restores it too, same as any other note.
    const [restoredPage] = await Promise.all([
      context.waitForEvent('page'),
      pinnedSection.locator('.hm-pinned__item').click(),
    ]);
    await expect(restoredPage.locator('.hm-card .hm-note-body')).toHaveText(pinnedText, {
      timeout: 10000,
    });
  });
});
