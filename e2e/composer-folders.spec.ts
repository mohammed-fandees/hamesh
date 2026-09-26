import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Writing a note, end to end against the real extension:
 *
 * - The composer survives a single click outside it — only Cancel, Escape
 *   or a double-click outside close it — so a stray click can't throw a
 *   draft away.
 * - The folder a note is filed into is chosen in the composer itself, and
 *   a page default beats a global default, which beats nothing at all.
 * - A long note can be read in full from the Notes Library.
 *
 * The fixture server answers every path with the same page, so
 * `/other.html` is a genuinely different page (a different page key) with
 * identical content.
 *
 * Requires the extension to be built first: `pnpm build`.
 */

const EXTENSION_PATH = path.resolve(import.meta.dirname, '..', '.output', 'chrome-mv3');
const FIXTURE_HTML = fs.readFileSync(
  path.resolve(import.meta.dirname, 'fixtures', 'test-page.html'),
  'utf8',
);

function startServer(): Promise<{ origin: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(FIXTURE_HTML);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function launch(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamesh-e2e-composer-'));
  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
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

async function getExtensionId(context: BrowserContext): Promise<string> {
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return new URL(sw.url()).host;
}

/** Opens a fresh tab on `url`, ready for Hamesh. */
async function openPage(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage();
  await installReadinessHook(page);
  await page.goto(url);
  await waitForHameshReady(page);
  return page;
}

/** Selection mode → click the page heading → the composer is open. */
async function openComposer(page: Page): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));
  await expect(page.locator('.hm-capture')).toBeVisible();
  const box = await page.locator('[data-testid="page-title"]').boundingBox();
  if (!box) throw new Error('no box for the page title');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.click(cx, cy);
  await expect(page.locator('.hm-card textarea')).toBeVisible();
}

async function save(page: Page, text: string): Promise<void> {
  await page.locator('.hm-card textarea').fill(text);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.hm-card textarea')).toHaveCount(0);
}

/** A point on the page well clear of the heading, its composer and any
 *  marker: the empty margin to the right of the fixture's centered body. */
async function emptyMargin(page: Page): Promise<{ x: number; y: number }> {
  const width = await page.evaluate(() => window.innerWidth);
  return { x: width - 24, y: 24 };
}

const folderSelect = (page: Page) => page.getByRole('combobox', { name: 'Folder' });
const star = (page: Page) => page.getByRole('button', { name: 'Default folder' });

async function createFolderFromComposer(page: Page, name: string): Promise<void> {
  const emptyState = page.getByRole('button', { name: '+ Create folder' });
  if (await emptyState.isVisible()) await emptyState.click();
  else await folderSelect(page).selectOption({ label: '+ New folder…' });
  const input = page.getByRole('textbox', { name: 'New folder' });
  await input.fill(name);
  await input.press('Enter');
  await expect(folderSelect(page).locator('option:checked')).toHaveText(name);
}

test.describe('Composer — closing it', () => {
  let context: BrowserContext;
  let server: { origin: string; close: () => Promise<void> };

  test.beforeEach(async () => {
    server = await startServer();
    context = await launch();
  });
  test.afterEach(async () => {
    await context.close();
    await server.close();
  });

  test('a single click outside keeps the draft; a double click outside closes it', async () => {
    const page = await openPage(context, `${server.origin}/test-page.html`);
    await openComposer(page);
    await page.locator('.hm-card textarea').fill('Half a thought');

    const outside = await emptyMargin(page);
    await page.mouse.click(outside.x, outside.y);
    // Also on the page's own text, the likeliest stray click of all.
    const para = await page.locator('[data-testid="para-one"]').boundingBox();
    if (!para) throw new Error('no box for para-one');
    await page.mouse.click(para.x + para.width - 8, para.y + para.height - 6);

    await expect(page.locator('.hm-card textarea')).toHaveValue('Half a thought');

    await page.mouse.dblclick(outside.x, outside.y);
    await expect(page.locator('.hm-card textarea')).toHaveCount(0);
    await expect(page.locator('.hm-marker')).toHaveCount(0);
    // The double click that closed it doesn't leave a word selected behind.
    await expect(page.locator('.hm-text-action')).toHaveCount(0);
  });

  test('Cancel and Escape still close it', async () => {
    const page = await openPage(context, `${server.origin}/test-page.html`);
    await openComposer(page);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.hm-card textarea')).toHaveCount(0);

    await openComposer(page);
    await page.locator('.hm-card textarea').press('Escape');
    await expect(page.locator('.hm-card textarea')).toHaveCount(0);
  });

  test('the note viewer still closes on a single click outside', async () => {
    const page = await openPage(context, `${server.origin}/test-page.html`);
    await openComposer(page);
    await save(page, 'A saved note');
    await page.locator('.hm-marker').first().click();
    await expect(page.locator('.hm-card .hm-note-body')).toHaveText('A saved note');

    const outside = await emptyMargin(page);
    await page.mouse.click(outside.x, outside.y);
    await expect(page.locator('.hm-card')).toHaveCount(0);
  });
});

test.describe('Composer — choosing a folder', () => {
  let context: BrowserContext;
  let server: { origin: string; close: () => Promise<void> };
  let extensionId: string;

  test.beforeEach(async () => {
    server = await startServer();
    context = await launch();
    extensionId = await getExtensionId(context);
  });
  test.afterEach(async () => {
    await context.close();
    await server.close();
  });

  test('with no folders yet, offers to create one on the spot — and never requires it', async () => {
    const page = await openPage(context, `${server.origin}/test-page.html`);
    await openComposer(page);
    await expect(page.getByText('No folders yet.')).toBeVisible();
    await save(page, 'Unfiled, and that is fine');

    await openComposer(page);
    await createFolderFromComposer(page, 'Research');
    await save(page, 'Filed from the composer');

    const library = await context.newPage();
    await library.goto(`chrome-extension://${extensionId}/notes.html`);
    await library.getByRole('radio', { name: 'By folder' }).check();
    const research = library.locator('.hm-folder-node').filter({ hasText: 'Research' }).first();
    await expect(research.locator('.hm-folder-node__count')).toHaveText('1 note');
    await expect(library.locator('.hm-folder-node--unfiled .hm-folder-node__count')).toHaveText(
      '1 note',
    );
  });

  test('a page default wins on its page, a global default applies everywhere else', async () => {
    const first = await openPage(context, `${server.origin}/test-page.html`);
    await openComposer(first);
    await createFolderFromComposer(first, 'Work');
    await createFolderFromComposer(first, 'Reading');

    // Work → default for this page only.
    await folderSelect(first).selectOption({ label: 'Work' });
    await star(first).click();
    await first.getByRole('checkbox', { name: 'Default for this page' }).check();
    await save(first, 'First note on page one');

    // Reopened on the same page: Work, and the composer says why.
    await openComposer(first);
    await expect(folderSelect(first).locator('option:checked')).toHaveText('Work');
    await expect(first.locator('.hm-folder-picker__caption')).toHaveText('Default for this page');
    await first.getByRole('button', { name: 'Cancel' }).click();

    // A different page is untouched by that page default.
    const second = await openPage(context, `${server.origin}/other.html`);
    await openComposer(second);
    await expect(folderSelect(second)).toHaveValue('');

    // Reading → default for all pages.
    await folderSelect(second).selectOption({ label: 'Reading' });
    await star(second).click();
    await second.getByRole('checkbox', { name: 'Default for all pages' }).check();
    await save(second, 'Note on page two');

    // Page one still prefers its own default over the global one…
    await first.reload();
    await waitForHameshReady(first);
    await openComposer(first);
    await expect(folderSelect(first).locator('option:checked')).toHaveText('Work');
    await first.getByRole('button', { name: 'Cancel' }).click();

    // …while any other page now starts in Reading.
    const third = await openPage(context, `${server.origin}/third.html`);
    await openComposer(third);
    await expect(folderSelect(third).locator('option:checked')).toHaveText('Reading');
    await third.getByRole('button', { name: 'Cancel' }).click();

    // Clearing page one's default hands it back to the global default.
    await openComposer(first);
    await star(first).click();
    await first.getByRole('checkbox', { name: 'Default for this page' }).uncheck();
    await first.getByRole('button', { name: 'Cancel' }).click();
    await openComposer(first);
    await expect(folderSelect(first).locator('option:checked')).toHaveText('Reading');
  });
});

test.describe('Notes Library — long notes', () => {
  let context: BrowserContext;
  let server: { origin: string; close: () => Promise<void> };
  let extensionId: string;

  const LONG_NOTE = Array.from(
    { length: 12 },
    (_, i) => `Paragraph ${i + 1}: encoding turns what we perceive into something memory can keep.`,
  ).join('\n');

  test.beforeEach(async () => {
    server = await startServer();
    context = await launch();
    extensionId = await getExtensionId(context);

    const page = await openPage(context, `${server.origin}/test-page.html`);
    await openComposer(page);
    await save(page, 'Short note');
    await page.locator('[data-testid="para-two"]').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));
    const box = await page.locator('[data-testid="para-two"]').boundingBox();
    if (!box) throw new Error('no box for para-two');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await save(page, LONG_NOTE);
  });
  test.afterEach(async () => {
    await context.close();
    await server.close();
  });

  for (const viewport of [
    { name: 'a wide window', width: 1280, height: 800 },
    { name: 'a narrow window', width: 380, height: 720 },
  ]) {
    test(`a long note can be expanded and read in full, in ${viewport.name}`, async () => {
      const library = await context.newPage();
      await library.setViewportSize({ width: viewport.width, height: viewport.height });
      await library.goto(`chrome-extension://${extensionId}/notes.html`);
      await library.getByRole('button', { name: /127\.0\.0\.1/ }).click();

      const short = library.locator('.hm-note-row', { hasText: 'Short note' });
      const long = library.locator('.hm-note-row', { hasText: 'Paragraph 1:' });
      await expect(short.getByRole('button', { name: 'Show more' })).toHaveCount(0);

      const preview = long.locator('.hm-note-row__preview');
      const clampedHeight = (await preview.boundingBox())!.height;
      const pagesBefore = context.pages().length;
      // How far the page overflows sideways — measured against its own
      // client width, so a vertical scrollbar appearing when the note grows
      // (which narrows both) isn't mistaken for a change.
      const sidewaysOverflow = () =>
        library.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
      const overflowBefore = await sidewaysOverflow();

      await long.getByRole('button', { name: 'Show more' }).click();

      await expect(preview).toHaveAttribute('data-expanded', 'true');
      const expandedHeight = (await preview.boundingBox())!.height;
      expect(expandedHeight).toBeGreaterThan(clampedHeight * 2);
      // Capped, never taller than most of the window: the rest of the list
      // stays within reach.
      expect(expandedHeight).toBeLessThanOrEqual(viewport.height * 0.55 + 1);
      // The line breaks it was written with are kept.
      expect(await preview.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('pre-wrap');
      // Expanding reads the note; it doesn't open it.
      expect(context.pages().length).toBe(pagesBefore);
      // The row stays inside the window even at phone width, and expanding
      // it never widens the page.
      const row = (await long.boundingBox())!;
      expect(row.x + row.width).toBeLessThanOrEqual(viewport.width);
      expect(await sidewaysOverflow()).toBeLessThanOrEqual(overflowBefore);

      await long.getByRole('button', { name: 'Show less' }).click();
      await expect(preview).toHaveAttribute('data-expanded', 'false');
      // Library order is untouched by any of this.
      await expect(library.locator('.hm-note-row')).toHaveCount(2);
    });
  }

  test('the rest of a long note’s card still opens it', async () => {
    const library = await context.newPage();
    await library.goto(`chrome-extension://${extensionId}/notes.html`);
    await library.getByRole('button', { name: /127\.0\.0\.1/ }).click();
    const long = library.locator('.hm-note-row', { hasText: 'Paragraph 1:' });

    // A point on the "Edited …" line — outside the link's own content, so
    // it's the stretched link over the card that has to catch it.
    const card = (await long.boundingBox())!;
    const meta = (await long.locator('.hm-note-row__meta').boundingBox())!;
    const [opened] = await Promise.all([
      context.waitForEvent('page'),
      long.click({ position: { x: meta.x - card.x + 4, y: meta.y - card.y + meta.height / 2 } }),
    ]);
    await opened.waitForLoadState('domcontentloaded');
    expect(new URL(opened.url()).pathname).toBe('/test-page.html');
  });
});
