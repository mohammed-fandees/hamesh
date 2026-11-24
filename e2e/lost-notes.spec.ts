import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { launchExtension, type ExtensionProfile } from './support/profile';

/**
 * Hamesh E2E — notes that lost their place.
 *
 * A real page whose words change between visits, in a real Chromium: the note is flagged only on
 * the second visit that misses it, put back on new words with the same selection a reader uses to
 * write a note, and never flagged when its words arrive late. The verdict waits for the page to
 * settle (10 s at least), so these tests are slow by design.
 *
 * Requires a build first: `pnpm build`.
 */

const BEFORE = 'The conditions of renaissance are man, soil and time.';
const AFTER = 'Civilisation, he wrote, is an equation with three terms.';

type Version = 'before' | 'after' | 'late';

/** The page as it stands today; `late` adds the words two seconds after load. */
function html(version: Version): string {
  const words = version === 'after' ? AFTER : BEFORE;
  const body =
    version === 'late'
      ? `<article data-testid="article"><p>An essay on Bennabi.</p></article>
         <script>
           setTimeout(() => {
             const p = document.createElement('p');
             p.dataset.testid = 'late';
             p.textContent = ${JSON.stringify(words)};
             document.querySelector('[data-testid="article"]').append(p);
           }, 2000);
         </script>`
      : `<article data-testid="article"><p>An essay on Bennabi.</p><p data-testid="para">${words}</p></article>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Bennabi</title></head><body>${body}</body></html>`;
}

function startServer() {
  let version: Version = 'before';
  return new Promise<{
    url: string;
    serve: (v: Version) => void;
    close: () => Promise<void>;
  }>((resolve) => {
    const server = http.createServer((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html(version));
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}/bennabi.html`,
        serve: (v) => {
          version = v;
        },
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function openPage(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as Window & { __hameshReady?: Promise<void> }).__hameshReady = new Promise<void>(
      (resolve) => window.addEventListener('hamesh:ready', () => resolve(), { once: true }),
    );
  });
  await page.goto(url);
  await page.evaluate(() => (window as Window & { __hameshReady?: Promise<void> }).__hameshReady);
  return page;
}

/** Selects exactly `needle` inside `testId` and ends it with a mouseup, as a drag does. */
async function selectPhrase(page: Page, testId: string, needle: string): Promise<void> {
  await page.evaluate(
    ([id, text]) => {
      const el = document.querySelector(`[data-testid="${id}"]`)!;
      const node = el.firstChild as Text;
      const at = node.data.indexOf(text);
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + text.length);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    },
    [testId, needle] as const,
  );
}

async function writeNote(page: Page, testId: string, words: string, content: string) {
  await selectPhrase(page, testId, words);
  await page.locator('.hm-text-action').click();
  await page.locator('.hm-card textarea').fill(content);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.hm-card textarea')).toHaveCount(0);
}

async function health(context: BrowserContext): Promise<Record<string, { status: string }>> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  return worker.evaluate(async () => {
    const { chrome } = globalThis as unknown as {
      chrome: { storage: { local: { get(key: string): Promise<Record<string, unknown>> } } };
    };
    const got = await chrome.storage.local.get('hamesh:anchor-health');
    return (got['hamesh:anchor-health'] ?? {}) as Record<string, { status: string }>;
  });
}

async function highlightCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (CSS as unknown as { highlights?: Map<string, { size: number }> }).highlights?.get(
        'hamesh-text',
      )?.size ?? 0,
  );
}

/** One visit, from load to its verdict (the page is quiet, so 10 s and a little). */
async function visit(context: BrowserContext, url: string): Promise<Page> {
  const page = await openPage(context, url);
  await page.waitForTimeout(11_500);
  return page;
}

test.describe('Hamesh notes that lost their place', () => {
  let profile: ExtensionProfile | undefined;
  let context: BrowserContext;
  let server: Awaited<ReturnType<typeof startServer>>;

  test.beforeEach(async () => {
    server = await startServer();
    profile = await launchExtension('lost');
    context = profile.context;
  });
  test.afterEach(async () => {
    await profile?.close();
    await server.close();
  });

  test('flagged on the second visit that misses it, then put back on new words', async () => {
    test.setTimeout(90_000);
    const writing = await openPage(context, server.url);
    await writeNote(writing, 'para', 'man, soil and time', 'The three terms of civilisation.');
    await writing.close();

    server.serve('after');
    const first = await visit(context, server.url);
    await expect(first.locator('.hm-lost-pill')).toHaveCount(0);
    expect(Object.values(await health(context)).map((h) => h.status)).toEqual(['suspect']);
    await first.close();

    const second = await visit(context, server.url);
    const pill = second.getByRole('button', { name: "1 note couldn't find its place" });
    await expect(pill).toBeVisible();
    await pill.click();
    const list = second.getByRole('dialog', { name: 'Notes that lost their place' });
    await expect(list.getByText('man, soil and time')).toBeVisible();
    await list.getByRole('button', { name: 'Put it back' }).click();
    await expect(second.getByRole('status')).toContainText('Select the words');

    await selectPhrase(second, 'para', 'an equation with three terms');
    await second.getByRole('button', { name: 'Put the note here' }).click();

    await expect.poll(() => highlightCount(second)).toBe(1);
    await expect(second.locator('.hm-lost-pill')).toHaveCount(0);
    await expect.poll(async () => Object.keys(await health(context)).length).toBe(0);

    await second.reload();
    await expect.poll(() => highlightCount(second)).toBe(1);
  });

  test('words that load two seconds late are never flagged', async () => {
    test.setTimeout(90_000);
    server.serve('late');
    const writing = await openPage(context, server.url);
    await expect(writing.getByTestId('late')).toBeVisible();
    await writeNote(writing, 'late', 'man, soil and time', 'Arrives late, still here.');
    await writing.close();

    for (let i = 0; i < 2; i++) {
      const page = await visit(context, server.url);
      await expect(page.locator('.hm-lost-pill')).toHaveCount(0);
      await page.close();
    }
    expect(await health(context)).toEqual({});
  });
});
