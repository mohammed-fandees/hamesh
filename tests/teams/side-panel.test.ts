import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { getURL: (path: string) => `moz-extension://id${path}` },
  },
}));

import { canOpenPanel, openPanel } from '@/teams/side-panel';

const params = new URLSearchParams({ view: 'panel', note: 'n' });

const chromium = (open: () => Promise<void> = async () => {}) => ({
  sidePanel: { setOptions: vi.fn(async () => {}), open: vi.fn(open) },
});
const firefox = (open: () => Promise<void> = async () => {}) => ({
  sidebarAction: { setPanel: vi.fn(async () => {}), open: vi.fn(open) },
});

describe('opening the panel beside the page', () => {
  it('uses the side panel on Chromium, for that tab', async () => {
    const apis = chromium();
    expect(await openPanel(params, 7, apis)).toBe(true);
    expect(apis.sidePanel.setOptions).toHaveBeenCalledWith({
      tabId: 7,
      path: 'notes.html?view=panel&note=n',
      enabled: true,
    });
    expect(apis.sidePanel.open).toHaveBeenCalledWith({ tabId: 7 });
  });

  it('uses the sidebar on Firefox, with a full address', async () => {
    const apis = firefox();
    expect(await openPanel(params, 7, apis)).toBe(true);
    expect(apis.sidebarAction.setPanel).toHaveBeenCalledWith({
      tabId: 7,
      panel: 'moz-extension://id/notes.html?view=panel&note=n',
    });
    expect(apis.sidebarAction.open).toHaveBeenCalled();
  });

  it('asks to open in the same tick, because a browser only allows it from the click', () => {
    const apis = firefox();
    void openPanel(params, 7, apis);
    expect(apis.sidebarAction.open).toHaveBeenCalledTimes(1);
  });

  it('says so when the browser refuses, so the caller can open a tab', async () => {
    const refused = () => Promise.reject(new Error('may only be called from a user input handler'));
    expect(await openPanel(params, 7, firefox(refused))).toBe(false);
    expect(await openPanel(params, 7, chromium(refused))).toBe(false);
  });

  it('says so on a browser with neither, such as Safari', async () => {
    expect(canOpenPanel({})).toBe(false);
    expect(await openPanel(params, 7, {})).toBe(false);
  });

  it('knows both kinds of browser can', () => {
    expect(canOpenPanel(chromium())).toBe(true);
    expect(canOpenPanel(firefox())).toBe(true);
  });
});
