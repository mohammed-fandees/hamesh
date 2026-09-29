import { browser } from 'wxt/browser';
import { teamsPermissions, type TeamsConfig } from './config';
import { createIdbSessionStore } from './session-store';
import { createTeamsApi } from './api';
import { createTeamsService, type TeamsService } from './service';

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
  return createTeamsService({
    config,
    sessions,
    api: createTeamsApi({ config, sessions }),
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
  });
}
