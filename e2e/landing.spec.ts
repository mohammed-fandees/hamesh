import { test, expect } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const LANDING_URL = pathToFileURL(
  path.resolve(import.meta.dirname, '..', 'landing', 'index.html'),
).href;

test.describe('Landing page', () => {
  test('is Arabic-first (RTL) and has a single, meaningful h1', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('اترك السياق حيث ينتمي.');
  });

  test('language toggle switches to English (LTR) and back', async ({ page }) => {
    await page.goto(LANDING_URL);
    const toggle = page.locator('#langToggle');

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveText('Leave context where it belongs.');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('h1')).toHaveText('اترك السياق حيث ينتمي.');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('has social + descriptive metadata and the core section anchors', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /margin for the web/i,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og\.png$/);
    for (const id of ['#problem', '#how', '#experience', '#who', '#privacy', '#install']) {
      await expect(page.locator(id)).toHaveCount(1);
    }
  });
});
