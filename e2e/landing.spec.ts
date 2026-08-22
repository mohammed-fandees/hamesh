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
  test('serves a favicon in every form it links', async ({ page }) => {
    await page.goto(origin);

    const links = await page.locator('link[rel*="icon"]').evaluateAll((els) =>
      els.map((el) => ({
        rel: el.getAttribute('rel')!,
        href: (el as HTMLLinkElement).getAttribute('href')!,
      })),
    );
    expect(links.map((l) => l.rel).sort()).toEqual(['apple-touch-icon', 'icon', 'icon']);

    // Linking a file that 404s is the same as having no favicon at all, which
    // is how this page shipped: it linked none, while privacy.html carried an
    // inline data URI nobody else could share.
    for (const { href } of links) {
      const response = await page.request.get(new URL(href, origin).href);
      expect(response.status(), href).toBe(200);
    }

    // A bare request never consults the document.
    expect((await page.request.get(new URL('./favicon.ico', origin).href)).status()).toBe(200);
  });

  test('never shows the page before its animations are ready', async ({ page }) => {
    await page.goto(origin, { waitUntil: 'commit' });

    // Sampled from the first commit until the page hands over, rather than
    // for a fixed window: on a cold start the hand-over can happen later than
    // any window worth hard-coding, and a test that fails for being early is
    // worse than no test.
    //
    // The invariant is not *when* the heading appears but that it never
    // appears while the page still calls itself loading — painted in its
    // finished position, then yanked back to the start of its entrance.
    // Opacity as well as visibility: an element parked at the start of its
    // own `from` tween is `visibility: visible` and completely invisible.
    const read = () =>
      page
        .evaluate(() => {
          const h1 = document.querySelector('h1');
          if (!h1) return null;
          const style = getComputedStyle(h1);
          return {
            loading: document.documentElement.classList.contains('is-loading'),
            shown: style.visibility === 'visible' && Number(style.opacity) > 0.9,
          };
        })
        .catch(() => null);

    const samples: Array<{ loading: boolean; shown: boolean }> = [];
    const deadline = Date.now() + 15000;
    let settled = false;
    while (Date.now() < deadline && !settled) {
      const state = await read();
      if (state) {
        samples.push(state);
        settled = !state.loading && state.shown;
      }
      if (!settled) await page.waitForTimeout(60);
    }

    expect(samples.length).toBeGreaterThan(2);
    expect(settled, 'the page never finished loading').toBe(true);
    expect(samples.filter((s) => s.loading && s.shown)).toEqual([]);

    await expect(page.locator('.loader')).toHaveCount(0);
  });

  test('still shows the page when the animation engine fails to load', async ({ page }) => {
    // Animations are an enhancement. A visitor left staring at a loading
    // screen because one script did not arrive has been given the worst
    // possible version of one.
    await page.route('**/vendor/gsap.min.js', (route) => route.abort());
    await page.goto(origin);

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const style = getComputedStyle(document.querySelector('h1')!);
            return style.visibility === 'visible' && Number(style.opacity) > 0.9;
          }),
        { timeout: 8000 },
      )
      .toBe(true);
  });

  test('animations never widen the document, in either language', async ({ page }) => {
    // Five combinations, each of which has to sit through a full demo cycle.
    test.setTimeout(120000);
    // Both languages: the hero's wash used to drift 4% to the right, which
    // extends the document in LTR and not in RTL, so an Arabic-only test saw
    // nothing while English grew a little further every cycle.
    for (const [lang, width] of [
      ['ar', 320],
      ['ar', 390],
      ['en', 390],
      ['en', 768],
      ['en', 1280],
    ] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript((value) => localStorage.setItem('hamesh-lang', value), lang);
      await page.goto(origin);
      await page.waitForTimeout(1500);

      // The page guards itself with `overflow-x: hidden`; lifting it here is
      // the difference between testing the fix and testing the guard.
      await page.evaluate(() => {
        document.body.style.overflowX = 'visible';
        const w = window as unknown as { __max: number };
        w.__max = window.innerWidth;
        setInterval(() => {
          const sw = document.documentElement.scrollWidth;
          if (sw > w.__max) w.__max = sw;
        }, 100);
      });

      for (const id of ['#feature-1', '#feature-3', '#feature-5']) {
        await page.evaluate((sel) => document.querySelector(sel)!.scrollIntoView(), id);
        await page.waitForTimeout(1800);
      }

      const { max, vw } = await page.evaluate(() => ({
        max: (window as unknown as { __max: number }).__max,
        vw: window.innerWidth,
      }));
      expect(max, `document grew sideways at ${width}px in ${lang}`).toBeLessThanOrEqual(vw);
    }
  });

  test('the annotated phrase never breaks across lines', async ({ page }) => {
    // An inline box that wraps hands its absolutely positioned children a
    // containing block spanning every fragment, so the selection sweep
    // becomes a rectangle over the whole paragraph rather than a band across
    // the words. It showed up on a real phone and not in a desktop window of
    // the same width, because the wrap point depends on font metrics.
    for (const [lang, width] of [
      ['ar', 320],
      ['ar', 375],
      ['en', 320],
      ['en', 390],
    ] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript((value) => localStorage.setItem('hamesh-lang', value), lang);
      await page.goto(origin);
      await page.waitForTimeout(1200);

      const target = await page.evaluate(() => {
        const el = document.querySelector('.hero [data-el="target"]') as HTMLElement;
        const style = getComputedStyle(el);
        return {
          fragments: el.getClientRects().length,
          height: el.getBoundingClientRect().height,
          lineHeight: parseFloat(style.lineHeight) || 20,
        };
      });

      expect(target.fragments, `phrase wrapped at ${width}px in ${lang}`).toBe(1);
      expect(target.height).toBeLessThan(target.lineHeight * 1.6);
    }
  });

  test('the margin mark stays inside the page it annotates', async ({ page }) => {
    test.setTimeout(90000);
    // It is docked in the page's own margin, the way the extension docks it.
    // Placed outside the window it gets cut in half by the containment that
    // stops demos widening the document.
    for (const lang of ['ar', 'en'] as const) {
      await page.setViewportSize({ width: 390, height: 860 });
      await page.addInitScript((value) => localStorage.setItem('hamesh-lang', value), lang);
      await page.goto(origin);

      const mark = await page.evaluate(async () => {
        const el = document.querySelector('.hero [data-el="margin-mark"]') as HTMLElement;
        const win = document.querySelector('.hero .ui-window') as HTMLElement;
        const began = Date.now();
        while (Date.now() - began < 25000) {
          if (Number(getComputedStyle(el).opacity) > 0.6) {
            const m = el.getBoundingClientRect();
            const w = win.getBoundingClientRect();
            return { left: m.left - w.left, right: w.right - m.right };
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        return null;
      });

      expect(mark, `the mark never appeared in ${lang}`).not.toBeNull();
      expect(mark!.left, `mark escaped the window's start edge in ${lang}`).toBeGreaterThan(-1);
      expect(mark!.right, `mark escaped the window's end edge in ${lang}`).toBeGreaterThan(-1);
    }
  });

  test('the hero demo starts once, rather than starting again after the loader', async ({
    page,
  }) => {
    await page.goto(origin, { waitUntil: 'commit' });

    // The visibility observer used to start the demo behind the loading
    // screen, and the intro then restarted it in front of the visitor — which
    // reads as the animation glitching and beginning again.
    const starts = await page.evaluate(async () => {
      const seen: number[] = [];
      let previous = 1;
      const began = Date.now();
      while (Date.now() - began < 8000) {
        const cursor = document.querySelector('.hero .demo-cursor') as HTMLElement | null;
        const now = cursor ? Number(getComputedStyle(cursor).opacity) : 0;
        // The cursor fades in at the top of each cycle; two rises this early
        // means it was restarted, not resumed.
        if (previous < 0.05 && now > 0.2) seen.push(Date.now() - began);
        previous = now;
        await new Promise((r) => setTimeout(r, 60));
      }
      return seen;
    });

    expect(starts.length, `the story began ${starts.length} times`).toBe(1);
  });
});
