import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Notes Library — Folders (categories, nested).
 *
 * A note can be filed into a user-defined, arbitrarily-nested folder,
 * independent of which site it came from. The "By site / By folder"
 * switch lives in the same control row the sort control already occupies.
 * Moving a note into a folder works two ways — a "Move to…" menu on the
 * note row, and native HTML5 drag-and-drop onto a folder — both funnel
 * into the same `handleMoveNote`. Deleting a folder unfiles its notes
 * (and its descendant folders' notes) rather than deleting them.
 *
 * Requires the extension to be built first: `pnpm build`.
 */

const EXTENSION_PATH = path.resolve(import.meta.dirname, '..', '.output', 'chrome-mv3');
const FIXTURE_HTML = fs.readFileSync(
  path.resolve(import.meta.dirname, 'fixtures', 'test-page.html'),
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
        url: `http://127.0.0.1:${port}/test-page.html`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function launch(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamesh-e2e-folders-'));
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

async function createNote(page: Page, testId: string, text: string): Promise<void> {
  await page.locator(`[data-testid="${testId}"]`).scrollIntoViewIfNeeded();
  await waitForHameshReady(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('hamesh:activate')));
  await expect(page.locator('.hm-capture')).toBeVisible();
  const box = await page.locator(`[data-testid="${testId}"]`).boundingBox();
  if (!box) throw new Error(`no box for ${testId}`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.click(cx, cy);
  await expect(page.locator('.hm-card textarea')).toBeVisible();
  const markerCountBefore = await page.locator('.hm-marker').count();
  await page.locator('.hm-card textarea').fill(text);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.hm-marker')).toHaveCount(markerCountBefore + 1);
}

async function getExtensionId(context: BrowserContext): Promise<string> {
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return new URL(sw.url()).host;
}

async function switchToFolderMode(page: Page): Promise<void> {
  await page.getByRole('radio', { name: 'By folder' }).check();
}

async function createFolder(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: '+ New folder' }).click();
  await page.locator('.hm-folder-form__input').fill(name);
  await page.locator('.hm-folder-form').getByRole('button', { name: 'Save' }).click();
}

function folderNode(page: Page, name: string) {
  return page.locator('.hm-folder-node').filter({ hasText: name }).first();
}

function folderCount(page: Page, name: string) {
  return folderNode(page, name).locator('.hm-folder-node__count');
}

test.describe('Notes Library — Folders', () => {
  let context: BrowserContext;
  let server: { url: string; close: () => Promise<void> };
  let page: Page;
  let library: Page;
  let extensionId: string;

  test.beforeEach(async () => {
    server = await startServer();
    context = await launch();
    extensionId = await getExtensionId(context);

    page = await context.newPage();
    await installReadinessHook(page);
    await page.goto(server.url);
    await waitForHameshReady(page);

    await createNote(page, 'page-title', 'Note about the heading');
    await createNote(page, 'para-one', 'Note about the paragraph');

    library = await context.newPage();
    await library.goto(`chrome-extension://${extensionId}/notes.html`);
    await expect(library.locator('.hm-note-row')).toHaveCount(2);
  });

  test.afterEach(async () => {
    await context.close();
    await server.close();
  });

  test('switching to folder mode shows the folder tree instead of the domain-grouped list', async () => {
    await expect(library.locator('.hm-groups')).toBeVisible();
    await expect(library.locator('.hm-folder-tree')).toHaveCount(0);

    await switchToFolderMode(library);

    await expect(library.locator('.hm-folder-tree')).toBeVisible();
    await expect(library.locator('.hm-groups')).toHaveCount(0);
    await expect(library.locator('.hm-folder-node--unfiled .hm-folder-node__count')).toHaveText(
      '2 notes',
    );
  });

  test('shows a favicon + domain for each note in folder mode, but not in the domain-grouped view', async () => {
    await expect(library.locator('.hm-note-row__domain')).toHaveCount(0);

    await switchToFolderMode(library);
    await folderNode(library, 'Unfiled').locator('.hm-folder-node__name').click();

    const kickers = library.locator('.hm-note-row__domain');
    await expect(kickers).toHaveCount(2);
    await expect(kickers.first()).toContainText('127.0.0.1');
    await expect(kickers.first().locator('.hm-favicon')).toBeVisible();
  });

  test('creates a top-level folder and a nested sub-folder', async () => {
    await switchToFolderMode(library);
    await createFolder(library, 'Work');
    await expect(library.locator('.hm-folder-node__name', { hasText: 'Work' })).toBeVisible();

    await folderNode(library, 'Work').getByLabel('Add sub-folder').click();
    await library.locator('.hm-folder-form__input').fill('Research');
    await library.locator('.hm-folder-form').getByRole('button', { name: 'Save' }).click();

    await expect(library.locator('.hm-folder-node__name', { hasText: 'Research' })).toBeVisible();
    // Nested under Work, not a sibling top-level folder.
    const topLevel = library.locator('.hm-folder-tree__list > li');
    await expect(topLevel).toHaveCount(2); // Work + the synthetic Unfiled node
  });

  test('clicking anywhere in a folder row toggles it, not just the tiny chevron/name', async () => {
    // The row's hover highlight spans its full width (matching the
    // single-button header used in "By site" mode), which visually promises
    // the whole row is clickable — but only the chevron and the name text
    // originally had click handlers, leaving the folder glyph icon and the
    // row's own padding as dead zones. Reproduces a click on each of those
    // specifically (not the chevron/name), plus confirms the per-row action
    // buttons still don't also toggle the row as a side effect.
    await switchToFolderMode(library);
    await createFolder(library, 'Work');

    const toggle = folderNode(library, 'Work').locator('.hm-folder-node__toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Click the folder glyph icon — not the chevron, not the name. It's
    // `pointer-events: none` by design (see notes-library.css) so the click
    // passes through to the row itself; Playwright's actionability check
    // treats that redirect as "intercepted" and needs `force` to proceed.
    await folderNode(library, 'Work').locator('.hm-folder-node__glyph').click({ force: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // Click the row's own left padding, just left of the chevron.
    const row = folderNode(library, 'Work');
    const box = await row.boundingBox();
    if (!box) throw new Error('no box for Work row');
    await library.mouse.click(box.x + 2, box.y + box.height / 2);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // An action button click must not also toggle the row.
    await row.hover();
    await row.getByLabel('Add sub-folder').click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(library.locator('.hm-folder-form__input')).toBeVisible();
  });

  test('collapsing a folder hides its nested sub-folders, not just its own notes', async () => {
    await switchToFolderMode(library);
    await createFolder(library, 'Work');

    // File a note directly into Work *as well as* giving it a sub-folder —
    // when a folder has both direct notes and a sub-folder, its collapsible
    // `.hm-folder-node__body` renders two children (the notes <ul> and the
    // sub-folder <ul>). CSS grid's `grid-template-rows: 0fr` collapse trick
    // only clips a single grid item: with two direct children, the second
    // one auto-placed into its own implicit row that never collapses, so a
    // folder with only a sub-folder (and no notes of its own) could pass
    // this check while the real, reported bug — a folder with both — did
    // not. Reproducing that exact combination here is the point.
    await folderNode(library, 'Unfiled').locator('.hm-folder-node__name').click();
    await library.locator('.hm-folder-note').first().locator('.hm-folder-menu__trigger').click();
    await library.getByRole('menuitemradio', { name: 'Work', exact: true }).click();

    await folderNode(library, 'Work').getByLabel('Add sub-folder').click();
    await library.locator('.hm-folder-form__input').fill('Research');
    await library.locator('.hm-folder-form').getByRole('button', { name: 'Save' }).click();

    // Adding a sub-folder auto-expands its new parent, so Research starts visible.
    await expect(library.locator('.hm-folder-node__name', { hasText: 'Research' })).toBeVisible();
    await expect(folderCount(library, 'Work')).toHaveText('1 note');

    // The collapsible ancestor's own box height is the ground truth here —
    // `Research` is a deeply-nested <button> whose own bounding box can
    // still report a non-zero, non-empty rect even while a zero-height
    // `overflow: hidden` ancestor clips it from actually being painted
    // anywhere on screen (confirmed by comparing real screenshots before
    // and after collapsing during manual verification of this fix), so
    // `toBeHidden()`/`toBeVisible()` on the descendant itself isn't a
    // reliable signal for this specific clipping pattern — check the
    // clipping container's own geometry instead.
    const workBody = folderNode(library, 'Work').locator(
      'xpath=following-sibling::div[contains(@class, "hm-folder-node__body")]',
    );
    const expandedHeight = (await workBody.boundingBox())?.height ?? 0;
    expect(expandedHeight).toBeGreaterThan(10);

    // Collapsing Work must hide Research too — not just any notes filed
    // directly in Work (a separate <ul> inside the same collapsible body;
    // both need the same CSS treatment to actually clip when collapsed).
    await folderNode(library, 'Work').locator('.hm-folder-node__toggle').click();
    await expect.poll(async () => (await workBody.boundingBox())?.height ?? 0).toBeLessThan(1);

    // Re-expanding brings it back.
    await folderNode(library, 'Work').locator('.hm-folder-node__toggle').click();
    await expect.poll(async () => (await workBody.boundingBox())?.height ?? 0).toBeGreaterThan(10);
  });

  test('moves a note into a folder via the "Move to…" menu', async () => {
    await switchToFolderMode(library);
    await createFolder(library, 'Work');

    await folderNode(library, 'Unfiled').locator('.hm-folder-node__name').click();
    await library.locator('.hm-folder-menu__trigger').first().click();
    await library.getByRole('menuitemradio', { name: 'Work', exact: true }).click();

    await expect(folderCount(library, 'Work')).toHaveText('1 note');
    await expect(folderCount(library, 'Unfiled')).toHaveText('1 note');
  });

  test('the "Move to…" menu is not clipped by the folder tree\'s collapse-animation containers', async () => {
    // The folder tree's expand/collapse animation relies on `overflow:
    // hidden` on its row-list containers, which would clip a plain
    // `position: absolute` popover nested inside them the moment it needed
    // to extend past those bounds. The menu is portaled to the page's
    // `.hm-scope` wrapper instead (not `document.body` — that would escape
    // the `--hm-*` design-token scope and leave the panel unstyled) — assert
    // that directly, plus a real, non-zero rendered size, rather than just
    // "some element with this class exists somewhere".
    await switchToFolderMode(library);
    await folderNode(library, 'Unfiled').locator('.hm-folder-node__name').click();
    await library.locator('.hm-folder-menu__trigger').first().click();

    const panel = library.locator('.hm-folder-menu__panel');
    await expect(panel).toBeVisible();
    const parentHasScopeClass = await panel.evaluate((el) =>
      el.parentElement?.classList.contains('hm-scope'),
    );
    expect(parentHasScopeClass).toBe(true);
    const box = await panel.boundingBox();
    expect(box?.width).toBeGreaterThan(50);
    expect(box?.height).toBeGreaterThan(20);
  });

  test('moves a note into a folder via drag-and-drop', async () => {
    await switchToFolderMode(library);
    await createFolder(library, 'Target Folder');
    await folderNode(library, 'Unfiled').locator('.hm-folder-node__name').click();

    await expect(folderCount(library, 'Unfiled')).toHaveText('2 notes');
    await expect(folderCount(library, 'Target Folder')).toHaveText('0 notes');

    const noteRow = library.locator('.hm-folder-note').first();
    await noteRow.dragTo(folderNode(library, 'Target Folder'));

    await expect(folderCount(library, 'Target Folder')).toHaveText('1 note');
    await expect(folderCount(library, 'Unfiled')).toHaveText('1 note');
  });

  test('the "+ New folder" flow inside the move menu creates a folder and files the note into it', async () => {
    await switchToFolderMode(library);
    await folderNode(library, 'Unfiled').locator('.hm-folder-node__name').click();
    await library.locator('.hm-folder-menu__trigger').first().click();
    await library.getByRole('menuitem', { name: '+ New folder' }).click();
    await library.locator('.hm-folder-menu__input').fill('From menu');
    await library.locator('.hm-folder-menu__create').getByRole('button', { name: 'Save' }).click();

    await expect(folderCount(library, 'From menu')).toHaveText('1 note');
    await expect(folderCount(library, 'Unfiled')).toHaveText('1 note');
  });

  test('renames a folder', async () => {
    await switchToFolderMode(library);
    await createFolder(library, 'Old name');

    await folderNode(library, 'Old name').getByLabel('Rename folder').click();
    await library.locator('.hm-folder-form__input').fill('New name');
    await library.locator('.hm-folder-form').getByRole('button', { name: 'Save' }).click();

    await expect(library.locator('.hm-folder-node__name', { hasText: 'New name' })).toBeVisible();
    await expect(library.locator('.hm-folder-node__name', { hasText: 'Old name' })).toHaveCount(0);
  });

  test('deleting a folder unfiles its notes and removes its descendant folders — never deletes the notes', async () => {
    await switchToFolderMode(library);
    await createFolder(library, 'Parent');
    await folderNode(library, 'Unfiled').locator('.hm-folder-node__name').click();
    await library.locator('.hm-folder-menu__trigger').first().click();
    await library.getByRole('menuitemradio', { name: 'Parent', exact: true }).click();

    await folderNode(library, 'Parent').getByLabel('Add sub-folder').click();
    await library.locator('.hm-folder-form__input').fill('Child');
    await library.locator('.hm-folder-form').getByRole('button', { name: 'Save' }).click();

    await expect(folderCount(library, 'Parent')).toHaveText('1 note');

    await folderNode(library, 'Parent').getByLabel('Delete folder').click();
    await library.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(library.locator('.hm-folder-node__name', { hasText: 'Parent' })).toHaveCount(0);
    await expect(library.locator('.hm-folder-node__name', { hasText: 'Child' })).toHaveCount(0);
    // Both notes are still present overall — deleting the folder only unfiled them.
    await expect(folderCount(library, 'Unfiled')).toHaveText('2 notes');
  });

  test('folder assignments persist across a reload', async () => {
    await switchToFolderMode(library);
    await createFolder(library, 'Persisted');
    await folderNode(library, 'Unfiled').locator('.hm-folder-node__name').click();
    await library.locator('.hm-folder-menu__trigger').first().click();
    await library.getByRole('menuitemradio', { name: 'Persisted', exact: true }).click();
    await expect(folderCount(library, 'Persisted')).toHaveText('1 note');

    await library.reload();
    await switchToFolderMode(library);
    await expect(folderCount(library, 'Persisted')).toHaveText('1 note');
  });

  test('search still filters notes while in folder mode', async () => {
    await switchToFolderMode(library);
    await createFolder(library, 'Work');
    await folderNode(library, 'Unfiled').locator('.hm-folder-node__name').click();
    await library.locator('.hm-folder-menu__trigger').first().click();
    await library.getByRole('menuitemradio', { name: 'Work', exact: true }).click();

    await library.getByPlaceholder('Search notes…').fill('paragraph');
    // The mode switch hides while searching (same as the sort control), but
    // the tree/list swap it already selected stays in effect.
    await expect(library.locator('.hm-folder-tree')).toBeVisible();
    await expect(library.locator('.hm-note-row')).toHaveCount(1);
    await expect(library.locator('.hm-note-row')).toContainText('paragraph');
  });

  test('the Notes Library renders the folder tree correctly in Arabic/RTL', async () => {
    await switchToFolderMode(library);
    await createFolder(library, 'Work');

    await library.getByRole('button', { name: 'Settings' }).click();
    await library.getByRole('radio', { name: 'Arabic' }).check();
    await library.getByRole('button', { name: 'مكتبة الملاحظات' }).click();

    await expect(library.locator('.hm-scope')).toHaveAttribute('dir', 'rtl');
    await library.getByRole('radio', { name: 'حسب الفولدر' }).check();
    await expect(library.locator('.hm-folder-tree')).toBeVisible();
    await expect(library.locator('.hm-folder-node__name', { hasText: 'Work' })).toBeVisible();
  });
});
