import { describe, it, expect } from 'vitest';
import { OPERATION_NAMES, isOperationName, newRequestId } from '@/teams/operation-names';
import { operations } from '@/teams/operations';

const TEAM = '01J0000000000000000000000A';
const USER = '01J0000000000000000000000B';
const NOTE = '01J0000000000000000000000D';
const COMMENT = '01J0000000000000000000000E';
const SARA = '01J0000000000000000000000S';

/** A minimal element anchor, as the extension's own notes carry one. */
const ANCHOR = {
  primarySelector: 'main > p:nth-child(2)',
  signals: { tagName: 'p' },
  fallbackDocumentPosition: { x: 10, y: 20 },
};

describe('the operation table', () => {
  it('recognises only the operations it lists', () => {
    for (const name of OPERATION_NAMES) expect(isOperationName(name)).toBe(true);
    for (const other of ['', 'me', 'team.nuke', 'toString', 'constructor', '__proto__']) {
      expect(isOperationName(other), other).toBe(false);
    }
    expect(isOperationName(null)).toBe(false);
  });

  /** Valid params per operation. A new operation must be listed here. */
  const VALID: Record<string, unknown> = {
    'team.get': { teamId: TEAM },
    'team.create': { name: 'Team', requestId: newRequestId() },
    'team.rename': { teamId: TEAM, name: 'Team' },
    'team.delete': { teamId: TEAM },
    'team.transfer': { teamId: TEAM, userId: USER },
    'members.list': { teamId: TEAM },
    'members.setRole': { teamId: TEAM, userId: USER, role: 'admin' },
    'members.remove': { teamId: TEAM, userId: USER },
    'invites.list': { teamId: TEAM },
    'invites.create': { teamId: TEAM, email: 'someone@example.test', role: 'member' },
    'invites.revoke': { teamId: TEAM, invitationId: TEAM },
    'invites.preview': { token: 'a'.repeat(43) },
    'invites.accept': { token: 'a'.repeat(43) },
    'notes.changes': { teamId: TEAM },
    'notes.share': {
      teamId: TEAM,
      requestId: 'a-personal-note-id',
      originalUrl: 'https://example.test/page',
      content: 'A thought',
      anchor: ANCHOR,
    },
    'notes.update': { teamId: TEAM, noteId: NOTE, version: 2, content: 'Changed' },
    'notes.delete': { teamId: TEAM, noteId: NOTE },
    'notes.unshare': { teamId: TEAM, noteId: NOTE },
    'folders.create': { teamId: TEAM, name: 'Reading' },
    'folders.rename': { teamId: TEAM, folderId: NOTE, name: 'Reading' },
    'folders.delete': { teamId: TEAM, folderId: NOTE },
    'comments.list': { teamId: TEAM, noteId: NOTE },
    'comments.replies': { teamId: TEAM, commentId: COMMENT },
    'comments.create': { teamId: TEAM, noteId: NOTE, requestId: newRequestId(), body: 'Well put' },
    'comments.update': { teamId: TEAM, commentId: COMMENT, body: 'Better put' },
    'comments.delete': { teamId: TEAM, commentId: COMMENT },
    'mentions.list': {},
    'realtime.ticket': { teamId: TEAM },
    'billing.plans': {},
    'billing.payments': {},
    'billing.submit': {
      planCode: 'teams',
      method: 'instapay',
      reference: 'REF-1',
      periods: 1,
    },
  };

  it('has every operation covered by these checks', () => {
    expect(Object.keys(VALID).sort()).toEqual([...OPERATION_NAMES].sort());
    // The list and the built table must not drift apart.
    expect(Object.keys(operations()).sort()).toEqual([...OPERATION_NAMES].sort());
  });

  it('builds every path under /v1/, from params it checked first', () => {
    for (const name of OPERATION_NAMES) {
      const operation = operations()[name];
      const params = operation.params.safeParse(VALID[name]);
      expect(params.success, name).toBe(true);
      const request = operation.request(params.data as never);
      expect(request.path.startsWith('/v1/'), `${name}: ${request.path}`).toBe(true);
      expect(request.path).not.toContain('..');
    }
  });

  it('refuses an id that is not a ULID, so a path cannot be steered', () => {
    for (const teamId of [
      '../../admin',
      '01J0000000000000000000000A/../x',
      'not-a-ulid',
      '',
      '01J0000000000000000000000a', // lowercase is not the ULID alphabet
    ]) {
      expect(operations()['team.get'].params.safeParse({ teamId }).success, teamId).toBe(false);
    }
    expect(operations()['team.get'].params.safeParse({ teamId: TEAM }).success).toBe(true);
  });

  it('refuses anything the operation did not ask for', () => {
    expect(operations()['team.get'].params.safeParse({ teamId: TEAM, role: 'owner' }).success).toBe(
      false,
    );
    expect(
      operations()['members.setRole'].params.safeParse({
        teamId: TEAM,
        userId: USER,
        role: 'owner',
      }).success,
      'ownership moves only through transfer',
    ).toBe(false);
  });

  it('sends the invitation token in the body, never in the URL', () => {
    const token = 'b'.repeat(43);
    for (const name of ['invites.preview', 'invites.accept'] as const) {
      const request = operations()[name].request({ token });
      expect(request.path).not.toContain(token);
      expect(request.body).toEqual({ token });
    }
  });

  it('never names the page anyone is on: a sync asks only for the cursor it holds', () => {
    const changes = operations()['notes.changes'];
    expect(changes.request({ teamId: TEAM }).path).toBe(`/v1/teams/${TEAM}/changes`);
    expect(changes.request({ teamId: TEAM, since: 'abc-123_XYZ' }).path).toBe(
      `/v1/teams/${TEAM}/changes?since=abc-123_XYZ`,
    );
    // The cursor is opaque, but it still has to be a cursor before it reaches a
    // URL — nothing else may be smuggled into the query string.
    for (const since of ['a b', 'x?y=1', '../../admin', '&limit=9999', 'a'.repeat(65), '']) {
      expect(changes.params.safeParse({ teamId: TEAM, since }).success, since).toBe(false);
    }
  });

  it('refuses an edit that changes nothing, and one that quotes no version', () => {
    const update = operations()['notes.update'];
    expect(update.params.safeParse({ teamId: TEAM, noteId: NOTE, version: 1 }).success).toBe(false);
    expect(update.params.safeParse({ teamId: TEAM, noteId: NOTE, content: 'x' }).success).toBe(
      false,
    );
    expect(
      update.params.safeParse({ teamId: TEAM, noteId: NOTE, version: 1, folderId: null }).success,
      'unfiling a note is a change',
    ).toBe(true);
  });

  it('refuses a note whose page is not a web page, or whose anchor is not one', () => {
    const share = operations()['notes.share'];
    const base = {
      teamId: TEAM,
      requestId: 'a-personal-note-id',
      content: 'A thought',
      anchor: ANCHOR,
    };
    for (const originalUrl of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'chrome-extension://abc/notes.html',
      'data:text/html,<p>',
    ]) {
      expect(share.params.safeParse({ ...base, originalUrl }).success, originalUrl).toBe(false);
    }
    expect(share.params.safeParse({ ...base, originalUrl: 'https://ok.test/' }).success).toBe(true);
    expect(
      share.params.safeParse({
        ...base,
        originalUrl: 'https://ok.test/',
        anchor: { ...ANCHOR, signals: { tagName: 'p', nope: 1 } },
      }).success,
      'an anchor the contract does not describe is not sent',
    ).toBe(false);
  });

  it('refuses a comment whose mentions are not the ones its text names', () => {
    const create = operations()['comments.create'];
    const base = { teamId: TEAM, noteId: NOTE, requestId: newRequestId() };
    // Naming someone the text never mentioned would notify them out of nowhere.
    expect(create.params.safeParse({ ...base, body: 'hello', mentions: [SARA] }).success).toBe(
      false,
    );
    // And a text that names someone must say so, so the server can check they
    // are in this team.
    expect(create.params.safeParse({ ...base, body: `hi <@${SARA}>` }).success).toBe(false);
    expect(
      create.params.safeParse({ ...base, body: `hi <@${SARA}>`, mentions: [SARA] }).success,
    ).toBe(true);

    const update = operations()['comments.update'];
    expect(
      update.params.safeParse({ teamId: TEAM, commentId: COMMENT, body: 'x', mentions: [SARA] })
        .success,
    ).toBe(false);
  });

  it('puts a paging cursor in the query only after it is an id', () => {
    const list = operations()['comments.list'];
    expect(list.request({ teamId: TEAM, noteId: NOTE }).path).toBe(
      `/v1/teams/${TEAM}/notes/${NOTE}/comments`,
    );
    expect(list.request({ teamId: TEAM, noteId: NOTE, after: COMMENT }).path).toBe(
      `/v1/teams/${TEAM}/notes/${NOTE}/comments?after=${COMMENT}`,
    );
    for (const after of ['../../admin', '1 OR 1=1', 'x&limit=9999', '']) {
      expect(list.params.safeParse({ teamId: TEAM, noteId: NOTE, after }).success, after).toBe(
        false,
      );
    }
    expect(operations()['mentions.list'].params.safeParse({ before: 'nope' }).success).toBe(false);
  });

  it('mints a request id the server will accept', () => {
    const ids = new Set(Array.from({ length: 50 }, newRequestId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});
