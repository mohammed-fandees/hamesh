import { describe, it, expect, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));

import { isExtensionPageSender } from '@/teams/background';
import { isTeamsRequest } from '@/teams/messages';

const ID = 'abcdefghijklmnopabcdefghijklmnop';
const ORIGIN = `chrome-extension://${ID}/`;

describe('who may drive Teams', () => {
  it('accepts Hamesh’s own pages, in a tab or not', () => {
    expect(isExtensionPageSender({ id: ID, url: `${ORIGIN}notes.html` }, ID, ORIGIN)).toBe(true);
    expect(isExtensionPageSender({ id: ID, url: `${ORIGIN}popup.html` }, ID, ORIGIN)).toBe(true);
  });

  it('refuses a content script, which speaks from inside a web page', () => {
    expect(isExtensionPageSender({ id: ID, url: 'https://example.com/' }, ID, ORIGIN)).toBe(false);
    // A page that merely mentions the extension origin in its URL is still a web page.
    expect(
      isExtensionPageSender(
        { id: ID, url: `https://evil.example/${encodeURIComponent(ORIGIN)}` },
        ID,
        ORIGIN,
      ),
    ).toBe(false);
  });

  it('refuses another extension, or a sender without a URL', () => {
    expect(
      isExtensionPageSender({ id: 'other', url: 'chrome-extension://other/x.html' }, ID, ORIGIN),
    ).toBe(false);
    expect(isExtensionPageSender({ id: ID }, ID, ORIGIN)).toBe(false);
    expect(isExtensionPageSender({ id: ID, url: 'not a url' }, ID, ORIGIN)).toBe(false);
  });
});

describe('isTeamsRequest', () => {
  it('knows only the Teams operations', () => {
    expect(isTeamsRequest({ type: 'TEAMS', op: 'status' })).toBe(true);
    expect(isTeamsRequest({ type: 'TEAMS', op: 'signIn' })).toBe(true);
    expect(isTeamsRequest({ type: 'TEAMS', op: 'getToken' })).toBe(false);
    expect(isTeamsRequest({ type: 'TEAMS' })).toBe(false);
    expect(isTeamsRequest({ type: 'GET_SHORTCUTS' })).toBe(false);
    expect(isTeamsRequest(null)).toBe(false);
    expect(isTeamsRequest('TEAMS')).toBe(false);
  });
});
