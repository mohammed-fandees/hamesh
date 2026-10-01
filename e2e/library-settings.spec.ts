import { test, expect, type BrowserContext } from '@playwright/test';
import { launchExtension, type ExtensionProfile } from './support/profile';

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

async function getExtensionId(context: BrowserContext): Promise<string> {
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return new URL(sw.url()).host;
}

test.describe('Notes Library — sidebar + Settings', () => {
  let profile: ExtensionProfile | undefined;
  let context: BrowserContext;

  test.beforeEach(async () => {
    profile = await launchExtension('settings');
    context = profile.context;
  });
  test.afterEach(async () => {
    await profile?.close();
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

  test('Settings shows every shortcut with its manifest-declared binding', async () => {
    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html`);
    await page.getByRole('button', { name: 'Settings' }).click();

    const rows = page.locator('.hm-setting-row');
    // Exact text: "Add a note" is a prefix of "Add a note to selected text".
    await expect(rows.filter({ hasText: /^Add a note/ }).first()).toContainText('Alt+H');
    await expect(rows.filter({ hasText: 'Add a video note' })).toContainText('Alt+V');
    await expect(rows.filter({ hasText: 'Add a note to selected text' })).toContainText('Alt+T');
  });

  test('Settings exposes the contextual text note toggles, both on by default', async () => {
    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html`);
    await page.getByRole('button', { name: 'Settings' }).click();

    // On/off settings are switches.
    const feature = page.getByRole('switch', { name: 'Notes on selected text' });
    const chip = page.getByRole('switch', { name: 'Show icon after selecting' });
    await expect(feature).toHaveAttribute('aria-checked', 'true');
    await expect(chip).toHaveAttribute('aria-checked', 'true');

    // Turning the automatic chip off is persisted, not just local state.
    await chip.click();
    await expect(chip).toHaveAttribute('aria-checked', 'false');
    await page.reload();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('switch', { name: 'Show icon after selecting' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(page.getByRole('switch', { name: 'Notes on selected text' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
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

  test('notes.html?view=settings opens directly to Settings, not Library', async () => {
    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html?view=settings`);
    await expect(page.locator('h1')).toHaveText('Settings');
  });

  test("the popup's Settings pane links out to the full Settings page", async () => {
    const extensionId = await getExtensionId(context);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.getByRole('button', { name: 'Settings' }).click();

    const [libraryPage] = await Promise.all([
      context.waitForEvent('page'),
      popup.getByRole('button', { name: 'Open full settings' }).click(),
    ]);
    await libraryPage.waitForLoadState('domcontentloaded');
    expect(new URL(libraryPage.url()).search).toBe('?view=settings');
    await expect(libraryPage.locator('h1')).toHaveText('Settings');
  });
});
