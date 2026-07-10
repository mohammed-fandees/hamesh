/**
 * Records raw product-demo clips for the Hamesh launch video, driving the
 * REAL built extension in a real Chromium instance — no fake UI, no staged
 * screenshots. Reuses this repo's proven extension-loading pattern (see
 * e2e/core-flows.spec.ts) and the "Architecture of Memory" fixture concept
 * from docs/chrome-web-store/source/demo-page.html (recording-tuned copy at
 * ./fixture.html — see that file's header for why it's separate).
 *
 * Requires the extension to be built first: `pnpm build`.
 *
 * Usage: node tooling/launch-video/record.mjs
 *
 * Output: artifacts/launch-video/raw/0N-*.webm + matching *.beats.json
 * (millisecond-precise timestamps of each key beat, used both for the
 * trim-range report and to cut the Clip 4 montage — see montage.mjs).
 *
 * Recording viewport vs. delivery resolution: Hamesh's real Shadow-DOM UI
 * (composer/marker/viewer) is sized in fixed CSS pixels (e.g. `.hm-card` is
 * 300px wide) — it does not scale with the article's own zoom, because it
 * lives in a separate Shadow DOM tree. To make the real, unmodified UI read
 * clearly in a short vertical video, this records at a narrower native
 * viewport (so the fixed-size UI naturally occupies more of the frame — this
 * is exactly how the real extension would render at that window width, nothing
 * is faked), then upscales to the 1080x1920 delivery resolution afterward.
 *
 * Local-only: nothing here is committed, pushed, or uploaded.
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const EXT = path.resolve(ROOT, '.output', 'chrome-mv3');
const FIXTURE_PATH = path.resolve(__dirname, 'fixture.html');
const RAW_DIR = path.resolve(ROOT, 'artifacts', 'launch-video', 'raw');
fs.mkdirSync(RAW_DIR, { recursive: true });

if (!fs.existsSync(EXT)) {
  console.error('Build the extension first: pnpm build');
  process.exit(1);
}

// Native recording viewport (true 9:16, 864x1536 = 96 * 9:16). Narrower than
// the 1080x1920 delivery size on purpose — see file header. The article's
// content column is a fixed 808px (720px max-width + 44px padding each side),
// so 864 leaves a clean ~28px margin on each side without cramping it.
const REC_WIDTH = 864;
const REC_HEIGHT = 1536;
// Delivery resolution the task asked for; the recording gets upscaled to this.
const OUT_WIDTH = 1080;
const OUT_HEIGHT = 1920;

const NOTE_TEXT = 'This insight could change how we onboard new users.';
const EDIT_APPEND = ' — confirmed in this week’s cohort data.';

const FFMPEG = path.join(
  os.homedir(),
  'AppData',
  'Local',
  'ms-playwright',
  'ffmpeg-1011',
  'ffmpeg-win64.exe',
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startServer(html) {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}/`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

// The content script runs in an isolated JS world (see e2e/core-flows.spec.ts
// for the full explanation): a CustomEvent dispatched there reaches main-world
// listeners, but addInitScript is required so the listener can never miss an
// early-firing event.
async function installReadinessHook(page) {
  await page.addInitScript(() => {
    window.__hameshReadyPromise = new Promise((resolve) => {
      window.addEventListener('hamesh:ready', () => resolve(), { once: true });
    });
  });
}

// A CDP screencast recording never shows the OS cursor — it captures rendered
// page pixels only, and the cursor is a compositor-level overlay outside that.
// This injects a page-level (not Hamesh) synthetic macOS-style arrow cursor
// purely as a recording aid, so click targets read clearly on camera. It's
// main-world page JS with no relationship to the extension's own isolated
// world or UI — Hamesh's real UI is untouched.
async function installCursorOverlay(page) {
  await page.addInitScript(() => {
    const CURSOR_SVG =
      '<svg width="30" height="30" viewBox="0 0 28 28" style="display:block;filter:drop-shadow(0 1px 3px rgba(0,0,0,.4))">' +
      '<path d="M4 2 L4 22 L9.5 17.5 L13 25 L16.5 23.5 L13 16 L20 16 Z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/>' +
      '</svg>';
    function ensureCursor() {
      let el = document.getElementById('__rec_cursor__');
      if (!el) {
        el = document.createElement('div');
        el.id = '__rec_cursor__';
        el.style.cssText =
          'position:fixed;top:0;left:0;width:30px;height:30px;pointer-events:none;' +
          'z-index:2147483647;will-change:transform;transform:translate(-2000px,-2000px);';
        el.innerHTML = CURSOR_SVG;
        document.documentElement.appendChild(el);
      }
      return el;
    }
    window.addEventListener(
      'mousemove',
      (e) => {
        ensureCursor().style.transform = `translate(${e.clientX - 2}px, ${e.clientY - 2}px)`;
      },
      { capture: true, passive: true },
    );
  });
}

async function activate(page) {
  await page.evaluate(() => window.__hameshReadyPromise);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));
}

/**
 * Tracks the cursor's last known position and only ever glides smoothly from
 * it — there is no code path in this file that jumps the pointer instantly.
 * `startAt` is where the video's very first frame finds the cursor already
 * resting (no prior on-screen position exists to glide from at that point).
 */
function createCursor(page, startAt) {
  let pos = { ...startAt };
  return {
    async settle() {
      // One real dispatched event so the overlay renders at the start
      // position from the first visible frame, instead of staying hidden
      // off-screen until the first glide's first step.
      await page.mouse.move(pos.x, pos.y);
    },
    async moveTo(target, { durationMs = 450, steps = 26 } = {}) {
      const from = pos;
      const stepDelay = durationMs / steps;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic: decelerate into place
        await page.mouse.move(
          from.x + (target.x - from.x) * eased,
          from.y + (target.y - from.y) * eased,
        );
        await page.waitForTimeout(stepDelay);
      }
      pos = { ...target };
    },
    async clickOn(locator, opts) {
      const box = await locator.boundingBox();
      if (!box) throw new Error('no bounding box for click target');
      const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await this.moveTo(target, opts);
      await page.waitForTimeout(150);
      await page.mouse.click(target.x, target.y);
    },
  };
}

async function centerOf(page, selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no bounding box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function makeBeatLogger() {
  const t0 = Date.now();
  const beats = [];
  return {
    mark(label) {
      const tMs = Date.now() - t0;
      beats.push({ label, tMs });
      console.log(`  [${(tMs / 1000).toFixed(2)}s] ${label}`);
    },
    save(filePath) {
      fs.writeFileSync(filePath, JSON.stringify(beats, null, 2));
    },
  };
}

async function typeSlowly(page, selector, text, delay = 55) {
  await page.locator(selector).pressSequentially(text, { delay });
}

async function finalizeVideo(page, targetName) {
  const video = page.video();
  await page.close();
  const savedPath = await video.path();
  const targetPath = path.join(RAW_DIR, targetName);
  fs.renameSync(savedPath, targetPath);
  return targetPath;
}

/** Upscales the native recording-resolution webm to the delivery resolution
 * in place, preserving aspect ratio (both are exactly 9:16, so this is a
 * pure scale, no letterboxing/cropping needed). Re-encodes VP8 — the bundled
 * ffmpeg has no H.264/MP4 support (see final report for that limitation). */
function upscaleInPlace(filePath) {
  const tmp = filePath.replace(/\.webm$/, '.upscaled.webm');
  execFileSync(FFMPEG, [
    '-y',
    '-i',
    filePath,
    '-vf',
    `scale=${OUT_WIDTH}:${OUT_HEIGHT}:flags=lanczos`,
    '-c:v',
    'libvpx',
    '-crf',
    '10',
    '-b:v',
    '2M',
    '-an',
    tmp,
  ]);
  fs.rmSync(filePath);
  fs.renameSync(tmp, filePath);
}

async function launchContext(userDataDir) {
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    // `--headless=new` (not Playwright's own headless flag) is the only mode
    // that both loads the extension and matches this repo's proven pattern.
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      `--window-size=${REC_WIDTH},${REC_HEIGHT}`,
    ],
    viewport: { width: REC_WIDTH, height: REC_HEIGHT },
    // recordVideo captures rendered page pixels only (via CDP screencast) —
    // no OS window chrome, no tab bar, no address bar ever enters frame.
    // `size` must be set explicitly equal to the viewport, otherwise
    // Playwright silently downscales to fit within 800x800.
    recordVideo: { dir: RAW_DIR, size: { width: REC_WIDTH, height: REC_HEIGHT } },
  });
  // Chrome auto-opens a blank default tab on launch, which recordVideo also
  // captures (as a near-static, low-bitrate junk file). Close it immediately
  // so only the page we explicitly create produces a video.
  for (const p of ctx.pages()) {
    await p.close().catch(() => {});
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Clip 1 — activation-select-write-save
// ---------------------------------------------------------------------------

async function recordClip1(userDataDir, fixtureUrl) {
  console.log('\n=== Clip 1: activation-select-write-save ===');
  const ctx = await launchContext(userDataDir);
  const page = await ctx.newPage();
  // recordVideo starts capturing from newPage(), so the beat logger's zero
  // point must start here too — starting it before launchContext() would
  // bake ~1-1.5s of browser/extension-load overhead into every timestamp.
  const beats = makeBeatLogger();
  beats.mark('recording-start');
  await installReadinessHook(page);
  await installCursorOverlay(page);
  await page.goto(fixtureUrl);

  await page.waitForTimeout(900); // initial hold — let the page visually settle
  beats.mark('page-settled');

  const titleC = await centerOf(page, '[data-demo="title"]');
  const cursor = createCursor(page, titleC);
  await cursor.settle();

  await activate(page);
  await page.locator('.hm-capture').waitFor({ state: 'visible' });
  beats.mark('activated');

  await page.waitForTimeout(350);
  beats.mark('hover-title');

  const p1C = await centerOf(page, '[data-demo="p1"]');
  await cursor.moveTo(p1C, { durationMs: 420 });
  await page.waitForTimeout(350);
  beats.mark('hover-p1');

  // Paragraph 2 (retrieval-practice / testing effect) is the one place in this
  // article a note about "onboarding new users" reads as a natural reaction
  // rather than an arbitrary attachment — anchoring there instead of the
  // title/p1 for a more coherent demo narrative.
  const p2C = await centerOf(page, '[data-demo="p2"]');
  await cursor.moveTo(p2C, { durationMs: 420 });
  await page.waitForTimeout(450); // pre-click pause, settle on intended paragraph
  beats.mark('hover-p2-intended');

  await page.mouse.click(p2C.x, p2C.y);
  beats.mark('clicked-p2');
  await page.locator('.hm-card textarea').waitFor({ state: 'visible' });
  await page.waitForTimeout(500); // composer settle
  beats.mark('composer-visible');

  await typeSlowly(page, '.hm-card textarea', NOTE_TEXT, 55);
  beats.mark('typing-done');
  await page.waitForTimeout(400); // pre-save pause

  await cursor.clickOn(page.getByRole('button', { name: 'Save', exact: true }), {
    durationMs: 350,
  });
  beats.mark('saved');

  await page.locator('.hm-marker').first().waitFor({ state: 'visible' });
  beats.mark('marker-visible');
  await page.waitForTimeout(1800); // hold on the resulting marker

  const outPath = await finalizeVideo(page, '01-activation-select-write-save.webm');
  beats.save(path.join(RAW_DIR, '01-activation-select-write-save.beats.json'));
  await ctx.close();
  upscaleInPlace(outPath);
  console.log('saved:', outPath);
}

// ---------------------------------------------------------------------------
// Clip 2 — return-and-restore (the hero moment)
// ---------------------------------------------------------------------------

async function recordClip2(userDataDir, fixtureUrl) {
  console.log('\n=== Clip 2: return-and-restore ===');
  const ctx = await launchContext(userDataDir);
  const page = await ctx.newPage();
  const beats = makeBeatLogger();
  beats.mark('recording-start');
  await installReadinessHook(page);
  await installCursorOverlay(page);

  // A fresh navigation on the SAME profile directory used in Clip 1 — the
  // note read here comes from the real chrome.storage.local write Clip 1
  // performed through the real UI. Nothing is seeded or faked.
  await page.goto(fixtureUrl);
  beats.mark('page-loaded');
  // A local fixture over localhost loads and restores near-instantly, which
  // reads as too abrupt for "returned to the page" — a brief settle beat
  // gives the moment room to breathe before the marker draws the eye.
  await page.waitForTimeout(500);

  await page.locator('.hm-marker').first().waitFor({ state: 'visible', timeout: 5000 });
  beats.mark('marker-restored');
  await page.waitForTimeout(1600); // hold so restoration reads clearly

  const markerC = await centerOf(page, '.hm-marker');
  const cursor = createCursor(page, { x: markerC.x - 140, y: markerC.y - 60 });
  await cursor.settle();
  await page.waitForTimeout(150);
  await cursor.moveTo(markerC, { durationMs: 550 });
  await page.waitForTimeout(200);

  await page.mouse.click(markerC.x, markerC.y);
  beats.mark('marker-clicked');
  await page.locator('.hm-card .hm-note-body').waitFor({ state: 'visible' });
  beats.mark('note-open');
  await page.waitForTimeout(2200); // hold to read

  const outPath = await finalizeVideo(page, '02-return-and-restore.webm');
  beats.save(path.join(RAW_DIR, '02-return-and-restore.beats.json'));
  await ctx.close();
  upscaleInPlace(outPath);
  console.log('saved:', outPath);
}

// ---------------------------------------------------------------------------
// Clip 3 — edit-note
// ---------------------------------------------------------------------------

async function recordClip3(userDataDir, fixtureUrl) {
  console.log('\n=== Clip 3: edit-note ===');
  const ctx = await launchContext(userDataDir);
  const page = await ctx.newPage();
  const beats = makeBeatLogger();
  beats.mark('recording-start');
  await installReadinessHook(page);
  await installCursorOverlay(page);
  await page.goto(fixtureUrl);
  await page.locator('.hm-marker').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(500);

  const markerC = await centerOf(page, '.hm-marker');
  const cursor = createCursor(page, { x: markerC.x - 120, y: markerC.y - 70 });
  await cursor.settle();
  await page.waitForTimeout(120);

  await cursor.clickOn(page.locator('.hm-marker').first(), { durationMs: 400 });
  await page.locator('.hm-card .hm-note-body').waitFor({ state: 'visible' });
  beats.mark('note-open');
  await page.waitForTimeout(700);

  await cursor.clickOn(page.getByRole('button', { name: 'Edit' }), { durationMs: 380 });
  beats.mark('edit-clicked');
  await page.locator('.hm-card textarea').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);

  await page.locator('.hm-card textarea').click();
  await page.locator('.hm-card textarea').press('End');
  await typeSlowly(page, '.hm-card textarea', EDIT_APPEND, 50);
  beats.mark('typing-done');
  await page.waitForTimeout(400);

  await cursor.clickOn(page.getByRole('button', { name: 'Save changes' }), { durationMs: 380 });
  beats.mark('saved');
  await page.waitForTimeout(1800); // hold on the updated card

  const outPath = await finalizeVideo(page, '03-edit-note.webm');
  beats.save(path.join(RAW_DIR, '03-edit-note.beats.json'));
  await ctx.close();
  upscaleInPlace(outPath);
  console.log('saved:', outPath);
}

// ---------------------------------------------------------------------------

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamesh-launch-video-'));
  console.log('profile dir:', userDataDir);
  const server = await startServer(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  try {
    await recordClip1(userDataDir, server.url);
    await new Promise((r) => setTimeout(r, 600)); // let the profile lock release
    await recordClip2(userDataDir, server.url);
    await new Promise((r) => setTimeout(r, 600));
    await recordClip3(userDataDir, server.url);
  } finally {
    await server.close();
  }
  console.log('\nAll clips recorded and upscaled to', RAW_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
