import { test, expect, type Page, type Request } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * The page an email's "stop" link opens. It reads the token from its own
 * fragment and sends it to the API only when the reader asks, so a mail
 * scanner that opens links on its own never stops anyone's mail.
 */

const ROOT = path.resolve(import.meta.dirname, '..', 'landing');
const STOP_URL = 'https://api.hamesh.fandees.tech/v1/mail/stop';
const TOKEN = `${'a1'.repeat(32)}.${'B'.repeat(43)}`;

let server: http.Server;
let origin: string;

test.beforeAll(async () => {
  // Serves `landing/` as Cloudflare's static assets do: `/email/stop` is
  // `email/stop.html`.
  server = http.createServer((req, res) => {
    let pathname = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    if (!path.extname(pathname)) pathname += '.html';
    const file = path.join(ROOT, pathname);
    if (!file.startsWith(ROOT)) {
      res.statusCode = 403;
      res.end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end();
        return;
      }
      const type = path.extname(file) === '.html' ? 'text/html; charset=utf-8' : 'image/svg+xml';
      res.setHeader('Content-Type', type);
      res.end(data);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Answers the API as given, and keeps the requests that reached it. */
async function api(page: Page, status: number | 'down') {
  const seen: Request[] = [];
  await page.route(STOP_URL, (route) => {
    seen.push(route.request());
    if (status === 'down') return route.abort('failed');
    return route.fulfill({
      status,
      headers: { 'access-control-allow-origin': '*' },
      json: status === 200 ? { stopped: true } : { error: 'not_found' },
    });
  });
  return seen;
}

test.describe('the stop page', () => {
  test('sends nothing until the reader asks', async ({ page }) => {
    const seen = await api(page, 200);
    await page.goto(`${origin}/email/stop#${TOKEN}`);
    await expect(page.getByRole('button', { name: 'Stop invitations' })).toBeVisible();
    await page.waitForTimeout(300);
    expect(seen).toHaveLength(0);
  });

  test('stops invitations with one press, sending only the token', async ({ page }) => {
    const seen = await api(page, 200);
    await page.goto(`${origin}/email/stop#${TOKEN}`);
    // The token is not left in the address bar or the history.
    expect(new URL(page.url()).hash).toBe('');
    await page.getByRole('button', { name: 'Stop invitations' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'Done. Hamesh won’t email this address any more invitations.',
    );
    expect(seen).toHaveLength(1);
    const request = seen[0]!;
    expect(request.method()).toBe('POST');
    expect(request.postData()).toBe(TOKEN);
    expect(request.headers()['content-type']).toMatch(/^text\/plain/);
    expect(request.headers()['authorization']).toBeUndefined();
    await expect(page.getByRole('button', { name: 'Stop invitations' })).toBeHidden();
  });

  test('speaks Arabic to an Arabic reader, right to left', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'ar-EG' });
    const page = await context.newPage();
    await api(page, 200);
    await page.goto(`${origin}/email/stop#${TOKEN}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.getByRole('button', { name: 'إيقاف الدعوات' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'تم. لن يرسل هامش دعوات أخرى إلى هذا العنوان.',
    );
    await context.close();
  });

  test('says when the link is not one Hamesh made', async ({ page }) => {
    await api(page, 404);
    await page.goto(`${origin}/email/stop#${TOKEN}`);
    await page.getByRole('button', { name: 'Stop invitations' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'This link doesn’t work. Open the “stop” link from the email itself.',
    );
  });

  test('lets the reader try again when Hamesh can’t be reached', async ({ page }) => {
    const seen = await api(page, 'down');
    await page.goto(`${origin}/email/stop#${TOKEN}`);
    await page.getByRole('button', { name: 'Stop invitations' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'We couldn’t reach Hamesh. Check your connection and try again.',
    );
    await page.getByRole('button', { name: 'Stop invitations' }).click();
    await expect.poll(() => seen.length).toBe(2);
  });

  test('says so when the link has no token, and offers nothing to press', async ({ page }) => {
    const seen = await api(page, 200);
    await page.goto(`${origin}/email/stop`);
    await expect(page.getByText('This link is incomplete.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stop invitations' })).toHaveCount(0);
    expect(seen).toHaveLength(0);
  });

  test('tells no other site where the reader came from, and is not indexed', async ({ page }) => {
    await page.goto(`${origin}/email/stop#${TOKEN}`);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  });
});
