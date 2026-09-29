import { browser } from 'wxt/browser';
import { teamsConfig } from './config';
import {
  isTeamsOperationRequest,
  isTeamsRequest,
  type TeamsReply,
  type TeamsResult,
} from './messages';
import { codeOf } from './errors';
import type { TeamsService } from './service';

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

/** Wires Teams into the background service worker. A no-op in builds without Teams. */
export function registerTeams(): void {
  const config = teamsConfig();
  if (!config) return;

  // Loaded on first use, not at startup: everything it reaches leads to the
  // contract's schemas and zod, and none of that belongs in a build that has
  // no Teams (see ./worker.ts). The listener below is still registered the
  // moment the worker starts, which is what a service worker requires.
  let service: Promise<TeamsService> | null = null;
  const getService = (): Promise<TeamsService> =>
    (service ??= import('./worker').then((worker) => worker.createService(config)));

  browser.runtime.onMessage.addListener((message, sender, sendResponse): true | undefined => {
    const account = isTeamsRequest(message);
    if (!account && !isTeamsOperationRequest(message)) return undefined;
    // The same gate for both kinds: only Hamesh's own pages, never a content
    // script and never another extension.
    if (!isExtensionPageSender(sender, browser.runtime.id, browser.runtime.getURL('/'))) {
      return undefined;
    }
    const work = (async (): Promise<TeamsReply | TeamsResult<unknown>> => {
      const service = await getService();
      return account ? service.handle(message.op) : service.perform(message.op, message.params);
    })();
    work.then(sendResponse, (err: unknown) =>
      sendResponse(
        account
          ? ({ status: { state: 'signed_out' }, error: codeOf(err) } satisfies TeamsReply)
          : { ok: false, error: codeOf(err) },
      ),
    );
    return true; // async response
  });

  browser.permissions?.onRemoved.addListener(() => {
    void getService().then((service) => service.permissionsRemoved());
  });
}
