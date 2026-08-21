import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * The landing page, served over HTTP.
 *
 * Not `file://`, which is how this suite used to load it: the page is built
 * from ES modules, and a module fetched from a file URL is blocked as
 * cross-origin, so the whole page would load with none of its JavaScript
 * running. Every test here would still have passed — against a page that was
 * inert.
 */

const ROOT = path.resolve(import.meta.dirname, '..', 'landing');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

let server: http.Server;
let origin: string;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    let pathname = (req.url ?? '/').split('?')[0];
    if (pathname === '/') pathname = '/index.html';

    const file = path.join(ROOT, decodeURIComponent(pathname));
    if (!file.startsWith(ROOT)) {
      res.statusCode = 403;
      res.end('forbidden');
      return;
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      res.setHeader(
        'Content-Type',
        CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
      );
      res.end(data);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.describe('Landing page', () => {
  test('is Arabic-first (RTL) and has a single, meaningful h1', async ({ page }) => {
    await page.goto(origin);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('اترك السياق حيث ينتمي.');
  });

  test('language toggle switches to English (LTR) and back', async ({ page }) => {
    await page.goto(origin);
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

  test('has social + descriptive metadata and one section per feature', async ({ page }) => {
    await page.goto(origin);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /margin for the web/i,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og\.png$/);

    for (const id of [
      '#feature-1',
      '#feature-2',
      '#feature-3',
      '#feature-4',
      '#feature-5',
      '#privacy',
      '#install',
    ]) {
      await expect(page.locator(id)).toHaveCount(1);
    }
  });

  test('the install link is reachable without scrolling', async ({ page }) => {
    await page.goto(origin);

    // The whole point of the page's order: a user reported having to read and
    // scroll before they could find out how to get the thing.
    const cta = page.getByRole('link', { name: /Chrome/ }).first();
    await expect(cta).toBeVisible();

    const box = await cta.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThan(viewport!.height);
  });

  test('every demo runs its story', async ({ page }) => {
    await page.goto(origin);

    // Each scene is built from real elements and animated by GSAP, so the
    // evidence that a demo is alive is its cursor or its keyboard hint
    // becoming visible. Scenes start when scrolled into view.
    for (const scene of ['contextual', 'element', 'quick', 'library', 'folders']) {
      const selector = `[data-scene="${scene}"]`;
      await page.locator(selector).scrollIntoViewIfNeeded();

      const moved = await page.waitForFunction(
        (sel) => {
          const root = document.querySelector(sel as string);
          if (!root) return false;
          // The video demo is keyboard-driven and has no cursor; its hint is
          // the equivalent tell.
          const actor = root.querySelector('.demo-cursor') ?? root.querySelector('.ui-hint');
          return actor ? Number(getComputedStyle(actor).opacity) > 0.05 : false;
        },
        selector,
        { timeout: 15000 },
      );
      expect(await moved.jsonValue()).toBeTruthy();
    }
  });

  test('does not scroll sideways on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto(origin);

    // Regression: the skip link was parked at `inset-inline-start: -9999px`,
    // which in RTL is ten thousand pixels off the *right* edge.
    await expect(page.locator('.site-nav')).toBeHidden();
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);
  });
});
