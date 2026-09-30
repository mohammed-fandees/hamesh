import { describe, it, expect, beforeEach } from 'vitest';
import { resetStorage, store } from '../teams/fake-storage';
import { createDemoTeamsClient } from '@/ui/teams/demo/client';
import { DEMO_ME, TEAM_ALPHA } from '@/ui/teams/demo/data';
import { OPERATION_NAMES } from '@/teams/operation-names';
import { operations } from '@/teams/operations';
import { newRequestId } from '@/teams/operation-names';

/**
 * The demo client stands in for the real one, so it has to answer everything the
 * real one does — and answer it in the shape the contract describes, or the
 * pages it is meant to show would be shown wrongly.
 */

const NOTE = '01JQZ8K3M4N5P6R7S8T9VNOTE1';
const COMMENT = '01JQZ8K3M4N5P6R7S8T9VCMNT1';
const FOLDER = '01JQZ8K3M4N5P6R7S8T9VFLDR1';
const INVITE = '01JQZ8K3M4N5P6R7S8T9VINVT1';

const ANCHOR = {
  primarySelector: 'p',
  signals: { tagName: 'p' },
  fallbackDocumentPosition: { x: 0, y: 0 },
};

/** Valid params for every operation, so each one can actually be asked. */
const PARAMS: Record<string, unknown> = {
  'team.get': { teamId: TEAM_ALPHA },
  'team.create': { name: 'A new team', requestId: newRequestId() },
  'team.rename': { teamId: TEAM_ALPHA, name: 'Renamed' },
  'team.delete': { teamId: TEAM_ALPHA },
  'team.transfer': { teamId: TEAM_ALPHA, userId: DEMO_ME },
  'members.list': { teamId: TEAM_ALPHA },
  'members.setRole': { teamId: TEAM_ALPHA, userId: DEMO_ME, role: 'admin' },
  'members.remove': { teamId: TEAM_ALPHA, userId: '01JQZ8K3M4N5P6R7S8T9VMEMB3' },
  'invites.list': { teamId: TEAM_ALPHA },
  'invites.create': { teamId: TEAM_ALPHA, email: 'someone@example.test', role: 'member' },
  'invites.revoke': { teamId: TEAM_ALPHA, invitationId: INVITE },
  'invites.preview': { token: 'a'.repeat(43) },
  'invites.accept': { token: 'a'.repeat(43) },
  'notes.changes': { teamId: TEAM_ALPHA },
  'notes.share': {
    teamId: TEAM_ALPHA,
    requestId: newRequestId(),
    originalUrl: 'https://example.test/page',
    content: 'a thought',
    anchor: ANCHOR,
  },
  'notes.update': { teamId: TEAM_ALPHA, noteId: NOTE, version: 1, content: 'changed' },
  'notes.delete': { teamId: TEAM_ALPHA, noteId: NOTE },
  'notes.unshare': { teamId: TEAM_ALPHA, noteId: NOTE },
  'folders.create': { teamId: TEAM_ALPHA, name: 'New folder' },
  'folders.rename': { teamId: TEAM_ALPHA, folderId: FOLDER, name: 'Renamed folder' },
  'folders.delete': { teamId: TEAM_ALPHA, folderId: FOLDER },
  'comments.list': { teamId: TEAM_ALPHA, noteId: NOTE },
  'comments.replies': { teamId: TEAM_ALPHA, commentId: COMMENT },
  'comments.create': {
    teamId: TEAM_ALPHA,
    noteId: NOTE,
    requestId: newRequestId(),
    body: 'well put',
  },
  'comments.update': { teamId: TEAM_ALPHA, commentId: COMMENT, body: 'better put' },
  'comments.delete': { teamId: TEAM_ALPHA, commentId: COMMENT },
  'mentions.list': {},
  'realtime.ticket': { teamId: TEAM_ALPHA },
  'billing.plans': {},
  'billing.payments': {},
  'billing.submit': {
    planCode: 'teams',
    method: 'instapay',
    reference: 'REF-1',
    periods: 1,
  },
};

beforeEach(resetStorage);

describe('the demo client', () => {
  it('has an answer for every operation the pages can ask for', async () => {
    expect(Object.keys(PARAMS).sort()).toEqual([...OPERATION_NAMES].sort());

    for (const name of OPERATION_NAMES) {
      // A fresh world per operation: several of them delete what the next needs.
      const client = createDemoTeamsClient({ latencyMs: 0 });
      const result = await client.request(name, PARAMS[name] as never);
      expect(result.ok, name).toBe(true);
    }
  });

  it('answers in the shape the contract describes, so the pages read it correctly', async () => {
    for (const name of OPERATION_NAMES) {
      const client = createDemoTeamsClient({ latencyMs: 0 });
      const schema = operations()[name].result;
      if (schema === null) continue;
      const result = await client.request(name, PARAMS[name] as never);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const parsed = schema.safeParse(result.data);
      expect(parsed.success, `${name}: ${JSON.stringify(parsed.error?.issues?.[0])}`).toBe(true);
    }
  });

  it('reports a signed-in account, with the teams it made up', async () => {
    const client = createDemoTeamsClient({ latencyMs: 0 });
    const reply = await client.send('status');
    expect(reply.status.state).toBe('signed_in');
    if (reply.status.state !== 'signed_in') return;
    expect(reply.status.me?.teams.map((t) => t.name)).toEqual(['Alpha', 'Reading group']);
    expect(reply.status.me?.user.id).toBe(DEMO_ME);
  });

  it('changes as it is used, so the pages can actually be pressed', async () => {
    const client = createDemoTeamsClient({ latencyMs: 0 });
    const before = await client.cache('notes', TEAM_ALPHA);
    expect(before.ok && before.data.folders).toHaveLength(3);

    await client.request('folders.create', { teamId: TEAM_ALPHA, name: 'Later' } as never);
    const after = await client.cache('notes', TEAM_ALPHA);
    expect(after.ok && after.data.folders.map((f) => f.name)).toContain('Later');

    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const noteId = before.data.notes[0]!.id;
    await client.request('notes.delete', { teamId: TEAM_ALPHA, noteId } as never);
    const gone = await client.cache('notes', TEAM_ALPHA);
    expect(gone.ok && gone.data.notes.map((n) => n.id)).not.toContain(noteId);
  });

  it('keeps a deleted comment in place when replies hang off it, as the server does', async () => {
    const client = createDemoTeamsClient({ latencyMs: 0 });
    await client.request('comments.delete', { teamId: TEAM_ALPHA, commentId: COMMENT } as never);
    const thread = await client.request('comments.list', {
      teamId: TEAM_ALPHA,
      noteId: NOTE,
    } as never);
    expect(thread.ok).toBe(true);
    if (!thread.ok) return;
    const placeholder = thread.data.comments.find((c) => c.id === COMMENT);
    expect(placeholder?.deleted).toBe(true);
    expect(placeholder?.body).toBe('');
    expect(placeholder?.replies).toHaveLength(2);
  });

  it('files its notes where a page looks for them, so the in-page half works too', async () => {
    createDemoTeamsClient({ latencyMs: 0 });
    // The seeding is asynchronous; it is the one thing the demo writes.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const keys = [...store.keys()];
    expect(keys).toContain('local:hamesh:teams');
    expect(
      keys.filter((key) => key.startsWith('local:hamesh:team-notes:')).length,
      'a shelf per page that has one',
    ).toBeGreaterThan(1);
  });

  it('asks the browser for nothing, because it reaches no origin at all', async () => {
    const client = createDemoTeamsClient({ latencyMs: 0 });
    await expect(client.requestPermissions()).resolves.toBe(true);
    await expect(client.removePermissions()).resolves.toBeUndefined();
  });
});
