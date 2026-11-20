import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { launchExtension, type ExtensionProfile } from './support/profile';

/**
 * The Markdown export, end to end in Chromium: a real download through the browser, unzipped
 * and read, and a real clipboard. What each file says is unit-tested in
 * `tests/domain/export/`; this proves the pieces meet in the built extension.
 *
 * Requires the extension to be built first: `pnpm build`.
 */

async function getExtensionId(context: BrowserContext): Promise<string> {
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return new URL(sw.url()).host;
}

const PAGE = 'https://maktaba.site/khwarizmi/the-book-of-algebra';

/** A vocabulary folder on one docs page, written straight into extension storage. */
async function seed(page: Page): Promise<void> {
  await page.evaluate(async (pageKey) => {
    const chromeApi = (
      globalThis as unknown as {
        chrome: { storage: { local: { set(items: Record<string, unknown>): Promise<void> } } };
      }
    ).chrome;
    const words: [string, string, number][] = [
      ['imitation', 'تقليد - محاكاة', 10],
      ['creation', 'إبداع - خلق', 20],
      ['house of wisdom', 'بيت الحكمة', 30],
    ];
    await chromeApi.storage.local.set({
      'hamesh:folders': [
        {
          id: 'f-vocab',
          name: 'Bennabi - Vocab',
          parentId: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      [`hamesh:notes:${pageKey}`]: words.map(([exact, content, start], i) => ({
        id: `note-${i}`,
        schemaVersion: 1,
        pageKey,
        originalUrl: pageKey,
        content,
        anchor: {
          type: 'text',
          version: 1,
          exact,
          context: { prefix: 'This value is ', suffix: ' meaning you can' },
          textPosition: { start, end: start + exact.length },
        },
        pageContext: { title: 'The Book of Algebra – Maktaba' },
        folderId: 'f-vocab',
        workspaceId: 'default',
        createdAt: '2026-08-23T20:00:00.000Z',
        updatedAt: '2026-08-23T20:00:00.000Z',
      })),
    });
  }, PAGE);
}

test.describe('Markdown export', () => {
  let profile: ExtensionProfile | undefined;
  let context: BrowserContext;
  let extensionId: string;

  test.beforeEach(async () => {
    profile = await launchExtension('markdown-export', { acceptDownloads: true });
    context = profile.context;
    extensionId = await getExtensionId(context);
  });
  test.afterEach(async () => {
    await profile?.close();
  });

  test('exports everything to Obsidian as a zip, with a glossary for vocabulary', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html?view=settings`);
    await seed(page);
    await page.reload();
    await page.locator('summary', { hasText: 'Backup and export' }).click();
    await page.getByRole('button', { name: 'Export…' }).click();

    const dialog = page.getByRole('dialog', { name: 'Export as Markdown' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Layout for Bennabi - Vocab: Glossary' }),
    ).toBeVisible();
    await expect(dialog.getByRole('article', { name: 'Preview' })).toContainText('house of wisdom');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'Download .zip' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^hamesh-\d{4}-\d{2}-\d{2}\.zip$/);
    const files = unzipSync(fs.readFileSync((await download.path())!));
    const vocab = strFromU8(files['Hamesh/Folders/Bennabi - Vocab.md']);
    expect(vocab).toContain('| Word | Meaning | Page |');
    expect(vocab).toContain('| house of wisdom | بيت الحكمة |');
    const pageFile = strFromU8(files['Hamesh/Sites/maktaba.site/The Book of Algebra – Maktaba.md']);
    expect(pageFile).toMatch(/^---\ntitle: "The Book of Algebra – Maktaba"/);
    expect(pageFile.trimEnd()).toMatch(
      /\*Exported from \[Hamesh\]\(https:\/\/hamesh\.fandees\.tech\) · .+\*$/,
    );
    await expect(dialog.getByText(/^Downloaded hamesh-/)).toBeVisible();
  });

  test('copies one page as Notion Markdown from the note’s menu', async () => {
    // Chrome grants no clipboard-read to an extension's own pages, so what is written is
    // captured on its way to the real clipboard.
    await context.addInitScript(() => {
      const write = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = async (text: string) => {
        (globalThis as unknown as { copied?: string }).copied = text;
        await write(text).catch(() => undefined);
      };
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/notes.html`);
    await seed(page);
    await page.evaluate(async () => {
      const chromeApi = (
        globalThis as unknown as {
          chrome: { storage: { local: { set(items: Record<string, unknown>): Promise<void> } } };
        }
      ).chrome;
      await chromeApi.storage.local.set({
        'hamesh:preferences': { schemaVersion: 1, export: { flavor: 'notion', layouts: {} } },
      });
    });
    await page.reload();

    // Site groups start collapsed.
    await page
      .getByRole('button', { name: /maktaba\.site/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Note actions' }).first().click();
    await page.getByRole('menuitem', { name: 'Copy the page’s notes as Markdown' }).click();
    await expect(page.getByRole('menuitem', { name: 'Copied' })).toBeVisible();
    const text = await page.evaluate(() => (globalThis as unknown as { copied: string }).copied);
    expect(text.startsWith('# The Book of Algebra – Maktaba')).toBe(true);
    expect(text).toContain('| Word | Meaning | In context |');
    expect(text).not.toContain('[!quote]');
  });
});
