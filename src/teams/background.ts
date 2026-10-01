import { browser } from 'wxt/browser';
import { teamsConfig } from './config';
import { isContentScriptSender, isTeamsPageMessage } from './page-channel';
import { createNotesRepository } from '@/storage/notes-repository';
import { generatePageKey } from '@/domain/page-key';
import {
  isTeamsCacheRequest,
  isTeamsDevSignIn,
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

/**
 * How often the worker catches up on its own. The realtime socket is what
 * usually brings a change in, but a service worker the browser shut down has no
 * socket — so a pull on a timer is what makes a missed poke a delay rather than
 * a note nobody ever sees.
 */
const SYNC_ALARM = 'hamesh-teams-sync';
const SYNC_EVERY_MINUTES = 5;

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
    // A web page's content script, for the few things its popup and composer
    // need (see ./page-channel.ts). Answered only to this extension's own
    // content script in a page's top frame, and checked against that page.
    if (isTeamsPageMessage(message)) {
      if (!isContentScriptSender(sender, browser.runtime.id)) return undefined;
      const pageUrl = sender.url as string;
      // The whole discussion, in Chrome's side panel beside the page. Opened
      // now, before anything is awaited: the click on the page is what lets
      // the panel open, and it only counts until this handler yields.
      const request = message.request;
      const tabId = sender.tab?.id;
      if (
        request.op === 'open' &&
        request.in !== 'hamesh' &&
        tabId !== undefined &&
        browser.sidePanel
      ) {
        const params = new URLSearchParams({
          view: 'panel',
          team: request.teamId,
          note: request.noteId,
          pagekey: generatePageKey(pageUrl),
        });
        void browser.sidePanel.setOptions({ tabId, path: `notes.html?${params}`, enabled: true });
        browser.sidePanel.open({ tabId }).then(
          () => sendResponse({ ok: true, data: null }),
          // Refused (no gesture after all, an older Chrome): the note's own
          // page in Hamesh instead, as before there was a panel.
          async () => {
            const page = new URLSearchParams({
              view: 'teams',
              team: request.teamId,
              page: 'note',
              note: request.noteId,
            });
            await browser.tabs.create({
              url: browser.runtime.getURL(`/notes.html?${page}` as '/notes.html'),
            });
            sendResponse({ ok: true, data: null });
          },
        );
        return true;
      }
      void (async () => {
        const [service, { handlePageRequest }] = await Promise.all([
          getService(),
          import('./page-handler'),
        ]);
        return handlePageRequest(
          {
            service,
            notes: createNotesRepository(),
            openPage: async (path) => {
              await browser.tabs.create({
                url: browser.runtime.getURL(path as '/notes.html'),
              });
            },
          },
          message.request,
          pageUrl,
        );
      })().then(sendResponse, (err: unknown) => sendResponse({ ok: false, error: codeOf(err) }));
      return true;
    }
    const account = isTeamsRequest(message);
    const cache = !account && isTeamsCacheRequest(message);
    // Only a build that asked for it handles this at all: the constant folds
    // away in every other one, and with it the branch below.
    const devSignIn = __HAMESH_DEV_SIGN_IN__ && !account && !cache && isTeamsDevSignIn(message);
    if (!account && !cache && !devSignIn && !isTeamsOperationRequest(message)) return undefined;
    // The same gate for all three kinds: only Hamesh's own pages, never a
    // content script and never another extension. The content script reads the
    // team notes it draws straight from storage instead (see ./page-cache.ts).
    if (!isExtensionPageSender(sender, browser.runtime.id, browser.runtime.getURL('/'))) {
      return undefined;
    }
    const work = (async (): Promise<TeamsReply | TeamsResult<unknown>> => {
      const service = await getService();
      if (account) return service.handle(message.op);
      if (cache) return service.readCache(message.op, message.teamId);
      // The constant again, not just `devSignIn` above: it is what folds this
      // branch — and the check inside it — out of every build that did not ask
      // for it. Narrowed by hand because TypeScript cannot use a build constant
      // to tell the two message shapes apart.
      if (__HAMESH_DEV_SIGN_IN__ && isTeamsDevSignIn(message)) {
        return service.devSignIn(message.token);
      }
      if (!isTeamsOperationRequest(message)) return { ok: false, error: 'invalid_request' };
      return service.perform(message.op, message.params);
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

  // Re-creating an alarm with the same name just resets its schedule, so this is
  // idempotent across worker restarts. Nothing here reaches the network unless
  // the user has turned Teams on and signed in: `tick` asks the service, which
  // checks both first.
  browser.alarms?.create(SYNC_ALARM, { periodInMinutes: SYNC_EVERY_MINUTES });
  browser.alarms?.onAlarm.addListener((alarm) => {
    if (alarm.name !== SYNC_ALARM) return;
    void getService().then((service) => service.tick());
  });
}
