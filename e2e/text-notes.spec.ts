import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Hamesh E2E — contextual text notes ("هوامش").
 *
 * Drives the real flow in a real browser: select text → the action chip
 * appears → click it → the existing composer opens → save → the text is
 * highlighted, and still highlighted after a reload. The highlight itself is
 * painted with the CSS Custom Highlight API, which has no DOM node, so it is
 * asserted through `CSS.highlights` — a check that can only be made in a real
 * Chromium, which is the reason this lives here rather than in a jsdom test.
 *
 * Requires a build first: `pnpm build` (see e2e/core-flows.spec.ts).
 */

const EXTENSION_PATH = path.resolve(import.meta.dirname, '..', '.output', 'chrome-mv3');
const FIXTURE_HTML = fs.readFileSync(
  path.resolve(import.meta.dirname, 'fixtures', 'text-page.html'),
  'utf8',
);

function startServer(): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(FIXTURE_HTML);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}/text-page.html`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function getExtensionId(context: BrowserContext): Promise<string> {
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return new URL(sw.url()).host;
}

async function launch(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamesh-e2e-text-'));
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

/**
 * Selects `needle` inside the given paragraph with a real mouse drag, so the
 * content script sees genuine mousedown/mousemove/mouseup — the sequence the
 * "only after the drag finishes" rule depends on. Falls back to setting the
 * selection programmatically and dispatching a trusted-shaped mouseup only
 * for the multi-element case, where dragging by coordinates is unreliable.
 */
async function selectPhrase(page: Page, testId: string, needle: string): Promise<void> {
  const box = await page.evaluate(
    ([id, text]) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) throw new Error(`no element ${id}`);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const data = (node as Text).data;
        const at = data.indexOf(text);
        if (at === -1) continue;
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + text.length);
        const rect = range.getBoundingClientRect();
        return { x: rect.left, y: rect.top + rect.height / 2, right: rect.right };
      }
      throw new Error(`"${text}" not found in ${id}`);
    },
    [testId, needle] as const,
  );

  await page.mouse.move(box.x + 1, box.y);
  await page.mouse.down();
  await page.mouse.move(box.right - 1, box.y, { steps: 12 });
  await page.mouse.up();
}

const actionChip = (page: Page) => page.locator('.hm-text-action');

/** Ranges currently painted under Hamesh's highlight registration. */
async function highlightCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const highlights = (CSS as unknown as { highlights?: Map<string, { size: number }> })
      .highlights;
    return highlights?.get('hamesh-text')?.size ?? 0;
  });
}

test.describe('Hamesh contextual text notes', () => {
  let context: BrowserContext;
  let server: { url: string; close: () => Promise<void> };

  test.beforeEach(async () => {
    server = await startServer();
    context = await launch();
  });
  test.afterEach(async () => {
    await context.close();
    await server.close();
  });

  test('select → chip → composer → save → highlight, surviving a reload', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);

    // Selecting alone must not open anything.
    await selectPhrase(page, 'para-one', 'Measuring it honestly');
    await expect(actionChip(page)).toBeVisible();
    await expect(page.locator('.hm-card textarea')).toHaveCount(0);

    // Only the explicit click opens the existing composer, with the exact
    // selected text attached.
    await actionChip(page).click();
    await expect(page.locator('.hm-card textarea')).toBeVisible();
    await expect(page.locator('.hm-attached__quote')).toHaveText('Measuring it honestly');

    await page.locator('.hm-card textarea').fill('Come back to this measurement point.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.locator('.hm-card textarea')).toHaveCount(0);
    await expect.poll(() => highlightCount(page)).toBe(1);

    await page.reload();
    await waitForHameshReady(page);
    await expect.poll(() => highlightCount(page)).toBe(1);

    await page.close();
  });

  test('cancelling creates no note and no highlight', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);

    await selectPhrase(page, 'para-one', 'Measuring it honestly');
    await actionChip(page).click();
    await expect(page.locator('.hm-card textarea')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.hm-card')).toHaveCount(0);
    await expect(actionChip(page)).toHaveCount(0);
    expect(await highlightCount(page)).toBe(0);

    await page.reload();
    await waitForHameshReady(page);
    expect(await highlightCount(page)).toBe(0);

    await page.close();
  });

  test('the chip goes away on Escape and when the selection is cleared', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);

    await selectPhrase(page, 'para-one', 'Measuring it honestly');
    await expect(actionChip(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(actionChip(page)).toHaveCount(0);

    await selectPhrase(page, 'para-two', 'anchoring interesting');
    await expect(actionChip(page)).toBeVisible();
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    await expect(actionChip(page)).toHaveCount(0);

    await page.close();
  });

  test('restores the second of two identical phrases, not the first', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);

    // The fixture repeats "extremely important" in both paragraphs; this
    // anchors the one in the *second*.
    await selectPhrase(page, 'para-two', 'extremely important');
    await actionChip(page).click();
    await page.locator('.hm-card textarea').fill('The second occurrence.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => highlightCount(page)).toBe(1);

    await page.reload();
    await waitForHameshReady(page);
    await expect.poll(() => highlightCount(page)).toBe(1);

    const inSecondParagraph = await page.evaluate(() => {
      const highlights = (
        CSS as unknown as { highlights?: Map<string, Iterable<Range>> }
      ).highlights?.get('hamesh-text');
      const range = highlights ? [...highlights][0] : null;
      if (!range) return null;
      const target = document.querySelector('[data-testid="para-two"]');
      return !!target && target.contains(range.startContainer);
    });
    expect(inSecondParagraph).toBe(true);

    await page.close();
  });

  test('the keyboard shortcut creates a note from the current selection, and does nothing without one', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);

    // No selection: the shortcut must not open an empty contextual note.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate-text')));
    await expect(page.locator('.hm-card textarea')).toHaveCount(0);

    await selectPhrase(page, 'para-one', 'Measuring it honestly');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate-text')));
    await expect(page.locator('.hm-card textarea')).toBeVisible();
    await expect(page.locator('.hm-attached__quote')).toHaveText('Measuring it honestly');

    await page.locator('.hm-card textarea').fill('Created from the keyboard.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => highlightCount(page)).toBe(1);

    await page.close();
  });

  test('hovering highlighted text opens a popup that survives the trip into it', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);

    await selectPhrase(page, 'para-one', 'Measuring it honestly');
    await actionChip(page).click();
    await page.locator('.hm-card textarea').fill('Hover me.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => highlightCount(page)).toBe(1);
    // Dismiss the selection left behind by the drag.
    await page.evaluate(() => window.getSelection()?.removeAllRanges());

    const target = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="para-one"]')!;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const node = walker.nextNode() as Text;
      const at = node.data.indexOf('Measuring it honestly');
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + 'Measuring it honestly'.length);
      const rect = range.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });

    await page.mouse.move(target.x, target.y);
    const popup = page.locator('.hm-text-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('Hover me.');
    // Minimal by design — the same dot-and-one-line pill a video marker
    // shows, with no timestamp and no buttons of its own.
    await expect(popup.locator('button')).toHaveCount(0);
    await expect(popup).toHaveClass(/hm-video-preview/);
    await expect(popup.locator('.hm-video-preview__dot')).toBeVisible();
    await expect(popup.locator('.hm-video-preview__time')).toHaveCount(0);
    // Highlighted text reads as clickable while the pointer is over it.
    await expect
      .poll(() =>
        page.evaluate(
          () => getComputedStyle(document.querySelector('[data-testid="para-one"]')!).cursor,
        ),
      )
      .toBe('pointer');

    // Move into the popup itself — it must not vanish on the way.
    const box = await popup.boundingBox();
    if (!box) throw new Error('popup has no box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
    await expect(popup).toBeVisible();

    // Leaving the highlight releases the page's cursor again.
    await page.mouse.move(5, 5, { steps: 4 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.hasAttribute('data-hamesh-text-hover')),
      )
      .toBe(false);
    await page.mouse.move(target.x, target.y);
    await expect(popup).toBeVisible();

    // And it opens the ordinary note viewer, with edit/delete as usual.
    await popup.click();
    await expect(page.locator('.hm-viewer-card')).toBeVisible();
    await expect(page.locator('.hm-viewer-card .hm-note-body')).toHaveText('Hover me.');
    await expect(page.locator('.hm-viewer-card .hm-attached__quote')).toHaveText(
      'Measuring it honestly',
    );
    await expect(
      page.locator('.hm-viewer-card').getByRole('button', { name: 'Edit' }),
    ).toBeVisible();
    await expect(
      page.locator('.hm-viewer-card').getByRole('button', { name: 'Delete' }),
    ).toBeVisible();

    await page.close();
  });

  test('disabling the feature hides it from the page without touching the note', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);

    await selectPhrase(page, 'para-one', 'Measuring it honestly');
    await actionChip(page).click();
    await page.locator('.hm-card textarea').fill('Survives being switched off.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => highlightCount(page)).toBe(1);

    // Turn contextual text notes off from the Notes Library's Settings.
    const extensionId = await getExtensionId(context);
    const library = await context.newPage();
    await library.goto(`chrome-extension://${extensionId}/notes.html`);
    await library.getByRole('button', { name: 'Settings' }).click();
    await library
      .getByRole('radiogroup', { name: 'Notes on selected text' })
      .getByRole('radio', { name: 'Off' })
      .check();

    // The page-side presence goes away — no highlight, and no chip on a new
    // selection — because the preference change is broadcast to open tabs.
    await expect.poll(() => highlightCount(page)).toBe(0);
    await selectPhrase(page, 'para-two', 'anchoring interesting');
    await expect(actionChip(page)).toHaveCount(0);

    // The note itself is untouched: still listed, still carrying its
    // attached text, in the Notes Library.
    await library.getByRole('button', { name: 'Notes Library' }).click();
    await library.locator('.hm-group__header').first().click();
    await expect(library.locator('.hm-note-row__preview')).toContainText(
      'Survives being switched off.',
    );
    await expect(library.locator('.hm-note-row .hm-attached__quote')).toHaveText(
      'Measuring it honestly',
    );

    // Switching it back on restores the highlight from the same stored anchor.
    await library.getByRole('button', { name: 'Settings' }).click();
    await library
      .getByRole('radiogroup', { name: 'Notes on selected text' })
      .getByRole('radio', { name: 'On' })
      .check();
    await expect.poll(() => highlightCount(page)).toBe(1);

    await library.close();
    await page.close();
  });

  test('opening a contextual note from the Notes Library scrolls to its text and flashes it', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);

    // Anchored well below the fold, so restoring it requires a real scroll.
    await selectPhrase(page, 'para-far', 'well below the fold');
    await actionChip(page).click();
    await page.locator('.hm-card textarea').fill('Find me from the library.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => highlightCount(page)).toBe(1);
    await page.close();

    const extensionId = await getExtensionId(context);
    const library = await context.newPage();
    await library.goto(`chrome-extension://${extensionId}/notes.html`);
    await library.getByRole('button', { name: /127\.0\.0\.1/ }).click();
    const row = library.locator('.hm-note-row', { hasText: 'Find me from the library.' });
    await expect(row).toBeVisible();
    await expect(row.locator('.hm-attached__quote')).toHaveText('well below the fold');

    const [restored] = await Promise.all([context.waitForEvent('page'), row.click()]);
    await restored.waitForLoadState('domcontentloaded');

    // The viewer opens with the note and its attached text…
    await expect(restored.locator('.hm-viewer-card .hm-note-body')).toHaveText(
      'Find me from the library.',
      { timeout: 10000 },
    );
    await expect(restored.locator('.hm-viewer-card .hm-attached__quote')).toHaveText(
      'well below the fold',
    );
    // …the page actually scrolled to it…
    await expect.poll(() => restored.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    // …and the highlight is painted (briefly under the emphasis registration).
    await expect
      .poll(() =>
        restored.evaluate(() => {
          const highlights = (CSS as unknown as { highlights?: Map<string, { size: number }> })
            .highlights;
          return (
            (highlights?.get('hamesh-text')?.size ?? 0) +
            (highlights?.get('hamesh-text-flash')?.size ?? 0)
          );
        }),
      )
      .toBe(1);

    await restored.close();
    await library.close();
  });

  test('a contextual note is an ordinary note: edit and delete work, and deleting clears the highlight', async () => {
    const page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);

    await selectPhrase(page, 'para-one', 'Measuring it honestly');
    await actionChip(page).click();
    await page.locator('.hm-card textarea').fill('Original contextual note.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => highlightCount(page)).toBe(1);
    await page.evaluate(() => window.getSelection()?.removeAllRanges());

    const point = await page.evaluate(() => {
      const highlights = (
        CSS as unknown as { highlights?: Map<string, Iterable<Range>> }
      ).highlights?.get('hamesh-text');
      const range = [...(highlights ?? [])][0];
      const rect = range.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });

    await page.mouse.move(point.x, point.y);
    await page.locator('.hm-text-popup').click();

    await page.locator('.hm-viewer-card').getByRole('button', { name: 'Edit' }).click();
    await page.locator('.hm-viewer-card textarea').fill('Edited contextual note.');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await page.reload();
    await waitForHameshReady(page);
    await expect.poll(() => highlightCount(page)).toBe(1);

    // Delete through the same viewer every other note uses.
    const afterReload = await page.evaluate(() => {
      const highlights = (
        CSS as unknown as { highlights?: Map<string, Iterable<Range>> }
      ).highlights?.get('hamesh-text');
      const range = [...(highlights ?? [])][0];
      const rect = range.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    await page.mouse.move(afterReload.x, afterReload.y);
    await expect(page.locator('.hm-text-popup')).toContainText('Edited contextual note.');
    await page.locator('.hm-text-popup').click();
    await page.locator('.hm-viewer-card').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect.poll(() => highlightCount(page)).toBe(0);
    await page.reload();
    await waitForHameshReady(page);
    await expect.poll(() => highlightCount(page)).toBe(0);

    await page.close();
  });
});
