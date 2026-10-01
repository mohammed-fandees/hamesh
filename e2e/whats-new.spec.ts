import { test, expect, type BrowserContext } from '@playwright/test';
import { launchExtension, type ExtensionProfile } from './support/profile';

/**
 * Notes Library — What's New.
 *
 * Covers the page itself and the sidebar destination that reaches it, in
 * both interface languages, plus the `?view=whats-new` deep link the
 * background opens after an update.
 *
 * The auto-open itself is not driven here: `chrome.runtime.onInstalled`
 * fires only on a genuine install/update and has no automatable surface, the
 * same limitation `chrome.commands.onCommand` has (see core-flows). The
 * decision behind it lives in `shouldAnnounceUpdate`, which is unit-tested
 * directly; what this file proves is that the URL that listener opens really
 * does land on the page.
 *
 * Requires the extension to be built first: `pnpm build`.
 */

async function getExtensionId(context: BrowserContext): Promise<string> {
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return new URL(sw.url()).host;
}

test.describe("Notes Library — What's New", () => {
  let profile: ExtensionProfile | undefined;
  let context: BrowserContext;

  test.beforeEach(async () => {
    profile = await launchExtension('whatsnew');
    context = profile.context;
  });
  test.afterEach(async () => {
    await profile?.close();
  });

  test('sits at the bottom of the sidebar, below Library and Settings', async () => {
    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html`);

    const items = page.locator('.hm-sidebar__nav-item');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toHaveText(/Notes Library/);
    await expect(items.nth(1)).toHaveText(/Settings/);
    await expect(items.nth(2)).toHaveText(/What's New/);

    // Actually docked to the foot of the column, not just last in source.
    const settings = await items.nth(1).boundingBox();
    const whatsNew = await items.nth(2).boundingBox();
    const sidebar = await page.locator('.hm-sidebar').boundingBox();
    if (!settings || !whatsNew || !sidebar) throw new Error('no layout');
    expect(whatsNew.y).toBeGreaterThan(settings.y + 100);
    expect(sidebar.y + sidebar.height - (whatsNew.y + whatsNew.height)).toBeLessThan(60);
  });

  test('opens from the sidebar and lists every release, newest first', async () => {
    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html`);
    await page.getByRole('button', { name: "What's New" }).click();

    await expect(page.locator('h1')).toHaveText("What's New");
    // The newest entry is whatever the build ships as; asserting a literal
    // here would mean editing this test at every release.
    const versions = page.locator('.hm-whats-new__version');
    const manifestVersion = await page.evaluate(
      () =>
        (
          globalThis as unknown as {
            chrome: { runtime: { getManifest(): { version: string } } };
          }
        ).chrome.runtime.getManifest().version,
    );
    await expect(versions.first()).toHaveText(manifestVersion);
    await expect(versions.last()).toHaveText('0.1.0');
    // The newest are open; the rest of the history waits in a panel that stays
    // shut until it is wanted, and is all still there once it is opened.
    await expect(page.getByText('Video notes and folders')).toBeHidden();
    await page.locator('summary', { hasText: 'Earlier releases' }).click();
    await expect(page.getByText('Video notes and folders')).toBeVisible();

    // The installed build is marked, and it is that same manifest version.
    const installed = page.locator('.hm-whats-new__badge--installed');
    await expect(installed).toHaveCount(1);
    const marked = await installed
      .locator('xpath=../*[contains(@class,"hm-whats-new__version")]')
      .textContent();
    expect(marked).toBe(manifestVersion);
  });

  test('shows the releases in Arabic when the interface is Arabic', async () => {
    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html?view=settings`);
    await page.getByRole('radio', { name: 'Arabic' }).check();

    await page.getByRole('button', { name: 'ما الجديد' }).click();
    await expect(page.locator('h1')).toHaveText('ما الجديد');
    await page.locator('summary', { hasText: 'الإصدارات السابقة' }).click();
    await expect(page.getByText('ملاحظات الفيديو والفولدرات')).toBeVisible();
    await expect(page.locator('.hm-scope')).toHaveAttribute('dir', 'rtl');
    // Version numbers stay Latin digits — they're identifiers, not prose.
    await expect(page.locator('.hm-whats-new__version').first()).toHaveText(/^\d+\.\d+\.\d+$/);
  });

  test('the URL the background opens after an update lands directly on the page', async () => {
    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html?view=whats-new`);

    await expect(page.locator('h1')).toHaveText("What's New");
    await expect(page.getByRole('button', { name: "What's New" })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('the unread dot appears until the page is opened, then stays gone', async () => {
    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html`);

    // Nothing read yet, so there is something to see.
    await expect(page.locator('.hm-sidebar__dot')).toBeVisible();

    await page.getByRole('button', { name: "What's New" }).click();
    // The newest releases are open; the older ones sit in their own list below.
    await expect(page.locator('.hm-whats-new__list').first()).toBeVisible();

    // Opening it is reading it — and that survives a reload, since it's
    // recorded in the same preferences store as everything else.
    await page.reload();
    await expect(page.locator('.hm-sidebar__nav-item').nth(2)).toBeVisible();
    await expect(page.locator('.hm-sidebar__dot')).toHaveCount(0);
  });

  test('leaves the other views working', async () => {
    const extensionId = await getExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html?view=whats-new`);

    await page.getByRole('button', { name: 'Notes Library' }).click();
    await expect(page.locator('h1')).toHaveText('Notes Library');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('h1')).toHaveText('Settings');
    await expect(page).toHaveURL(/notes\.html\?view=whats-new$/); // same document throughout
  });
});
