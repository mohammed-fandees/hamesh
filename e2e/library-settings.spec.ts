import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

/**
 * Notes Library — sidebar navigation + Settings view.
 *
 * Settings moved from popup-only to a permanent sidebar view in the Notes
 * Library page, alongside a new Shortcuts section. Chrome has no API for an
 * extension to change its own keyboard shortcut (`chrome.commands` exposes
 * only `getAll`/`onCommand` — confirmed directly against this repo's
 * bundled Chromium; `update`/`reset` are Firefox-only), so this only proves
 * the read side (the two commands declared in wxt.config.ts show up with
 * their manifest-declared shortcuts) and the link out to Chrome's own
 * shortcuts page. No content-script fixture page is needed — the whole
 * flow lives inside the extension's own notes.html.
 *
 * Requires the extension to be built first: `pnpm build`.
 */

const EXTENSION_PATH = path.resolve(import.meta.dirname, '..', '.output', 'chrome-mv3');

async function launch(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamesh-e2e-settings-'));
  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });
}

async function getExtensionId(context: BrowserContext): Promise<string> {
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return new URL(sw.url()).host;
}

test.describe('Notes Library — sidebar + Settings', () => {
  let context: BrowserContext;

  test.beforeEach(async () => {
    context = await launch();
  });
  test.afterEach(async () => {
    await context.close();
  });

  test('the sidebar switches between Library and Settings without navigating away', async () => {
    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html`);

    await expect(page.locator('h1')).toHaveText('Notes Library');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('h1')).toHaveText('Settings');
    await expect(page).toHaveURL(/notes\.html$/); // same document, not a navigation

    await page.getByRole('button', { name: 'Notes Library' }).click();
    await expect(page.locator('h1')).toHaveText('Notes Library');
  });

  test('Settings shows both shortcuts with their manifest-declared bindings', async () => {
    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html`);
    await page.getByRole('button', { name: 'Settings' }).click();

    const rows = page.locator('.hm-setting-row');
    await expect(rows.filter({ hasText: 'Add a note' })).toContainText('Alt+H');
    await expect(rows.filter({ hasText: 'Add a video note' })).toContainText('Alt+V');
  });

  test('the Chrome settings link opens chrome://extensions/shortcuts in a new tab', async () => {
    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html`);
    await page.getByRole('button', { name: 'Settings' }).click();

    const [shortcutsPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'Change in Chrome settings' }).click(),
    ]);
    await shortcutsPage.waitForLoadState('domcontentloaded');
    expect(shortcutsPage.url()).toBe('chrome://extensions/shortcuts');
  });

  test('switching language in Settings mirrors the sidebar and settings copy into Arabic/RTL', async () => {
    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html`);
    await page.getByRole('button', { name: 'Settings' }).click();

    await page.getByRole('radio', { name: 'Arabic' }).check();
    await expect(page.locator('h1')).toHaveText('الإعدادات');
    await expect(page.getByRole('button', { name: 'مكتبة الملاحظات' })).toBeVisible();
    await expect(page.locator('.hm-scope')).toHaveAttribute('dir', 'rtl');

    // The setting persists across a reload (same preferences store as the
    // popup — see prefsRepo — not something local to this render).
    await page.reload();
    await expect(page.locator('.hm-scope')).toHaveAttribute('dir', 'rtl');
  });
});
