import { browser } from 'wxt/browser';
import { isJoinPage, joinTokenFrom } from './join-link';

/**
 * The content script's part in opening an invitation link: on Hamesh's join
 * page, and nowhere else, it hands the token to the worker and takes it out of
 * the address bar, so it is not left in the page's history.
 *
 * It then tells the page, with a DOM event and no data, that Hamesh took it;
 * the page says so to the reader. It never reads anything from the page.
 */

export interface JoinPageDeps {
  location: Pick<Location, 'href' | 'hash' | 'pathname' | 'search'>;
  replaceUrl: (url: string) => void;
  send: (message: unknown) => Promise<unknown>;
  announce: (event: string) => void;
}

export const JOIN_OPENED_EVENT = 'hamesh:join-opened';

export async function handOverJoinLink(deps: JoinPageDeps): Promise<void> {
  if (!isJoinPage(deps.location.href)) return;
  const token = joinTokenFrom(deps.location.hash);
  if (!token) return;
  deps.replaceUrl(deps.location.pathname + deps.location.search);
  try {
    const reply = (await deps.send({ type: 'TEAMS_PAGE', request: { op: 'join', token } })) as {
      ok?: unknown;
    } | null;
    if (reply?.ok === true) deps.announce(JOIN_OPENED_EVENT);
  } catch {
    // No worker to answer (an update in progress): the page's copy button
    // still has the link.
  }
}

/** The real page and worker. */
export function joinPageDeps(): JoinPageDeps {
  return {
    location: window.location,
    replaceUrl: (url) => history.replaceState(history.state, '', url),
    send: (message) => browser.runtime.sendMessage(message),
    announce: (event) => document.dispatchEvent(new CustomEvent(event)),
  };
}
