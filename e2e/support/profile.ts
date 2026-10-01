import { chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

/**
 * One throwaway Chromium profile with the built extension loaded — the
 * launch every extension spec needs, and the cleanup none of them had.
 *
 * An unpacked extension only loads into a persistent context, and a
 * persistent context needs a real profile directory on disk. Each spec used
 * to `mkdtemp` one per test and never delete it; at a few hundred MB per run
 * that quietly filled %TEMP% until the disk ran out. So the directory is
 * created here and removed by `close()`, which every spec calls from its
 * `afterEach` (Playwright runs that hook when a test fails or times out too).
 *
 * A hook can still be cut short (a browser that hangs on close eats the
 * test's whole timeout), so every directory also carries the run's id, and
 * the global teardown (`global-setup.ts`) sweeps whatever that run left.
 *
 * Requires the extension to be built first: `pnpm build`. The unpacked build
 * lives in `.output/chrome-mv3`.
 */

const EXTENSION_PATH = path.resolve(import.meta.dirname, '..', '..', '.output', 'chrome-mv3');

/** Every profile directory starts with this, so a leftover is easy to spot. */
const PROFILE_PREFIX = 'hamesh-e2e-';

/**
 * Set by the global setup to an id for this `playwright test` run, so its
 * teardown removes this run's profiles and never those of a run going on in
 * parallel (another checkout, another terminal).
 */
export const RUN_ID_ENV = 'HAMESH_E2E_RUN';

function runPrefix(runId: string | undefined): string {
  return runId ? `${PROFILE_PREFIX}${runId}-` : PROFILE_PREFIX;
}

export interface ExtensionProfile {
  context: BrowserContext;
  /** Closes the browser, then deletes its profile directory. Safe to call twice. */
  close: () => Promise<void>;
}

export interface LaunchOptions {
  /** Extra Chromium switches, after the ones that load the extension. */
  args?: string[];
  /** Let the page save downloads (the backup spec reads the file it writes). */
  acceptDownloads?: boolean;
}

/**
 * Launches Chromium on a fresh profile with the extension loaded.
 * `name` only labels the temp directory (`hamesh-e2e-<run>-<name>-XXXXXX`),
 * so a directory that does survive a crashed run says which spec left it.
 */
export async function launchExtension(
  name: string,
  options: LaunchOptions = {},
): Promise<ExtensionProfile> {
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `${runPrefix(process.env[RUN_ID_ENV])}${name}-`),
  );
  let context: BrowserContext;
  try {
    // `--headless=new` is required: the legacy headless mode can't load
    // extensions. Passing headless:false keeps Playwright from adding the old flag.
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      acceptDownloads: options.acceptDownloads,
      args: [
        '--headless=new',
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        ...(options.args ?? []),
      ],
    });
  } catch (err) {
    // A launch that fails (most often: the extension isn't built) still made
    // the directory, and nothing else holds a handle to clean it up.
    removeProfileDir(userDataDir);
    throw err;
  }

  let closed: Promise<void> | undefined;
  return {
    context,
    close: () =>
      (closed ??= (async () => {
        try {
          await context.close();
        } finally {
          removeProfileDir(userDataDir);
        }
      })()),
  };
}

/**
 * Deletes a profile directory. On Windows, Chromium's child processes can
 * hold files open for a moment after the browser reports it has closed, which
 * surfaces as EBUSY/EPERM/ENOTEMPTY — `maxRetries` makes Node retry those with
 * a growing delay. If it still can't, the test has already passed or failed on
 * its own merits, so a leftover directory is reported rather than turned into
 * a failure.
 */
function removeProfileDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch (err) {
    console.warn(`[e2e] could not remove Chromium profile ${dir}:`, err);
  }
}

/**
 * Removes every profile a run left behind — the ones whose `close()` never got
 * to finish. Runs after all workers have exited, so no browser still holds
 * them. Returns how many there were.
 */
export function removeRunProfiles(runId: string): number {
  const prefix = runPrefix(runId);
  const leftovers = fs.readdirSync(os.tmpdir()).filter((entry) => entry.startsWith(prefix));
  for (const entry of leftovers) removeProfileDir(path.join(os.tmpdir(), entry));
  return leftovers.length;
}
