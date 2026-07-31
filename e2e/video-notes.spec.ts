import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Video Notes — capture + timeline markers (generic HTML5 adapter path).
 *
 * Drives the real built extension against a self-hosted plain <video>
 * fixture (no site-specific player, so this exercises `html5-generic.ts`,
 * not `youtube.ts` — YouTube's own adapter is unit/fixture-tested instead,
 * consistent with this project's no-live-network E2E policy). Requires
 * `pnpm build` first.
 */

const EXTENSION_PATH = path.resolve(import.meta.dirname, '..', '.output', 'chrome-mv3');
const FIXTURES_DIR = path.resolve(import.meta.dirname, 'fixtures');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.mp4': 'video/mp4',
};

// Content scripts don't run on file:// URLs, so serve over HTTP. A tiny
// static file server (not the single-fixture responder other specs use)
// since this page needs its video file served alongside it — with real
// HTTP Range support, since Chromium reports a video's `seekable` ranges
// as degenerate ([0,0], i.e. unseekable) when a server can't fulfill a
// byte-range request, even for a fully-buffered short file.
function startServer(): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const reqPath = (req.url ?? '/').split('?')[0];
      const filePath = path.join(FIXTURES_DIR, decodeURIComponent(reqPath));
      const ext = path.extname(filePath);
      fs.stat(filePath, (statErr, stat) => {
        if (statErr) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
        res.setHeader('Accept-Ranges', 'bytes');
        const range = req.headers.range;
        if (range) {
          const match = /bytes=(\d+)-(\d+)?/.exec(range);
          const start = match ? parseInt(match[1], 10) : 0;
          const end = match?.[2] ? parseInt(match[2], 10) : stat.size - 1;
          res.statusCode = 206;
          res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
          res.setHeader('Content-Length', end - start + 1);
          res.setHeader('Content-Type', contentType);
          fs.createReadStream(filePath, { start, end }).pipe(res);
          return;
        }
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Type', contentType);
        fs.createReadStream(filePath).pipe(res);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}/video-page.html`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function launch(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamesh-e2e-video-'));
  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      // Headless Chromium sometimes needs an explicit nudge to actually
      // decode a real (if tiny) video stream rather than staying at
      // readyState 0 — harmless on a real, non-headless run.
      '--autoplay-policy=no-user-gesture-required',
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

async function waitForVideoMetadata(page: Page): Promise<void> {
  await page.evaluate(() => {
    const video = document.querySelector('video')!;
    if (video.readyState >= 1) return;
    return new Promise<void>((resolve) =>
      video.addEventListener('loadedmetadata', () => resolve(), { once: true }),
    );
  });
}

test.describe('Video Notes — capture + timeline markers', () => {
  let context: BrowserContext;
  let server: { url: string; close: () => Promise<void> };
  let page: Page;

  test.beforeEach(async () => {
    server = await startServer();
    context = await launch();
    page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);
    await waitForVideoMetadata(page);
  });

  test.afterEach(async () => {
    await context.close();
    await server.close();
  });

  test('Alt+H over the video opens the quick-note popup, not element selection', async () => {
    await page.locator('[data-testid="test-video"]').hover();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));

    await expect(page.locator('.hm-video-quick-note')).toBeVisible();
    await expect(page.locator('.hm-capture')).toHaveCount(0);

    // The popup never covers the video — it's positioned above it.
    const noteBox = await page.locator('.hm-video-quick-note').boundingBox();
    const videoBox = await page.locator('[data-testid="test-video"]').boundingBox();
    expect(noteBox!.y + noteBox!.height).toBeLessThanOrEqual(videoBox!.y + 1);
  });

  test('Alt+H away from the video falls back to element selection', async () => {
    await page.locator('h1').hover();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));

    await expect(page.locator('.hm-capture')).toBeVisible();
    await expect(page.locator('.hm-video-quick-note')).toHaveCount(0);
  });

  test('typing a note and pressing Enter saves it and shows a timeline marker', async () => {
    await page.evaluate(() => {
      (document.querySelector('video') as HTMLVideoElement).currentTime = 3;
    });

    await page.locator('[data-testid="test-video"]').hover();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));
    await expect(page.locator('.hm-video-quick-note')).toBeVisible();
    // Not asserting actual focus state here: confirmed (via a throwaway
    // repro against this exact environment) that headless Chromium never
    // reflects React's `autoFocus` in `document.activeElement` for *any*
    // of Hamesh's cards — including the already-shipped element
    // `Composer` — so this isn't something to verify per-PR; `.fill()`
    // below focuses the textarea itself regardless, proving typing works.

    await page.locator('.hm-video-quick-note textarea').fill('Interesting moment');
    await page.keyboard.press('Enter');

    await expect(page.locator('.hm-video-quick-note')).toHaveCount(0);
    await expect(page.locator('.hm-video-marker')).toHaveCount(1);
  });

  test('Shift+Enter inserts a newline instead of saving', async () => {
    await page.locator('[data-testid="test-video"]').hover();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));

    const textarea = page.locator('.hm-video-quick-note textarea');
    await textarea.fill('line one');
    await textarea.press('Shift+Enter');
    await textarea.type('line two');

    await expect(textarea).toHaveValue('line one\nline two');
    await expect(page.locator('.hm-video-quick-note')).toBeVisible();
  });

  test('Escape closes the popup without saving', async () => {
    await page.locator('[data-testid="test-video"]').hover();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));
    await page.locator('.hm-video-quick-note textarea').fill('discarded');
    await page.keyboard.press('Escape');

    await expect(page.locator('.hm-video-quick-note')).toHaveCount(0);
    await expect(page.locator('.hm-video-marker')).toHaveCount(0);
  });

  test('clicking a marker seeks the video without forcing play or pause', async () => {
    await page.evaluate(() => {
      (document.querySelector('video') as HTMLVideoElement).currentTime = 6;
    });
    await page.locator('[data-testid="test-video"]').hover();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));
    await page.locator('.hm-video-quick-note textarea').fill('Six seconds in');
    await page.keyboard.press('Enter');
    await expect(page.locator('.hm-video-marker')).toHaveCount(1);

    // A paused video stays paused after the seek.
    await page.evaluate(() => {
      (document.querySelector('video') as HTMLVideoElement).currentTime = 0;
    });
    await page.locator('.hm-video-marker').click();
    await expect
      .poll(() =>
        page.evaluate(() => (document.querySelector('video') as HTMLVideoElement).currentTime),
      )
      .toBeGreaterThan(5.5);
    expect(
      await page.evaluate(() => (document.querySelector('video') as HTMLVideoElement).paused),
    ).toBe(true);
  });

  test('clicking a marker while the video is playing leaves it playing', async () => {
    await page.evaluate(async () => {
      const video = document.querySelector('video') as HTMLVideoElement;
      video.currentTime = 6;
      await video.play();
    });
    await page.locator('[data-testid="test-video"]').hover();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));
    await page.locator('.hm-video-quick-note textarea').fill('Six seconds in, playing');
    await page.keyboard.press('Enter');
    await expect(page.locator('.hm-video-marker')).toHaveCount(1);

    await page.evaluate(() => {
      (document.querySelector('video') as HTMLVideoElement).currentTime = 0;
    });
    await page.locator('.hm-video-marker').click();
    await expect
      .poll(() =>
        page.evaluate(() => (document.querySelector('video') as HTMLVideoElement).currentTime),
      )
      .toBeGreaterThan(5.5);
    expect(
      await page.evaluate(() => (document.querySelector('video') as HTMLVideoElement).paused),
    ).toBe(false);
  });
});
