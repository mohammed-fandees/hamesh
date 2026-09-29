import { browser } from 'wxt/browser';
import { generatePageKey } from '@/domain/page-key';
import { teamsPermissions, type TeamsConfig } from './config';
import { createIdbSessionStore } from './session-store';
import { createTeamsApi } from './api';
import { createTeamsService, type TeamsService } from './service';
import { clearAllPages, readPageBucket, writePageBucket, writeTeamIndex } from './page-cache';
import { createSyncStore } from './sync-store';
import { createTeamSync } from './sync';
import { createRealtime } from './realtime';

/**
 * The Teams service, wired to the browser.
 *
 * Kept apart from `./background.ts` and reached only through `import()`,
 * because everything under here leads to the contract's schemas and to zod.
 * A build without Teams folds its guard away and never mentions this module,
 * so none of that weight ships to someone who has no Teams to use — while the
 * message listener itself stays where a service worker needs it, registered
 * the moment the worker starts.
 */
export function createService(config: TeamsConfig): TeamsService {
  const sessions = createIdbSessionStore();
  const api = createTeamsApi({ config, sessions });

  const sync = createTeamSync({
    api,
    store: createSyncStore(),
    readBucket: readPageBucket,
    writeBucket: writePageBucket,
    // The same page key the content script asks for its own page with, so a
    // note the server stored and the page it belongs to always agree.
    pageKeyOf: generatePageKey,
    now: Date.now,
  });

  // The service is what acts on a poke, and the socket is created before it
  // exists — so the handlers reach it through this, set just below.
  let service: TeamsService | null = null;
  const realtime = createRealtime({
    config,
    api,
    open: (url) => new WebSocket(url),
    onChanged: (teamId) => void service?.changed(teamId),
    onMembers: () => void service?.accountChanged(),
    onRevoked: (_teamId, reason) => {
      if (reason === 'signed_out') void service?.revoked();
      else void service?.accountChanged();
    },
  });

  service = createTeamsService({
    config,
    sessions,
    api,
    hasPermissions: async () =>
      !!browser.permissions && (await browser.permissions.contains(teamsPermissions(config))),
    // `identity` is an optional permission, so the API only exists once granted.
    auth: () => ({
      redirectUri: browser.identity?.getRedirectURL() ?? '',
      launchWebAuthFlow: (url) => {
        if (!browser.identity) return Promise.reject(new Error('identity unavailable'));
        return browser.identity.launchWebAuthFlow({ url, interactive: true });
      },
    }),
    shared: {
      sync,
      realtime,
      writeIndex: writeTeamIndex,
      clearCache: clearAllPages,
      now: Date.now,
    },
  });
  return service;
}
