import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Notes Library — note actions menu (`NoteActionsMenu.tsx`).
 *
 * The "⋮" trigger on a note row — pin/unpin, edit, and delete, from the
 * domain-grouped ("By site") view, the folder-tree ("By folder") view, and
 * the Pinned section. "Move to folder" is folder-tree-only: the other two
 * views' rows are meant to stay a quicker, flatter list of actions, so that
 * section is omitted there entirely, not just left empty. Folder mode's
 * move-to-folder mechanics (creating folders, nesting, drag-and-drop) are
 * already covered by `library-folders.spec.ts`; this spec focuses on the
 * menu itself, the pin/edit/delete actions in every view, and folder mode's
 * current-folder indicator in the move list.
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
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamesh-e2e-noteactions-'));
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

test.describe('Notes Library — note actions menu', () => {
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

  test.describe('domain ("By site") mode', () => {
    test.beforeEach(async () => {
      // Domain groups start collapsed — expand the (single, since both
      // notes share a host) group to reveal the rows and their menus.
      await library.locator('.hm-group__header').first().click();
      await expect(library.locator('.hm-folder-menu__trigger').first()).toBeVisible();
    });

    test('shows pin/unpin, edit, and delete, but not move-to-folder', async () => {
      await library.locator('.hm-folder-menu__trigger').first().click();
      const panel = library.locator('.hm-folder-menu__panel');
      await expect(panel).toBeVisible();
      const items = await panel.getByRole('menuitem').allInnerTexts();
      expect(items).toEqual(
        expect.arrayContaining([expect.stringContaining('Pin this note'), 'Edit', 'Delete']),
      );
      // Domain mode's rows stay a flatter list of actions — no "Move to
      // folder" section here (folder-tree-only, see NoteActionsMenu.tsx).
      await expect(panel.getByText('Move to folder')).toHaveCount(0);
      await expect(panel.getByText('No folder')).toHaveCount(0);
      await expect(panel.getByRole('menuitem', { name: '+ New folder' })).toHaveCount(0);
    });

    test('pins and unpins a note', async () => {
      const row = library.locator('.hm-note-row').first();
      await expect(row.locator('.hm-note-row__title svg')).toHaveCount(0);

      await library.locator('.hm-folder-menu__trigger').first().click();
      await library.getByRole('menuitem', { name: 'Pin this note', exact: true }).click();
      await expect(row.locator('.hm-note-row__title svg')).toBeVisible();

      await library.locator('.hm-folder-menu__trigger').first().click();
      await library.getByRole('menuitem', { name: 'Unpin this note', exact: true }).click();
      await expect(row.locator('.hm-note-row__title svg')).toHaveCount(0);
    });

    test('edits a note’s content in place', async () => {
      await library.locator('.hm-folder-menu__trigger').first().click();
      await library.getByRole('menuitem', { name: 'Edit', exact: true }).click();

      const textarea = library.locator('.hm-folder-menu__edit textarea');
      await expect(textarea).toBeVisible();
      await textarea.fill('Edited from the library');
      await library.getByRole('button', { name: 'Save changes' }).click();

      await expect(library.locator('.hm-note-row__preview').first()).toHaveText(
        'Edited from the library',
      );
    });

    test('cancelling an edit steps back to the menu, leaving the note unchanged', async () => {
      const originalText = await library.locator('.hm-note-row__preview').first().innerText();
      await library.locator('.hm-folder-menu__trigger').first().click();
      await library.getByRole('menuitem', { name: 'Edit', exact: true }).click();
      await library.locator('.hm-folder-menu__edit textarea').fill('Should not be saved');
      await library.getByRole('button', { name: 'Cancel' }).click();

      // Cancel steps back to the main menu view (same "one level at a time"
      // behavior as Escape) rather than closing the panel outright.
      await expect(library.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
      await expect(library.locator('.hm-note-row__preview').first()).toHaveText(originalText);
    });

    test('deletes a note after a confirm step', async () => {
      await expect(library.locator('.hm-note-row')).toHaveCount(2);
      await library.locator('.hm-folder-menu__trigger').first().click();
      await library.getByRole('menuitem', { name: 'Delete', exact: true }).click();

      // Two-step confirm — the menu swaps to a "keep it / delete" panel,
      // same pattern as the on-page NoteViewer and folder deletion.
      await expect(library.getByText(/Delete this note\?/)).toBeVisible();
      await library.getByRole('button', { name: 'Keep it' }).click();
      await expect(library.locator('.hm-note-row')).toHaveCount(2);

      // "Keep it" steps back to the main menu view — the panel is still
      // open, so re-clicking the trigger here would close it instead.
      await expect(library.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible();
      await library.getByRole('menuitem', { name: 'Delete', exact: true }).click();
      await library.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(library.locator('.hm-note-row')).toHaveCount(1);
    });
  });

  test.describe('folder ("By folder") mode', () => {
    test.beforeEach(async () => {
      await library.getByRole('radio', { name: 'By folder' }).check();
      await library.locator('.hm-folder-node--unfiled .hm-folder-node__name').click();
      await expect(library.locator('.hm-folder-menu__trigger').first()).toBeVisible();
    });

    test('the same menu also offers pin/unpin, edit, and delete alongside move-to-folder', async () => {
      await library.locator('.hm-folder-menu__trigger').first().click();
      const panel = library.locator('.hm-folder-menu__panel');
      // The move-to-folder list items use `menuitemradio` (one is always
      // "checked" — the note's current folder, or "No folder") rather than
      // plain `menuitem`, so both roles need collecting here.
      const items = await panel.getByRole('menuitem').allInnerTexts();
      const radioItems = await panel.getByRole('menuitemradio').allInnerTexts();
      expect([...items, ...radioItems]).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Pin this note'),
          'Edit',
          'No folder',
          expect.stringContaining('New folder'),
          'Delete',
        ]),
      );
    });

    test('marks the note’s current folder in the move-to-folder list, and updates it after moving', async () => {
      await library.locator('.hm-folder-menu__trigger').first().click();
      const panel = library.locator('.hm-folder-menu__panel');
      // Unfiled, so "No folder" starts checked.
      await expect(panel.getByRole('menuitemradio', { name: 'No folder' })).toHaveAttribute(
        'aria-checked',
        'true',
      );

      await panel.getByRole('menuitem', { name: '+ New folder' }).click();
      await library.locator('.hm-folder-menu__input').fill('Target Folder');
      await library
        .locator('.hm-folder-menu__create')
        .getByRole('button', { name: 'Save' })
        .click();

      // "+ New folder" moves the note there immediately, so it's no longer
      // in Unfiled — expand the new top-level folder and reopen the menu
      // on the note now inside it (the only one there) to confirm the pick
      // stuck. Scoped to the top-level `<li>` itself (which wraps both the
      // folder's own header row and its sibling body/notes), not just the
      // header, since "Unfiled" is a separate sibling `<li>` that could
      // otherwise also match a looser text filter.
      const targetFolderLi = library.locator('.hm-folder-tree__list > li', {
        hasText: 'Target Folder',
      });
      await targetFolderLi.locator('.hm-folder-node__name').click();
      const noteTrigger = targetFolderLi.locator('.hm-folder-menu__trigger');
      await noteTrigger.click();
      await expect(
        library.getByRole('menuitemradio', { name: 'Target Folder', exact: true }),
      ).toHaveAttribute('aria-checked', 'true');

      // Re-open fresh rather than reusing the still-open panel from the
      // check above — the menu closes on scroll (see NoteActionsMenu.tsx),
      // and this row can sit close enough to a viewport edge that expanding
      // Target Folder's own scroll-into-view lands right on the boundary,
      // occasionally racing the panel closed between two checks against the
      // same instance (observed once in CI, never locally).
      await library.keyboard.press('Escape');
      await expect(library.locator('.hm-folder-menu__panel')).toHaveCount(0);
      await noteTrigger.click();
      await expect(library.getByRole('menuitemradio', { name: 'No folder' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });

    test('pins a note from folder mode', async () => {
      const row = library.locator('.hm-note-row').first();
      await library.locator('.hm-folder-menu__trigger').first().click();
      await library.getByRole('menuitem', { name: 'Pin this note', exact: true }).click();
      await expect(row.locator('.hm-note-row__title svg')).toBeVisible();
    });

    test('edits a note from folder mode', async () => {
      await library.locator('.hm-folder-menu__trigger').first().click();
      await library.getByRole('menuitem', { name: 'Edit', exact: true }).click();
      await library.locator('.hm-folder-menu__edit textarea').fill('Edited in folder mode');
      await library.getByRole('button', { name: 'Save changes' }).click();
      await expect(library.locator('.hm-note-row__preview').first()).toHaveText(
        'Edited in folder mode',
      );
    });

    test('deletes a note from folder mode', async () => {
      await expect(library.locator('.hm-note-row')).toHaveCount(2);
      await library.locator('.hm-folder-menu__trigger').first().click();
      await library.getByRole('menuitem', { name: 'Delete', exact: true }).click();
      await library.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(library.locator('.hm-note-row')).toHaveCount(1);
    });
  });

  test.describe('Pinned section', () => {
    test.beforeEach(async () => {
      // Pin the first note via the domain-mode menu so it surfaces in
      // Pinned, then work from there.
      await library.locator('.hm-group__header').first().click();
      await library.locator('.hm-folder-menu__trigger').first().click();
      await library.getByRole('menuitem', { name: 'Pin this note', exact: true }).click();
      await expect(library.locator('.hm-pinned')).toBeVisible();
    });

    test('offers pin/unpin, edit, and delete, but not move-to-folder', async () => {
      await library.locator('.hm-pinned__row .hm-folder-menu__trigger').first().click();
      const panel = library.locator('.hm-folder-menu__panel');
      const items = await panel.getByRole('menuitem').allInnerTexts();
      expect(items).toEqual(
        expect.arrayContaining([expect.stringContaining('Unpin this note'), 'Edit', 'Delete']),
      );
      await expect(panel.getByText('Move to folder')).toHaveCount(0);
    });

    test('unpinning from the Pinned section removes it from Pinned', async () => {
      await library.locator('.hm-pinned__row .hm-folder-menu__trigger').first().click();
      await library.getByRole('menuitem', { name: 'Unpin this note', exact: true }).click();
      await expect(library.locator('.hm-pinned')).toHaveCount(0);
    });

    test('edits a note from the Pinned section', async () => {
      await library.locator('.hm-pinned__row .hm-folder-menu__trigger').first().click();
      await library.getByRole('menuitem', { name: 'Edit', exact: true }).click();
      await library.locator('.hm-folder-menu__edit textarea').fill('Edited from Pinned');
      await library.getByRole('button', { name: 'Save changes' }).click();
      await expect(library.locator('.hm-pinned__preview').first()).toHaveText('Edited from Pinned');
    });

    test('deletes a note from the Pinned section', async () => {
      await expect(library.locator('.hm-note-row')).toHaveCount(2);
      await library.locator('.hm-pinned__row .hm-folder-menu__trigger').first().click();
      await library.getByRole('menuitem', { name: 'Delete', exact: true }).click();
      await library.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(library.locator('.hm-note-row')).toHaveCount(1);
      await expect(library.locator('.hm-pinned')).toHaveCount(0);
    });
  });
});
