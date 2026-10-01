import crypto from 'node:crypto';
import { RUN_ID_ENV, removeRunProfiles } from './profile';

/**
 * Gives this run an id (workers inherit it through the environment) and
 * returns the teardown that sweeps the Chromium profiles the run left
 * behind. Normally there are none: each spec's `afterEach` closes its own.
 * See `profile.ts`.
 */
export default function globalSetup(): () => void {
  const runId = crypto.randomBytes(4).toString('hex');
  process.env[RUN_ID_ENV] = runId;

  return () => {
    const removed = removeRunProfiles(runId);
    if (removed > 0) {
      console.warn(`[e2e] removed ${removed} Chromium profile(s) a test could not clean up`);
    }
  };
}
