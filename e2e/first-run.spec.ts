import { test, expect, type BrowserContext } from '@playwright/test';
import { launchExtension, type ExtensionProfile } from './support/profile';

async function guideTab(context: BrowserContext) {
  await expect
    .poll(() => context.pages().find((page) => page.url().includes('view=start')) ?? null, {
      timeout: 15_000,
    })
    .not.toBeNull();
  return context.pages().find((page) => page.url().includes('view=start'))!;
}

test.describe('A first install', () => {
  let profile: ExtensionProfile;

  test.beforeEach(async () => {
    profile = await launchExtension('first-run', { keepGuide: true });
  });
  test.afterEach(async () => {
    await profile.close();
  });

  test('opens the guide, with the real shortcuts and nothing ticked', async () => {
    const page = await guideTab(profile.context);
    await expect(page.locator('h1')).toHaveText('Getting started');
    await expect(page.locator('.hm-steps').first()).toContainText('Alt+H');
    await expect(page.locator('.hm-step[data-done]')).toHaveCount(0);
  });

  test('stays where the reader is across a reload, and back walks home', async () => {
    const page = await guideTab(profile.context);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.locator('h1')).toHaveText('Settings');
    await page.reload();
    await expect(page.locator('h1')).toHaveText('Settings');
    await page.goBack();
    await expect(page.locator('h1')).toHaveText('Getting started');
  });

  test('keeps a card in the Library until it is put away, for good', async () => {
    const page = await guideTab(profile.context);
    await page.getByRole('button', { name: 'Notes Library', exact: true }).click();
    await expect(page.locator('.hm-guide-card')).toBeVisible();
    await page.getByRole('button', { name: 'Hide the guide' }).click();
    await expect(page.locator('.hm-guide-card')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('h1')).toHaveText('Notes Library');
    await expect(page.locator('.hm-guide-card')).toHaveCount(0);
  });
});
