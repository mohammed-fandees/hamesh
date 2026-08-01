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

/** Clicks a video marker (or cluster — same class, plus `--cluster`) via
 *  real screen coordinates (`page.mouse.click`), not `locator.click()` —
 *  both are `pointer-events: none` (real clicks pass through to the
 *  player beneath, and Hamesh detects them by coordinate proximity
 *  instead, see HameshApp.tsx), so `locator.click()`'s actionability check
 *  would otherwise refuse the click, correctly reporting that the video
 *  "intercepts pointer events". */
async function clickVideoMarker(page: Page, selector = '.hm-video-marker'): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no visible ${selector} to click`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** Same real-coordinate reasoning as `clickVideoMarker`, for hovering —
 *  `locator.hover()` would fail its own actionability check the same way. */
async function moveToVideoMarker(page: Page, selector = '.hm-video-marker'): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no visible ${selector} to hover`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

/** Opens the quick-note popup via the dedicated video shortcut, types
 *  `text`, and saves with Enter — the same flow every test below repeats
 *  to get a note onto the timeline at a given moment. The hover here isn't
 *  load-bearing for the shortcut itself (it's pointer-independent — see
 *  the video-shortcut tests below) but keeps this helper visually honest
 *  about what a user would actually be doing. */
async function createVideoNoteAt(page: Page, timestamp: number, text: string): Promise<void> {
  await page.evaluate((t) => {
    (document.querySelector('video') as HTMLVideoElement).currentTime = t;
  }, timestamp);
  await page.locator('[data-testid="test-video"]').hover();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate-video')));
  await page.locator('.hm-video-quick-note textarea').fill(text);
  await page.keyboard.press('Enter');
  await expect(page.locator('.hm-video-quick-note')).toHaveCount(0);
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

async function getExtensionId(context: BrowserContext): Promise<string> {
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return new URL(sw.url()).host;
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

  test('the video shortcut opens the quick-note popup regardless of pointer position, not element selection', async () => {
    // Hovering something that isn't the video at all — proving this is a
    // dedicated, pointer-independent shortcut, not a hover/focus heuristic.
    // The old Alt+H design branched on "is the pointer over the video,"
    // which real-world testing showed was unreliable (real players layer
    // overlay UI that defeats DOM- and even coordinate-based hover checks).
    // The dedicated shortcut always targets the page's active video instead.
    await page.locator('h1').hover();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate-video')));

    await expect(page.locator('.hm-video-quick-note')).toBeVisible();
    await expect(page.locator('.hm-capture')).toHaveCount(0);

    // The popup never covers the video — it's positioned above it.
    const noteBox = await page.locator('.hm-video-quick-note').boundingBox();
    const videoBox = await page.locator('[data-testid="test-video"]').boundingBox();
    expect(noteBox!.y + noteBox!.height).toBeLessThanOrEqual(videoBox!.y + 1);
  });

  test('Alt+H always opens element selection, even while hovering the video', async () => {
    // The confusion this fixes: an earlier design made Alt+H context-aware
    // (video note when hovering the video, element selection otherwise),
    // which broke down in real usage — the video shortcut above exists
    // specifically so this shortcut can stay simple and predictable.
    await page.locator('[data-testid="test-video"]').hover();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));

    await expect(page.locator('.hm-capture')).toBeVisible();
    await expect(page.locator('.hm-video-quick-note')).toHaveCount(0);
  });

  test('the video shortcut is a no-op on a page with no active video', async () => {
    // A fresh navigation to a page with no <video> at all, rather than
    // removing the fixture's video and waiting on HameshApp's debounced
    // MutationObserver to notice — that observer's re-check is timer-based
    // (see its 400ms debounce in HameshApp.tsx) and proved flaky to wait on
    // from outside. Navigating instead means `videoMatch` is `null` from
    // this page's very first synchronous render, no timing dependency.
    const noVideoUrl = server.url.replace('video-page.html', 'no-video-page.html');
    await page.goto(noVideoUrl);
    await waitForHameshReady(page);

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate-video')));

    await expect(page.locator('.hm-video-quick-note')).toHaveCount(0);
    await expect(page.locator('.hm-capture')).toHaveCount(0);
  });

  test('typing a note and pressing Enter saves it and shows a timeline marker', async () => {
    await page.evaluate(() => {
      (document.querySelector('video') as HTMLVideoElement).currentTime = 3;
    });

    await page.locator('[data-testid="test-video"]').hover();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate-video')));
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
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate-video')));

    const textarea = page.locator('.hm-video-quick-note textarea');
    await textarea.fill('line one');
    await textarea.press('Shift+Enter');
    await textarea.type('line two');

    await expect(textarea).toHaveValue('line one\nline two');
    await expect(page.locator('.hm-video-quick-note')).toBeVisible();
  });

  test('Escape closes the popup without saving', async () => {
    await page.locator('[data-testid="test-video"]').hover();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate-video')));
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
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate-video')));
    await page.locator('.hm-video-quick-note textarea').fill('Six seconds in');
    await page.keyboard.press('Enter');
    await expect(page.locator('.hm-video-marker')).toHaveCount(1);

    // A paused video stays paused after the seek.
    await page.evaluate(() => {
      (document.querySelector('video') as HTMLVideoElement).currentTime = 0;
    });
    await clickVideoMarker(page);
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
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate-video')));
    await page.locator('.hm-video-quick-note textarea').fill('Six seconds in, playing');
    await page.keyboard.press('Enter');
    await expect(page.locator('.hm-video-marker')).toHaveCount(1);

    // Reset to a point *after* the marker's target (6s), not 0 — the video
    // is still playing, and playback only ever moves forward, so resetting
    // to 0 made this assertion unable to tell a real seek apart from the
    // video simply having played forward on its own for ~5.5s (which is
    // indistinguishable from a successful seek once the poll's default
    // timeout is in the same ballpark — this is exactly what flaked in CI:
    // a slower runner reported ~4.9s, i.e. plain 1x playback from 0, not a
    // seek that ever landed). Starting past the target means only an
    // actual backward jump can land back near 6 within the poll window;
    // organic forward-only drift from 8 can never revisit it.
    await page.evaluate(() => {
      (document.querySelector('video') as HTMLVideoElement).currentTime = 8;
    });
    await clickVideoMarker(page);
    await expect
      .poll(() =>
        page.evaluate(() => (document.querySelector('video') as HTMLVideoElement).currentTime),
      )
      .toBeLessThan(7);
    expect(
      await page.evaluate(() => (document.querySelector('video') as HTMLVideoElement).currentTime),
    ).toBeGreaterThan(5.5);
    expect(
      await page.evaluate(() => (document.querySelector('video') as HTMLVideoElement).paused),
    ).toBe(false);
  });

  test('markers hide with the video controls while playing and unhovered, and reappear on hover or pause', async () => {
    await page.locator('[data-testid="test-video"]').hover();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate-video')));
    await page.locator('.hm-video-quick-note textarea').fill('Note while paused');
    await page.keyboard.press('Enter');
    // Created while paused — visible immediately, matching native controls
    // staying up while paused.
    await expect(page.locator('.hm-video-marker')).toHaveCount(1);

    await page.evaluate(async () => {
      await (document.querySelector('video') as HTMLVideoElement).play();
    });
    // Move well away from the video (and the rail overlapping its bottom
    // edge) — the marker should hide, the same way native controls would
    // fade once you stop interacting with a playing video.
    await page.locator('h1').hover();
    await expect(page.locator('.hm-video-marker')).toHaveCount(0);

    // Hovering the video again brings it back without needing to pause.
    await page.locator('[data-testid="test-video"]').hover();
    await expect(page.locator('.hm-video-marker')).toHaveCount(1);

    // Moving away again hides it (still playing)...
    await page.locator('h1').hover();
    await expect(page.locator('.hm-video-marker')).toHaveCount(0);

    // ...but pausing brings it back even while the pointer stays elsewhere.
    await page.evaluate(() => {
      (document.querySelector('video') as HTMLVideoElement).pause();
    });
    await expect(page.locator('.hm-video-marker')).toHaveCount(1);
  });

  test('hovering directly over a marker does not flicker it (regression)', async () => {
    // A marker with real pointer-events used to sit on top of the video —
    // hovering it meant the *marker*, not the video (or a real site's
    // player container), was the hit-tested element, which hides a real
    // site's own controls (see the youtube.ts adapter) and could also
    // flicker our own marker in a hide/show loop via its hover-based
    // visibility check, the instant the pointer reached a dot it was
    // trying to interact with.
    await page.evaluate(() => {
      (document.querySelector('video') as HTMLVideoElement).currentTime = 6;
    });
    await page.locator('[data-testid="test-video"]').hover();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate-video')));
    await page.locator('.hm-video-quick-note textarea').fill('Regression check');
    await page.keyboard.press('Enter');
    await expect(page.locator('.hm-video-marker')).toHaveCount(1);

    await page.evaluate(async () => {
      await (document.querySelector('video') as HTMLVideoElement).play();
    });

    // Move to the marker's exact on-screen position, not just "somewhere
    // on the video" — this is the precise spot that used to trigger it.
    const box = await page.locator('.hm-video-marker').boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);

    // Sample repeatedly over a short window: a flicker loop would show up
    // as the count dropping to 0 at some point during this window, not
    // just in a single snapshot taken after the fact.
    for (let i = 0; i < 5; i++) {
      await expect(page.locator('.hm-video-marker')).toHaveCount(1);
      await page.waitForTimeout(60);
    }

    // pointer-events: none means the marker is never the actual
    // hit-tested element — real hover/click at this exact point passes
    // through to whatever's really there (the page body, since the
    // generic-adapter fallback rail sits just outside the video's own
    // box — see getRailPlacement's comment on why it isn't overlapping).
    const hitTag = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.tagName ?? null,
      [box!.x + box!.width / 2, box!.y + box!.height / 2],
    );
    expect(hitTag).not.toBe('BUTTON');
  });

  test('hovering a single marker shows the note preview (first line + timestamp)', async () => {
    await createVideoNoteAt(page, 4, 'First line of the note\nSecond line, hidden in the preview');
    await expect(page.locator('.hm-video-marker')).toHaveCount(1);

    await page.locator('h1').hover();
    await expect(page.locator('.hm-video-preview')).toHaveCount(0);

    await moveToVideoMarker(page);
    await expect(page.locator('.hm-video-preview')).toBeVisible();
    await expect(page.locator('.hm-video-preview__text')).toHaveText('First line of the note');
    await expect(page.locator('.hm-video-preview__time')).toHaveText('0:04');

    await page.locator('h1').hover();
    await expect(page.locator('.hm-video-preview')).toHaveCount(0);
  });

  test('notes close together on the timeline render as one cluster instead of overlapping markers', async () => {
    await createVideoNoteAt(page, 4, 'First note');
    await createVideoNoteAt(page, 4.2, 'Second note');

    await expect(page.locator('.hm-video-marker--cluster')).toHaveCount(1);
    await expect(page.locator('.hm-video-marker:not(.hm-video-marker--cluster)')).toHaveCount(0);
    await expect(page.locator('.hm-video-marker--cluster')).toHaveText('2');
  });

  test('hovering a cluster shows a small "N notes" hint, not the full preview', async () => {
    await createVideoNoteAt(page, 4, 'First note');
    await createVideoNoteAt(page, 4.2, 'Second note');
    await expect(page.locator('.hm-video-marker--cluster')).toHaveCount(1);

    await moveToVideoMarker(page, '.hm-video-marker--cluster');
    await expect(page.locator('.hm-hint')).toHaveText('2 notes here');
    await expect(page.locator('.hm-video-preview')).toHaveCount(0);
  });

  test('clicking a cluster opens a list of its notes, ordered by timestamp', async () => {
    await createVideoNoteAt(page, 4.1, 'Later note');
    await createVideoNoteAt(page, 3.9, 'Earlier note');
    await expect(page.locator('.hm-video-marker--cluster')).toHaveCount(1);

    await clickVideoMarker(page, '.hm-video-marker--cluster');
    await expect(page.locator('.hm-video-cluster-list')).toBeVisible();

    const items = page.locator('.hm-video-cluster-list__item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('0:03');
    await expect(items.nth(0)).toContainText('Earlier note');
    await expect(items.nth(1)).toContainText('0:04');
    await expect(items.nth(1)).toContainText('Later note');
  });

  test('selecting a note from the cluster list seeks to it and closes the list', async () => {
    await createVideoNoteAt(page, 3.9, 'Earlier note');
    await createVideoNoteAt(page, 4.1, 'Later note');
    await clickVideoMarker(page, '.hm-video-marker--cluster');

    const items = page.locator('.hm-video-cluster-list__item');
    await expect(items).toHaveCount(2);

    await page.evaluate(() => {
      (document.querySelector('video') as HTMLVideoElement).currentTime = 0;
    });
    await items.nth(1).click(); // the later ("0:04") note
    await expect(page.locator('.hm-video-cluster-list')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => (document.querySelector('video') as HTMLVideoElement).currentTime),
      )
      .toBeGreaterThan(4.05);
  });

  test('clicking outside an open cluster list closes it without seeking', async () => {
    await createVideoNoteAt(page, 3.9, 'Earlier note');
    await createVideoNoteAt(page, 4.1, 'Later note');
    await clickVideoMarker(page, '.hm-video-marker--cluster');
    await expect(page.locator('.hm-video-cluster-list')).toBeVisible();

    await page.evaluate(() => {
      (document.querySelector('video') as HTMLVideoElement).currentTime = 0;
    });
    await page.locator('h1').click();

    await expect(page.locator('.hm-video-cluster-list')).toHaveCount(0);
    expect(
      await page.evaluate(() => (document.querySelector('video') as HTMLVideoElement).currentTime),
    ).toBe(0);
  });

  test('Escape closes an open cluster list', async () => {
    await createVideoNoteAt(page, 3.9, 'Earlier note');
    await createVideoNoteAt(page, 4.1, 'Later note');
    await clickVideoMarker(page, '.hm-video-marker--cluster');
    await expect(page.locator('.hm-video-cluster-list')).toBeVisible();

    // Not `page.keyboard.press` (global, dispatched at whatever
    // `document.activeElement` currently is) — confirmed via a throwaway
    // repro that headless Chromium in this environment never reflects a
    // programmatic `.focus()` call in `document.activeElement`, the same
    // environment gap noted for the quick-note's autoFocus elsewhere in
    // this file. `locator.press()` on the list's first row (which the
    // component auto-focuses on open) targets the key event at that
    // specific, real element instead, which correctly reaches the list's
    // onKeyDown handler regardless of what `document.activeElement` says.
    await page.locator('.hm-video-cluster-list__item').first().press('Escape');
    await expect(page.locator('.hm-video-cluster-list')).toHaveCount(0);
  });

  test('opening a video note from the Notes Library seeks the video and opens its viewer in a fresh tab', async () => {
    const extensionId = await getExtensionId(context);
    const noteText = 'Reached via the Notes Library.';
    await createVideoNoteAt(page, 6, noteText);
    await expect(page.locator('.hm-video-marker')).toHaveCount(1);

    const library = await context.newPage();
    await library.goto(`chrome-extension://${extensionId}/notes.html`);
    await library.getByRole('button', { name: /127\.0\.0\.1/ }).click();
    const noteLink = library.locator('.hm-note-row', { hasText: noteText });
    await expect(noteLink).toBeVisible();
    // The video badge (not just the note text) is visible in the row too.
    await expect(noteLink.locator('.hm-note-row__video-badge')).toHaveText('0:06');

    // Clicking opens the note's page in a *new* tab — a fresh load, so the
    // video starts unseeded (readyState 0, currentTime 0) until Hamesh's
    // restore handshake completes.
    const [restoredPage] = await Promise.all([context.waitForEvent('page'), noteLink.click()]);
    await restoredPage.waitForLoadState('domcontentloaded');
    expect(new URL(restoredPage.url()).pathname).toBe('/video-page.html');

    // Seeked to the stored timestamp — no fixed wait, this polls until the
    // restore handshake (CONTENT_READY -> RESTORE_NOTE -> video resolves
    // -> seek) actually completes.
    await expect
      .poll(
        () =>
          restoredPage.evaluate(
            () => (document.querySelector('video') as HTMLVideoElement | null)?.currentTime,
          ),
        { timeout: 10000 },
      )
      .toBeGreaterThan(5.5);

    // The note's viewer opens too — same as clicking its on-page marker —
    // so the user lands somewhere they can read/edit/delete/pin it, not
    // just a silently-seeked video.
    await expect(restoredPage.locator('.hm-card .hm-note-body')).toHaveText(noteText, {
      timeout: 5000,
    });
  });

  test('clicking a marker opens the note viewer, where it can be edited, pinned, and deleted', async () => {
    await createVideoNoteAt(page, 6, 'Original video note text');
    await expect(page.locator('.hm-video-marker')).toHaveCount(1);

    await clickVideoMarker(page);
    await expect(page.locator('.hm-card .hm-note-body')).toHaveText('Original video note text');

    // Pin.
    await page.getByRole('button', { name: 'Pin this note' }).click();
    await expect(page.getByRole('button', { name: 'Unpin this note' })).toBeVisible();

    // Edit.
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('.hm-card textarea').fill('Edited video note text');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('.hm-card .hm-note-body')).toHaveText('Edited video note text');

    // Delete.
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('.hm-card')).toHaveCount(0);
    await expect(page.locator('.hm-video-marker')).toHaveCount(0);
  });
});
