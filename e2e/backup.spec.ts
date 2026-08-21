import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

/**
 * Settings — local backup.
 *
 * Drives the real thing end to end in Chromium: export writes an actual
 * file to disk through the browser's download machinery, and import reads
 * one back through a real file picker. Neither half can be proven in jsdom
 * — there is no download and no `File` from a real disk there — so the
 * round trip lives here, while the merge rules that decide what a restore
 * does are unit-tested in `tests/domain/backup.test.ts`.
 *
 * Requires the extension to be built first: `pnpm build`.
 */

const EXTENSION_PATH = path.resolve(import.meta.dirname, '..', '.output', 'chrome-mv3');

async function launch(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamesh-e2e-backup-'));
  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    acceptDownloads: true,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });
}

async function getExtensionId(context: BrowserContext): Promise<string> {
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return new URL(sw.url()).host;
}

/** Writes notes straight into extension storage from the Notes Library page
 *  — the same keys the content script writes, without needing a host page. */
async function seedNotes(page: Page, notes: { id: string; content: string }[]): Promise<void> {
  await page.evaluate(async (seed) => {
    const chromeApi = (
      globalThis as unknown as {
        chrome: { storage: { local: { set(items: Record<string, unknown>): Promise<void> } } };
      }
    ).chrome;
    await chromeApi.storage.local.set({
      'hamesh:notes:https://seeded.example/page': seed.map((note) => ({
        id: note.id,
        schemaVersion: 1,
        pageKey: 'https://seeded.example/page',
        originalUrl: 'https://seeded.example/page',
        content: note.content,
        anchor: {
          type: 'element',
          primarySelector: null,
          signals: { tagName: 'p' },
          fallbackDocumentPosition: { x: 0, y: 0 },
        },
        workspaceId: 'default',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })),
    });
  }, notes);
}

async function storedNoteIds(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const chromeApi = (
      globalThis as unknown as {
        chrome: { storage: { local: { get(keys: null): Promise<Record<string, unknown>> } } };
      }
    ).chrome;
    const all = await chromeApi.storage.local.get(null);
    const ids: string[] = [];
    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith('hamesh:notes:') || !Array.isArray(value)) continue;
      for (const note of value as { id: string }[]) ids.push(note.id);
    }
    return ids.sort();
  });
}

async function openSettings(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/notes.html?view=settings`);
  await expect(page.getByRole('heading', { name: 'Backup' })).toBeVisible();
  return page;
}

test.describe('Settings — local backup', () => {
  let context: BrowserContext;

  test.beforeEach(async () => {
    context = await launch();
  });
  test.afterEach(async () => {
    await context.close();
  });

  test('exports every note to a dated file, then restores them after they are gone', async () => {
    const extensionId = await getExtensionId(context);
    const page = await openSettings(context, extensionId);

    await seedNotes(page, [
      { id: 'note-one', content: 'The first note' },
      { id: 'note-two', content: 'The second note' },
    ]);
    await page.reload();

    // Export — a real download.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export', exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^hamesh-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const backupPath = path.join(os.tmpdir(), `hamesh-backup-${Date.now()}.json`);
    await download.saveAs(backupPath);
    await expect(page.locator('.hm-status--success')).toContainText('Saved 2 notes');

    // The file really contains the notes, in a readable envelope.
    const parsed = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    expect(parsed.format).toBe('hamesh-backup');
    expect(parsed.notes.map((n: { id: string }) => n.id).sort()).toEqual(['note-one', 'note-two']);

    // Lose everything.
    await page.evaluate(async () => {
      const chromeApi = (
        globalThis as unknown as { chrome: { storage: { local: { clear(): Promise<void> } } } }
      ).chrome;
      await chromeApi.storage.local.clear();
    });
    await page.reload();
    expect(await storedNoteIds(page)).toEqual([]);

    // Import the file back.
    await page.locator('input[type="file"]').setInputFiles(backupPath);
    await expect(page.locator('.hm-status--success')).toContainText('Restored 2 notes');
    expect(await storedNoteIds(page)).toEqual(['note-one', 'note-two']);

    // And the Library really shows them again.
    await page.getByRole('button', { name: 'Notes Library' }).click();
    await page.locator('.hm-group__header').first().click();
    await expect(page.locator('.hm-note-row__preview').first()).toContainText('The first note');

    fs.rmSync(backupPath, { force: true });
    await page.close();
  });

  test('importing never removes a note that is not in the file', async () => {
    const extensionId = await getExtensionId(context);
    const page = await openSettings(context, extensionId);

    await seedNotes(page, [{ id: 'in-backup', content: 'Backed up' }]);
    await page.reload();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export', exact: true }).click(),
    ]);
    const backupPath = path.join(os.tmpdir(), `hamesh-keep-${Date.now()}.json`);
    await download.saveAs(backupPath);

    // Write a note that the backup knows nothing about.
    await seedNotes(page, [
      { id: 'in-backup', content: 'Backed up' },
      { id: 'written-later', content: 'Written after the backup' },
    ]);
    await page.reload();

    await page.locator('input[type="file"]').setInputFiles(backupPath);
    await expect(page.locator('.hm-status')).toBeVisible();
    // Both survive: the restore added nothing new and removed nothing.
    expect(await storedNoteIds(page)).toEqual(['in-backup', 'written-later']);

    fs.rmSync(backupPath, { force: true });
    await page.close();
  });

  test('says plainly when a file has nothing new in it, twice over', async () => {
    const extensionId = await getExtensionId(context);
    const page = await openSettings(context, extensionId);

    await seedNotes(page, [{ id: 'only-note', content: 'Only note' }]);
    await page.reload();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export', exact: true }).click(),
    ]);
    const backupPath = path.join(os.tmpdir(), `hamesh-idem-${Date.now()}.json`);
    await download.saveAs(backupPath);

    await page.locator('input[type="file"]').setInputFiles(backupPath);
    await expect(page.locator('.hm-status--success')).toContainText('already here');
    expect(await storedNoteIds(page)).toEqual(['only-note']);

    // Importing the very same file again is still a no-op, not a duplicate.
    await page.locator('input[type="file"]').setInputFiles(backupPath);
    await expect(page.locator('.hm-status--success')).toContainText('already here');
    expect(await storedNoteIds(page)).toEqual(['only-note']);

    fs.rmSync(backupPath, { force: true });
    await page.close();
  });

  test('refuses a file that is not a Hamesh backup, without touching anything', async () => {
    const extensionId = await getExtensionId(context);
    const page = await openSettings(context, extensionId);

    await seedNotes(page, [{ id: 'safe', content: 'Still here' }]);
    await page.reload();

    const junkPath = path.join(os.tmpdir(), `not-a-backup-${Date.now()}.json`);
    fs.writeFileSync(junkPath, JSON.stringify({ hello: 'world' }), 'utf8');
    await page.locator('input[type="file"]').setInputFiles(junkPath);
    await expect(page.locator('.hm-status--warning')).toContainText("isn't a Hamesh backup");
    expect(await storedNoteIds(page)).toEqual(['safe']);

    fs.writeFileSync(junkPath, 'this is not json', 'utf8');
    await page.locator('input[type="file"]').setInputFiles(junkPath);
    await expect(page.locator('.hm-status--warning')).toContainText("isn't readable JSON");
    expect(await storedNoteIds(page)).toEqual(['safe']);

    fs.rmSync(junkPath, { force: true });
    await page.close();
  });

  test('offers backup in Arabic too', async () => {
    const extensionId = await getExtensionId(context);
    const page = await openSettings(context, extensionId);
    await page.getByRole('radio', { name: 'Arabic' }).check();

    await expect(page.getByRole('heading', { name: 'النسخ الاحتياطي' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'تصدير', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'استيراد', exact: true })).toBeVisible();

    await page.close();
  });
});
