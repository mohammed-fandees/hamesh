import { browser } from 'wxt/browser';
import { teamsConfig, teamsPermissions, type TeamsConfig } from './config';
import { createIdbSessionStore } from './session-store';
import { createTeamsApi } from './api';
import { createTeamsService, type TeamsService } from './service';
import { isTeamsRequest, type TeamsReply } from './messages';
import { codeOf } from './errors';

/**
 * Only Hamesh's own pages may drive Teams. A content script runs inside an
 * arbitrary web page, so a message from one is refused here: its `url` is the
 * page's, not the extension's. Messages from other extensions never reach
 * `runtime.onMessage` at all, but the id is checked anyway.
 */
export function isExtensionPageSender(
  sender: { id?: string; url?: string },
  runtimeId: string,
  extensionOrigin: string,
): boolean {
  if (sender.id !== runtimeId || !sender.url) return false;
  try {
    return new URL(sender.url).origin === new URL(extensionOrigin).origin;
  } catch {
    return false;
  }
}

function createService(config: TeamsConfig | null): TeamsService {
  const sessions = createIdbSessionStore();
  return createTeamsService({
    config,
    sessions,
    api: config ? createTeamsApi({ config, sessions }) : null,
    hasPermissions: async () =>
      !!config &&
      !!browser.permissions &&
      (await browser.permissions.contains(teamsPermissions(config))),
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

/** Wires Teams into the background service worker. A no-op in builds without Teams. */
export function registerTeams(): void {
  const config = teamsConfig();
  if (!config) return;
  let service: TeamsService | null = null;
  const getService = () => (service ??= createService(config));

  browser.runtime.onMessage.addListener((message, sender, sendResponse): true | undefined => {
    if (!isTeamsRequest(message)) return undefined;
    if (!isExtensionPageSender(sender, browser.runtime.id, browser.runtime.getURL('/'))) {
      return undefined;
    }
    getService()
      .handle(message.op)
      .then(sendResponse, (err: unknown) =>
        sendResponse({ status: { state: 'signed_out' }, error: codeOf(err) } satisfies TeamsReply),
      );
    return true; // async response
  });

  browser.permissions?.onRemoved.addListener(() => {
    void getService().permissionsRemoved();
  });
}
