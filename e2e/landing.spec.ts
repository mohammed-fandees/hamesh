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

/**
 * `GET /v1/plans?v=3`, as the live server answers it — with placeholder
 * payment details: the page must never show them, and this repo never holds
 * real ones.
 */
const PLANS_V3 = {
  plans: [
    {
      code: 'teams-free',
      price: { amountMinor: 0, currency: 'EGP', periodDays: 30 },
      limits: { ownedTeams: 1, membersPerTeam: 10, notesPerTeam: 5000 },
      details: {
        name: { ar: 'المجانية', en: 'Free' },
        description: { ar: 'فريقك الأول، تقرأ فيه مع من تختار.', en: 'Your first team.' },
      },
      discount: null,
    },
    {
      code: 'teams',
      price: { amountMinor: 14900, currency: 'EGP', periodDays: 30 },
      limits: { ownedTeams: 3, membersPerTeam: 10, notesPerTeam: 5000 },
      details: { name: { ar: 'الموسّعة', en: 'Plus' }, description: null },
      discount: {
        kind: 'amount',
        percent: null,
        listAmountMinor: 24900,
        endsAt: Date.UTC(2026, 10, 10, 12),
        label: { ar: 'سعر الإطلاق', en: 'Launch price' },
      },
    },
  ],
  payment: {
    accounts: [{ method: 'instapay', account: '01000000000' }],
    confirm: { whatsapp: '+201000000000' },
  },
  terms: {
    version: 'test-terms',
    termsUrl: 'https://hamesh.fandees.tech/terms.html',
    privacyUrl: 'https://hamesh.fandees.tech/privacy.html',
  },
};
const PLANS_URL = 'https://api.hamesh.fandees.tech/v1/plans?v=3';

/** No test reaches the real API: every one gets the answer above unless it says otherwise. */
test.beforeEach(async ({ page }) => {
  await page.route('https://api.hamesh.fandees.tech/**', (route) =>
    route.fulfill({ json: PLANS_V3, headers: { 'access-control-allow-origin': '*' } }),
  );
});

test.describe('Landing page · plans', () => {
  test('draws your own card and then the server’s plans, and never where to pay', async ({
    page,
  }) => {
    const asked = page.waitForRequest(PLANS_URL);
    await page.goto(origin);
    expect((await asked).url()).toBe(PLANS_URL);

    const section = page.locator('#plans');
    const free = section.locator('[data-plan="teams-free"]');
    const paid = section.locator('[data-plan="teams"]');
    await expect(free).toBeVisible();
    await expect(section.locator('[data-plans]')).not.toHaveAttribute('aria-busy');

    await expect(section.locator('.tier')).toHaveCount(3);
    await expect(section.locator('.tier').first()).toHaveAttribute('data-tier-own', '');
    await expect(free.locator('.tier__title')).toHaveText('الفرق · المجانية');
    await expect(free.locator('.tier__price strong')).toHaveText(/(0|٠)/);
    await expect(free.locator('.tier__desc')).toHaveText('فريقك الأول، تقرأ فيه مع من تختار.');
    await expect(free).not.toHaveClass(/tier--featured/);

    await expect(paid).toHaveClass(/tier--featured/);
    await expect(paid.locator('.tier__desc')).toHaveCount(0);
    // The price and the one before it are the server's, formatted for Arabic (the digits are the browser's choice).
    await expect(paid.locator('.tier__price strong')).toHaveText(/149|١٤٩/);
    await expect(paid.locator('.tier__price s')).toHaveText(/249|٢٤٩/);
    await expect(paid.locator('.tier__deal')).toContainText('سعر الإطلاق');
    await expect(paid.locator('.tier__list li')).toHaveText([
      'فرق تملكها: 3',
      'الأعضاء في كل فريق: 10',
      'الملاحظات في كل فريق: 5,000',
      'تبدأ فور قبول الدفعة',
    ]);

    const text = (await page.locator('body').innerText()).replace(/\s/g, '');
    expect(text).not.toContain('01000000000');
    expect(text).not.toContain('+201000000000');
    await expect(section.locator('[data-plans-unavailable]')).toBeHidden();
  });

  test('redraws the plans in English when the language is switched', async ({ page }) => {
    await page.goto(origin);
    const paid = page.locator('#plans [data-plan="teams"]');
    await expect(paid.locator('.tier__name')).toHaveText('الموسّعة');

    await page.locator('#langToggle').click();
    await expect(paid.locator('.tier__name')).toHaveText('Plus');
    await expect(paid.locator('.tier__price strong')).toHaveText(/EGP\s?149\.00/);
    await expect(paid.locator('.tier__deal')).toHaveText('Launch price · until Nov 10, 2026');
    await expect(page.locator('#plans [data-plan="teams-free"] .tier__title')).toHaveText(
      'Teams · Free',
    );
    await expect(page.locator('#plans [data-tier-own] h3')).toHaveText('For yourself');
  });

  test('shows the same cards without prices when the server cannot be reached', async ({
    page,
  }) => {
    await page.route(PLANS_URL, (route) => route.fulfill({ status: 503, json: { error: 'x' } }));
    await page.goto(origin);
    const section = page.locator('#plans');
    await expect(section.locator('[data-plans-unavailable]')).toBeVisible();
    await expect(section.locator('[data-plans-unavailable] a')).toHaveAttribute(
      'href',
      /chromewebstore/,
    );
    await expect(section.locator('.tier')).toHaveCount(3);
    await expect(section.locator('.tier__title')).toHaveText([
      'لنفسك',
      'الفرق · مجانية',
      'الفرق · مدفوعة',
    ]);
    // The only price left is the one the page itself knows: yours is free.
    await expect(section.locator('.tier__price')).toHaveText(['مجاني']);
    await expect(section.locator('.tier--outline')).toHaveCount(0);
    await expect(section.locator('[data-plans-foot]')).toBeHidden();
  });

  test('refuses an answer that is not the shape it expects', async ({ page }) => {
    await page.route(PLANS_URL, (route) =>
      route.fulfill({
        json: { ...PLANS_V3, plans: [{ code: 'x', price: { amountMinor: '1' } }] },
        headers: { 'access-control-allow-origin': '*' },
      }),
    );
    await page.goto(origin);
    await expect(page.locator('#plans [data-plans-unavailable]')).toBeVisible();
  });
});

test.describe('Landing page', () => {
  test('is Arabic-first (RTL) and has a single, meaningful h1', async ({ page }) => {
    await page.goto(origin);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('اترك أفكارك حيثُما أنارت.');
  });

  test('language toggle switches to English (LTR) and back', async ({ page }) => {
    await page.goto(origin);
    const toggle = page.locator('#langToggle');

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveText('Leave your thoughts where they lit up.');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('h1')).toHaveText('اترك أفكارك حيثُما أنارت.');
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
      '#features',
      '#export',
      '#plans',
      '#feature-1',
      '#feature-2',
      '#feature-3',
      '#feature-4',
      '#feature-5',
      '#teams',
      '#feature-6',
      '#feature-7',
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
    for (const scene of [
      'contextual',
      'element',
      'quick',
      'library',
      'folders',
      'team-write',
      'team-talk',
      'export',
    ]) {
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

      for (const id of ['#feature-1', '#feature-3', '#feature-5', '#export']) {
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

  test('the marks a note leaves stay inside the page they annotate', async ({ page }) => {
    test.setTimeout(120000);
    // A mark is docked in the page's own margin, the way the extension docks
    // it. Placed outside the window it gets cut in half by the containment
    // that stops demos widening the document — on a phone, where the margin
    // is narrowest, most of all.
    for (const lang of ['ar', 'en'] as const) {
      await page.setViewportSize({ width: 390, height: 860 });
      await page.addInitScript((value) => localStorage.setItem('hamesh-lang', value), lang);
      await page.goto(origin);

      for (const selector of [
        '#feature-2 [data-el="margin-mark"]',
        '#feature-6 [data-el="my-pin"]',
        '#feature-7 [data-el="pin"]',
      ]) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        const mark = await page.evaluate(async (sel) => {
          const el = document.querySelector(sel) as HTMLElement;
          const win = el.closest('.demo')!.querySelector('.ui-window') as HTMLElement;
          const began = Date.now();
          while (Date.now() - began < 30000) {
            if (Number(getComputedStyle(el).opacity) > 0.9) {
              const m = el.getBoundingClientRect();
              const w = win.getBoundingClientRect();
              return { left: m.left - w.left, right: w.right - m.right };
            }
            await new Promise((r) => setTimeout(r, 100));
          }
          return null;
        }, selector);

        expect(mark, `${selector} never appeared in ${lang}`).not.toBeNull();
        expect(mark!.left, `${selector} escaped the window's left edge in ${lang}`).toBeGreaterThan(
          -1,
        );
        expect(
          mark!.right,
          `${selector} escaped the window's right edge in ${lang}`,
        ).toBeGreaterThan(-1);
      }
    }
  });

  test('the hero keeps telling its story after the language is switched', async ({ page }) => {
    // Regression: switching language rebuilds the hero's demo (every position
    // is measured, and in the other language it mirrors). The rebuilt
    // timeline was left paused, so the hero froze for anyone who switched.
    await page.goto(origin);
    await page.waitForFunction(
      () => Number(getComputedStyle(document.querySelector('.hero .demo-cursor')!).opacity) > 0.5,
      null,
      { timeout: 15000 },
    );
    await page.locator('#langToggle').click();

    const alive = await page.waitForFunction(
      () => {
        const sel = document.querySelector('.hero [data-el="selection"]') as HTMLElement;
        const cursor = document.querySelector('.hero .demo-cursor') as HTMLElement;
        const moving = new DOMMatrix(getComputedStyle(sel).transform).a > 0.05;
        return Number(getComputedStyle(cursor).opacity) > 0.5 && moving;
      },
      null,
      { timeout: 15000 },
    );
    expect(await alive.jsonValue()).toBeTruthy();
  });

  test('the hero story starts once, rather than starting again after the loader', async ({
    page,
  }) => {
    await page.goto(origin, { waitUntil: 'commit' });

    // The first tab's bar is the first scene's playhead. Starting behind the
    // loader and again in front of the visitor would send it back to the start.
    const trace = await page.evaluate(async () => {
      const samples: number[] = [];
      const began = Date.now();
      while (Date.now() - began < 7000) {
        const tab = document.querySelector('#hero-tab-0');
        const bar = tab?.querySelector('.hero-tab__bar') as HTMLElement | null;
        if (tab?.getAttribute('aria-selected') === 'true' && bar) {
          samples.push(new DOMMatrix(getComputedStyle(bar).transform).a);
        }
        await new Promise((r) => setTimeout(r, 80));
      }
      return samples;
    });

    expect(trace[trace.length - 1], 'the story never began').toBeGreaterThan(0.1);
    const rewinds = trace.filter((value, i) => i > 0 && value < trace[i - 1] - 0.001);
    expect(rewinds, `the playhead went back: ${trace.join(' ')}`).toEqual([]);
  });
});

test.describe('Landing page · features', () => {
  test('gives every feature a section of its own, copy beside its demo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(origin);
    const features = page.locator('section.feature');
    expect(await features.evaluateAll((all) => all.map((el) => el.id))).toEqual([
      'feature-1',
      'feature-2',
      'feature-3',
      'feature-4',
      'feature-5',
      'export',
      'feature-6',
      'feature-7',
    ]);
    await expect(page.locator('.feature__index b')).toHaveText([
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
    ]);

    const layout = await features.evaluateAll((all) =>
      all.map((el) => {
        const copy = el.querySelector('.feature__copy')!.getBoundingClientRect();
        const stage = el.querySelector('.feature__stage .scene')!.getBoundingClientRect();
        return {
          sideBySide: copy.right <= stage.left + 1 || stage.right <= copy.left + 1,
          copyOnTheRight: copy.left > stage.left,
        };
      }),
    );
    expect(layout.every((one) => one.sideBySide)).toBe(true);
    // Arabic starts on the right, and the sides take turns.
    expect(layout.map((one) => one.copyOnTheRight)).toEqual(layout.map((_, i) => i % 2 === 0));

    await expect(page.locator('#teams blockquote cite')).toHaveText('ابن خلدون، المقدمة');
  });

  test('sets the Teams quotation on one line on a desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(origin);
    const lines = await page.locator('#teams .teams-intro__quote p').evaluate((p) => {
      const range = document.createRange();
      range.selectNodeContents(p);
      return new Set(Array.from(range.getClientRects(), (r) => Math.round(r.top))).size;
    });
    expect(lines).toBe(1);
  });

  test('opens Teams with the quotation set in the open, centred, not boxed as a card', async ({
    page,
  }) => {
    await page.goto(origin);
    const quote = page.locator('#teams .teams-intro__quote');
    const look = await quote.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        background: style.backgroundColor,
        border: style.borderInlineStartWidth,
        shadow: style.boxShadow,
        align: style.textAlign,
      };
    });
    expect(look).toEqual({
      background: 'rgba(0, 0, 0, 0)',
      border: '0px',
      shadow: 'none',
      align: 'center',
    });
  });

  test('presents export as a feature, with no version number and no Markdown browser', async ({
    page,
  }) => {
    await page.goto(origin);
    const section = page.locator('#export');
    await expect(section.locator('[data-scene="export"]')).toHaveCount(1);
    await expect(section.locator('button')).toHaveCount(0);
    await expect(section).not.toContainText('2.3');
    await expect(page.locator('[data-export-switcher], .facts')).toHaveCount(0);
  });
});

test.describe('Landing page · hero demo behind the words', () => {
  test('runs the demo faded behind the copy on a desktop, and under it on a phone', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(origin);
    await expect(page.locator('.loader')).toHaveCount(0);

    const desktop = await page.evaluate(() => {
      const box = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const stage = document.querySelector('.hero__stage')!;
      const h1 = box('.hero h1');
      const window_ = box('#hero-pane-0 .ui-window');
      return {
        sceneTakesPointer: getComputedStyle(document.querySelector('.hero__scene')!).pointerEvents,
        stageOpacity: Number(getComputedStyle(stage).opacity),
        windowBehindTitle: window_.top < h1.top && window_.bottom > h1.bottom,
        titleOnTop:
          document
            .elementFromPoint(h1.left + h1.width / 2, h1.top + h1.height / 2)
            ?.closest('h1') !== null,
      };
    });
    expect(desktop).toEqual({
      sceneTakesPointer: 'none',
      stageOpacity: expect.any(Number),
      windowBehindTitle: true,
      titleOnTop: true,
    });
    expect(desktop.stageOpacity).toBeLessThan(1);

    // The light sits behind the window, centred on it, not on the page above it.
    const glow = await page.evaluate(() => {
      const hero = getComputedStyle(document.querySelector('.hero')!).backgroundImage;
      const halo = getComputedStyle(document.querySelector('.hero__scene')!, '::before');
      const stage = document.querySelector('.hero__stage')!.getBoundingClientRect();
      return {
        pageGlow: hero,
        halo: halo.backgroundImage.startsWith('radial-gradient'),
        stageCentre: Math.round(stage.left + stage.width / 2),
      };
    });
    expect(glow).toEqual({ pageGlow: 'none', halo: true, stageCentre: 720 });

    // The tabs still answer the pointer.
    await page.locator('#hero-tab-1').click();
    await expect(page.locator('#hero-tab-1')).toHaveAttribute('aria-selected', 'true');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expect(page.locator('.loader')).toHaveCount(0);
    const phone = await page.evaluate(() => {
      const note = document.querySelector('.hero__note')!.getBoundingClientRect();
      const window_ = document.querySelector('#hero-pane-0 .ui-window')!.getBoundingClientRect();
      return { windowBelowCopy: window_.top >= note.bottom };
    });
    expect(phone).toEqual({ windowBelowCopy: true });
  });
});

test.describe('Landing page · scenes are drawn whole', () => {
  test('sketches the rest of the hero page as lines of many lengths and a picture', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(origin);
    const sketch = await page
      .locator('#hero-pane-0 .ui-page')
      .evaluate((el) => getComputedStyle(el, '::after').backgroundSize.split(', '));
    const widths = new Set(sketch.map((size) => size.split(' ')[0]));
    const heights = sketch.map((size) => parseFloat(size.split(' ')[1]));
    expect(sketch.length).toBeGreaterThan(12);
    expect(widths.size).toBeGreaterThan(8);
    // One block far taller than a line: the picture.
    expect(Math.max(...heights)).toBeGreaterThan(Math.min(...heights) * 10);
  });

  test('lets a window’s shadow blur out to the screen’s edge', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(origin);
    // The nearest box that clips the window is the full-width section, so the
    // shadow's 90px blur has room on both sides; a clip on the stage cut it off
    // at the window's own edge.
    const clipper = await page.locator('#feature-2 .ui-window').evaluate((win) => {
      let el = win.parentElement;
      while (el && getComputedStyle(el).overflowX === 'visible') el = el.parentElement;
      return { tag: el!.tagName, id: el!.id, width: el!.getBoundingClientRect().width };
    });
    expect(clipper).toEqual({ tag: 'SECTION', id: 'feature-2', width: 1440 });
  });

  for (const [lang, width] of [
    ['ar', 1440],
    ['en', 1440],
    ['ar', 900],
    ['en', 375],
    ['ar', 375],
  ] as const) {
    test(`ends feature 08's side panel in its reply field (${lang}, ${width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem('hamesh-lang', value), lang);
      await page.goto(origin);
      await expect(page.locator('.loader')).toHaveCount(0);
      const foot = await page.locator('#feature-7 .ui-side').evaluate((side) => {
        const reply = side.querySelector('.ui-side__reply');
        if (!reply) return null;
        const panel = side.getBoundingClientRect();
        const box = reply.getBoundingClientRect();
        return { inside: box.bottom <= panel.bottom + 0.5, atFoot: panel.bottom - box.bottom < 1 };
      });
      expect(foot).toEqual({ inside: true, atFoot: true });
    });
  }
});

test.describe('Landing page · hero fits a desktop screen', () => {
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
  ] as const) {
    for (const lang of ['ar', 'en'] as const) {
      test(`shows all of it at ${width}×${height} (${lang})`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.addInitScript((value) => localStorage.setItem('hamesh-lang', value), lang);
        await page.goto(origin);
        await expect(page.locator('.loader')).toHaveCount(0);

        // Everything, down to the last line under the tabs, with nothing scrolled.
        await expect
          .poll(() =>
            page.evaluate(() =>
              Math.max(
                ...Array.from(document.querySelectorAll('.hero-tab'), (el) =>
                  Math.round(el.getBoundingClientRect().bottom),
                ),
              ),
            ),
          )
          .toBeLessThanOrEqual(height);
        const windowHeight = await page
          .locator('#hero-pane-0 .ui-window')
          .evaluate((el) => el.getBoundingClientRect().height);
        expect(windowHeight, 'the demo is too small to read').toBeGreaterThan(250);
      });
    }
  }
});

test.describe('Landing page · typing', () => {
  for (const lang of ['ar', 'en'] as const) {
    test(`writes whole letters with the caret after the last one (${lang})`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('hamesh-lang', value), lang);
      await page.goto(origin);
      await expect(page.locator('.ui-reveal')).toHaveCount(0);

      const seen = await page.evaluate(async () => {
        const pane = document.querySelector('#hero-pane-0') as HTMLElement;
        const text = pane.querySelector('[data-el="field-text"]') as HTMLElement;
        const caret = pane.querySelector('[data-el="caret"]') as HTMLElement;
        const rtl = document.documentElement.dir === 'rtl';
        const full = text.getAttribute(`data-${document.documentElement.lang}`)!;
        // The ES2022 segmenter, typed by hand: the project compiles against an older library.
        const { Segmenter } = Intl as unknown as {
          Segmenter: new (
            locale: undefined,
            options: { granularity: 'grapheme' },
          ) => { segment: (text: string) => Iterable<{ segment: string }> };
        };
        const segments = Array.from(
          new Segmenter(undefined, { granularity: 'grapheme' }).segment(full),
          (part) => part.segment,
        );
        const prefixes = segments.map((_, i) => segments.slice(0, i + 1).join(''));
        const partial: string[] = [];
        const strays: number[] = [];
        let steps = 0;
        let last = '';
        const began = Date.now();
        while (Date.now() - began < 20000 && last !== full) {
          const now = text.textContent ?? '';
          if (now && !prefixes.includes(now)) partial.push(now);
          if (now !== last && now && now !== full) {
            steps += 1;
            const range = document.createRange();
            const node = text.firstChild!;
            range.setStart(node, now.trimEnd().length - 1);
            range.setEnd(node, now.trimEnd().length);
            // The last character that is drawn, and the caret beside it.
            const letter = range.getBoundingClientRect();
            const bar = caret.getBoundingClientRect();
            const sameLine = Math.abs(letter.top - bar.top) < letter.height;
            if (sameLine && now === now.trimEnd()) {
              strays.push(rtl ? letter.left - bar.right : bar.left - letter.right);
            }
          }
          last = now;
          await new Promise((r) => requestAnimationFrame(() => r(null)));
        }
        return {
          partial,
          strays,
          steps,
          finished: last === full,
          adjacent: text.nextElementSibling === caret,
          caretShown: Number(getComputedStyle(caret).opacity),
        };
      });

      expect(seen.finished, 'the line was never finished').toBe(true);
      expect(seen.steps).toBeGreaterThan(8);
      expect(seen.partial).toEqual([]);
      expect(seen.adjacent).toBe(true);
      // Still there when the last letter lands.
      expect(seen.caretShown).toBeGreaterThan(0.9);
      expect(seen.strays.length).toBeGreaterThan(4);
      // The letter's box and the caret meet, whichever way the line runs. A
      // joined Arabic letter can reach a few pixels past its own box.
      for (const gap of seen.strays) expect(Math.abs(gap)).toBeLessThan(6);
    });
  }

  test('shows the finished lines at once to someone who asked for less motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(origin);
    for (const field of await page.locator('[data-el="field-text"]').all()) {
      await expect(field).toHaveText((await field.getAttribute('data-ar'))!);
    }
    await page.locator('#hero-tab-2').click();
    await expect(page.locator('#hero-pane-2 [data-el="quick"]')).toBeVisible();
    await expect(page.locator('#hero-pane-2 [data-el="quick"]')).toHaveCSS('opacity', '1');
    await expect(page.locator('#hero-pane-0')).toBeHidden();
  });
});

test.describe('Landing page · hero tabs', () => {
  const selected = (page: import('@playwright/test').Page) =>
    page.locator('[role="tab"][aria-selected="true"]');

  test('are three tabs that switch scenes, by pointer and by keyboard', async ({ page }) => {
    await page.goto(origin);
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(3);
    await expect(selected(page)).toHaveAttribute('id', 'hero-tab-0');

    await tabs.nth(2).click();
    await expect(selected(page)).toHaveAttribute('id', 'hero-tab-2');
    await expect(page.locator('#hero-pane-2')).toBeVisible();
    await expect(page.locator('#hero-pane-0')).toBeHidden();
    await expect
      .poll(() =>
        page
          .locator('#hero-tab-2 .hero-tab__bar')
          .evaluate((bar) => new DOMMatrix(getComputedStyle(bar).transform).a),
      )
      .toBeGreaterThan(0.05);

    // Arabic reads right to left, so the next tab is to the left.
    await tabs.nth(2).press('ArrowRight');
    await expect(selected(page)).toHaveAttribute('id', 'hero-tab-1');
    await expect(tabs.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(selected(page)).toHaveAttribute('id', 'hero-tab-2');

    // Only the selected tab is a stop on the Tab key's way through.
    await expect(tabs.nth(2)).toHaveAttribute('tabindex', '0');
    await expect(tabs.nth(0)).toHaveAttribute('tabindex', '-1');
  });

  test('keeps the composer inside the window, on a desktop and on a phone', async ({ page }) => {
    test.setTimeout(180000);
    for (const [lang, width, height] of [
      ['ar', 1280, 900],
      ['en', 1280, 900],
      // A short screen scales the window down.
      ['ar', 1280, 720],
      ['en', 1280, 720],
      ['ar', 375, 900],
      ['en', 375, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.addInitScript((value) => localStorage.setItem('hamesh-lang', value), lang);
      await page.goto(origin);
      await expect(page.locator('.loader')).toHaveCount(0);

      for (const [index, card] of [
        [0, 'card'],
        [1, 'card'],
        [2, 'quick'],
      ] as const) {
        await page.locator(`#hero-tab-${index}`).click();
        const el = page.locator(`#hero-pane-${index} [data-el="${card}"]`);
        await expect(el).toHaveCSS('opacity', '1', { timeout: 15000 });
        const inside = await el.evaluate((node) => {
          const box = node.getBoundingClientRect();
          const win = node.closest('.demo')!.querySelector('.ui-window')!.getBoundingClientRect();
          return Math.min(
            box.left - win.left,
            win.right - box.right,
            box.top - win.top,
            win.bottom - box.bottom,
          );
        });
        expect(inside, `scene ${index} at ${width}×${height} in ${lang}`).toBeGreaterThan(6);
      }
    }
  });
});

test.describe('Landing page · header', () => {
  test('offers the install link only once the hero’s has left the screen', async ({ page }) => {
    await page.goto(origin);
    const cta = page.locator('.nav-cta');
    await expect(page.locator('.loader')).toHaveCount(0);
    await expect(cta).toBeHidden();

    await page.locator('#privacy').scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(cta).toBeHidden();
  });

  test('cycles the theme, remembers it, and applies it before any module runs', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(origin);
    const html = page.locator('html');
    const toggle = page.locator('#themeToggle');
    const paper = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await expect(html).not.toHaveAttribute('data-theme');
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect.poll(paper).toBe('rgb(22, 20, 15)');

    // With every script file refused, only the blocking one in the head can
    // have applied the choice.
    await page.route('**/*.js', (route) => route.abort());
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect(await paper()).toBe('rgb(22, 20, 15)');
    await page.unroute('**/*.js');

    await page.reload();
    await toggle.click();
    await expect(html).not.toHaveAttribute('data-theme');
    expect(await page.evaluate(() => localStorage.getItem('hamesh-theme'))).toBeNull();
  });

  test('follows the system until told otherwise', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(origin);
    const paper = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await paper()).toBe('rgb(22, 20, 15)');
    await page.locator('#themeToggle').click();
    await expect.poll(paper).toBe('rgb(247, 243, 236)');
  });
});

test.describe('Landing page · visit counter', () => {
  test('counts visits on the home page only, and the privacy page says so', async ({ page }) => {
    await page.goto(origin);
    await expect(page.locator('script[data-cf-beacon]')).toHaveCount(1);

    await page.goto(`${origin}privacy.html`);
    await expect(page.locator('script[data-cf-beacon]')).toHaveCount(0);
    await expect(page.locator('[data-en^="This website (not the extension)"]')).toHaveCount(1);
  });
});

test.describe('The page an invite link opens', () => {
  const TOKEN = 'a'.repeat(43);

  test('offers the link to copy, and never sends the invitation anywhere', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => requested.push(request.url()));
    await page.goto(`${origin}join.html#${TOKEN}`);

    await expect(page.locator('#copy')).toBeVisible();
    await expect(page.locator('#noToken')).toBeHidden();
    expect(await page.locator('meta[name="referrer"]').getAttribute('content')).toBe('no-referrer');

    const external = requested.filter((url) => !url.startsWith(origin));
    expect(external).toEqual([]);
    // A browser never puts a fragment on the wire; this catches a script doing so.
    expect(requested.filter((url) => url.split('#')[0].includes(TOKEN))).toEqual([]);
  });

  test('says so when the link has no invitation in it', async ({ page }) => {
    await page.goto(`${origin}join.html`);
    await expect(page.locator('#copy')).toBeHidden();
    await expect(page.locator('#noToken')).toBeVisible();
  });

  test('says when Hamesh has taken the invitation, and still copies the whole link', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`${origin}join.html#${TOKEN}`);
    await expect(page.locator('#opened')).toBeHidden();
    // What Hamesh's content script does on this page: clears the address, then
    // says it took the invitation.
    await page.evaluate(() => {
      history.replaceState(null, '', location.pathname);
      document.dispatchEvent(new CustomEvent('hamesh:join-opened'));
    });
    await expect(page.locator('#opened')).toBeVisible();
    await page.locator('#copy').click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${origin}join.html#${TOKEN}`,
    );
  });

  test('speaks both languages, each in its own direction', async ({ page }) => {
    await page.goto(`${origin}join.html#${TOKEN}`);
    const start = await page.locator('html').getAttribute('lang');
    await page.locator('#langToggle').click();
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', start === 'ar' ? 'en' : 'ar');
    await expect(html).toHaveAttribute('dir', start === 'ar' ? 'ltr' : 'rtl');
    await page.locator('#langToggle').click();
    await expect(html).toHaveAttribute('dir', start === 'ar' ? 'rtl' : 'ltr');
  });
});
