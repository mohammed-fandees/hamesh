import { describe, it, expect, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));

import { isExtensionPageSender } from '@/teams/background';
import { isTeamsCacheRequest, isTeamsEvent, isTeamsRequest } from '@/teams/messages';

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

describe('the worker’s notice to Hamesh’s own pages', () => {
  const TEAM = '01J0000000000000000000000A';
  const NOTE = '01J0000000000000000000000N';

  it('is recognised only in the one shape it has', () => {
    expect(
      isTeamsEvent({ type: 'TEAMS_EVENT', event: 'comments', teamId: TEAM, noteId: NOTE }),
    ).toBe(true);
    for (const message of [
      { type: 'TEAMS_EVENT', event: 'comments', teamId: TEAM },
      { type: 'TEAMS_EVENT', event: 'anything', teamId: TEAM, noteId: NOTE },
      { type: 'TEAMS', event: 'comments', teamId: TEAM, noteId: NOTE },
      { type: 'TEAMS_EVENT' },
      null,
      'TEAMS_EVENT',
    ]) {
      expect(isTeamsEvent(message), JSON.stringify(message)).toBe(false);
    }
  });

  it('is not a request, and a request is not it', () => {
    const event = { type: 'TEAMS_EVENT', event: 'comments', teamId: TEAM, noteId: NOTE };
    expect(isTeamsRequest(event)).toBe(false);
    expect(isTeamsCacheRequest(event)).toBe(false);
    expect(isTeamsEvent({ type: 'TEAMS_CACHE', op: 'notes', teamId: TEAM })).toBe(false);
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
