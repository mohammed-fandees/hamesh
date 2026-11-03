import { browser } from 'wxt/browser';

/** The two ways a browser offers a panel beside the page. */
interface PanelApis {
  /** Chrome, Edge, Brave, and most browsers built on Chromium. */
  sidePanel?: {
    setOptions(options: { tabId: number; path: string; enabled: boolean }): Promise<void>;
    open(options: { tabId: number }): Promise<void>;
  };
  /** Firefox. */
  sidebarAction?: {
    setPanel(details: { tabId: number; panel: string }): Promise<void>;
    open(): Promise<void>;
  };
}

const defaultApis = () => browser as unknown as PanelApis;

/** Whether this browser has a panel to open at all (Safari, for one, does not). */
export function canOpenPanel(apis: PanelApis = defaultApis()): boolean {
  return !!(apis.sidePanel || apis.sidebarAction);
}

/**
 * Opens `notes.html?<params>` beside the page, resolving `false` if it can't, so
 * the caller can fall back on a tab.
 *
 * Call it first thing in a click's own handler. Both APIs only open for a user
 * action, and awaiting anything first loses it. Chrome accepts a click relayed
 * from a content script; Firefox doesn't, so a button on a web page always gets
 * `false` there, and only a click on one of Hamesh's own pages opens its sidebar.
 */
export function openPanel(
  params: URLSearchParams,
  tabId: number,
  apis: PanelApis = defaultApis(),
): Promise<boolean> {
  const path = `notes.html?${params}`;
  const opened = (open: Promise<void>) =>
    open.then(
      () => true,
      () => false,
    );
  if (apis.sidePanel) {
    void apis.sidePanel.setOptions({ tabId, path, enabled: true }).catch(() => {});
    return opened(apis.sidePanel.open({ tabId }));
  }
  if (apis.sidebarAction) {
    const panel = browser.runtime.getURL(`/${path}` as '/notes.html');
    void apis.sidebarAction.setPanel({ tabId, panel }).catch(() => {});
    return opened(apis.sidebarAction.open());
  }
  return Promise.resolve(false);
}
