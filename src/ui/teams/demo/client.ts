import type { Comment, Invitation, TeamMember, TeamResponse } from '@hamesh/teams-contract';
import { mentionsIn } from '@hamesh/teams-contract/mentions';
import { generatePageKey } from '@/domain/page-key';
import type { TeamsClient } from '@/teams/client';
import type { TeamCacheResult, TeamsEvent, TeamsReply } from '@/teams/messages';
import type { TeamsOpName } from '@/teams/operation-names';
import type { CachedTeamNote } from '@/teams/page-cache';
import { writePageBucket, writeTeamIndex } from '@/teams/page-cache';
import type { CachedFolder } from '@/teams/sync-store';
import {
  DEMO_COMMENTS,
  DEMO_FOLDERS,
  DEMO_INVITATIONS,
  DEMO_ME,
  DEMO_MEMBERS,
  DEMO_MENTIONS,
  DEMO_NOTES,
  DEMO_PAYMENTS,
  DEMO_PLANS,
  DEMO_TEAMS,
  demoMe,
} from './data';

/**
 * A `TeamsClient` that answers from made-up data instead of a server.
 *
 * For looking at the Teams pages — every screen, both languages, both
 * appearances — without a session, a network, or an OAuth client. Nothing here
 * touches the background worker, the session store or the real API: it is a
 * stand-in for the one interface the pages talk through, so what they render is
 * exactly what they would render for real answers of the same shape.
 *
 * It is not a bypass of anything. There is no token to obtain and no server to
 * convince; a build with this in it cannot reach a real team at all. And it is
 * compiled in only when a build sets `WXT_TEAMS_DEMO`, so it is absent from
 * every other one.
 *
 * It **changes** as it is used — a folder created appears, a note deleted goes,
 * a comment posted shows up — because a demo you cannot press anything in tells
 * you nothing about the page.
 */

/** Slows each answer a touch, so the working states are visible at all. */
const LATENCY_MS = 220;

export interface DemoOptions {
  /** How long each answer takes. Zero in tests, which have no eyes. */
  latencyMs?: number;
}

/**
 * The cached shape carries the team it belongs to; the wire's `TeamNote` does
 * not, because the path already said which team. Dropping it here keeps the
 * demo's answers exactly the shape the contract describes.
 */
const toWire = ({ teamId, ...wire }: CachedTeamNote) => {
  void teamId;
  return wire;
};

const clone = <T>(value: T): T => structuredClone(value);

/** The made-up world, copied so the module's own data is never mutated. */
interface World {
  teams: Record<string, TeamResponse>;
  members: Record<string, TeamMember[]>;
  invitations: Record<string, Invitation[]>;
  folders: Record<string, CachedFolder[]>;
  notes: CachedTeamNote[];
  comments: Record<string, Comment[]>;
  mentions: typeof DEMO_MENTIONS;
  payments: typeof DEMO_PAYMENTS;
}

function freshWorld(): World {
  return {
    teams: clone(DEMO_TEAMS),
    members: clone(DEMO_MEMBERS),
    invitations: clone(DEMO_INVITATIONS),
    folders: clone(DEMO_FOLDERS),
    notes: clone(DEMO_NOTES),
    comments: clone(DEMO_COMMENTS),
    mentions: clone(DEMO_MENTIONS),
    payments: clone(DEMO_PAYMENTS),
  };
}

/** A fresh ULID-shaped id, so what the demo makes looks like what a server makes. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function madeUpId(): string {
  let out = '0';
  for (let i = 1; i < 26; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function createDemoTeamsClient(options: DemoOptions = {}): TeamsClient {
  const latency = options.latencyMs ?? LATENCY_MS;
  const wait = () => new Promise((resolve) => setTimeout(resolve, latency));
  const world = freshWorld();
  const listeners = new Set<(event: TeamsEvent) => void>();

  const teamList = () =>
    Object.values(world.teams).map((t) => ({
      id: t.team.id,
      name: t.team.name,
      role: t.team.role,
    }));

  /**
   * Writes the made-up notes where the content script and the Library look for
   * them — the one place the demo touches real storage, because that read model
   * is how a page gets a team's notes at all (see `teams/page-cache.ts`).
   */
  async function seedStorage(): Promise<void> {
    await writeTeamIndex(
      Object.values(world.teams).map((t) => ({ id: t.team.id, name: t.team.name })),
      Date.now(),
    );
    const byPage = new Map<string, CachedTeamNote[]>();
    for (const note of world.notes) {
      const pageKey = generatePageKey(note.originalUrl);
      byPage.set(pageKey, [...(byPage.get(pageKey) ?? []), note]);
    }
    await Promise.all([...byPage].map(([pageKey, notes]) => writePageBucket(pageKey, notes)));
  }
  void seedStorage();

  /** Re-seeds after anything that changed which notes exist. */
  const reseed = () => void seedStorage();

  const commentsFor = (noteId: string) => (world.comments[noteId] ??= []);

  /** Finds a comment anywhere in a note's thread, replies included. */
  function findComment(commentId: string): { note: string; comment: Comment } | null {
    for (const [noteId, thread] of Object.entries(world.comments)) {
      for (const top of thread) {
        if (top.id === commentId) return { note: noteId, comment: top };
        for (const reply of top.replies ?? []) {
          if (reply.id === commentId) return { note: noteId, comment: reply };
        }
      }
    }
    return null;
  }

  async function perform(op: TeamsOpName, params: Record<string, unknown>): Promise<unknown> {
    await wait();
    const teamId = params.teamId as string;

    switch (op) {
      case 'team.get':
        return world.teams[teamId];
      case 'team.create': {
        const created: TeamResponse = {
          team: {
            id: madeUpId(),
            name: String(params.name),
            role: 'owner',
            state: 'active',
            readOnlyUntil: null,
          },
          capabilities: clone(world.teams[Object.keys(world.teams)[0]!]!.capabilities),
          serverTime: Date.now(),
        };
        world.teams[created.team.id] = created;
        world.members[created.team.id] = [
          {
            userId: DEMO_ME,
            displayName: 'You',
            email: 'you@example.test',
            role: 'owner',
            joinedAt: Date.now(),
          },
        ];
        world.invitations[created.team.id] = [];
        world.folders[created.team.id] = [];
        reseed();
        return created;
      }
      case 'team.rename': {
        const team = world.teams[teamId];
        if (team) team.team.name = String(params.name);
        reseed();
        return team;
      }
      case 'team.delete':
        delete world.teams[teamId];
        world.notes = world.notes.filter((n) => n.teamId !== teamId);
        reseed();
        return undefined;
      case 'team.transfer': {
        const team = world.teams[teamId];
        if (team) team.team.role = 'admin';
        for (const member of world.members[teamId] ?? []) {
          if (member.userId === params.userId) member.role = 'owner';
          else if (member.userId === DEMO_ME) member.role = 'admin';
        }
        return team;
      }

      case 'members.list':
        return { members: world.members[teamId] ?? [] };
      case 'members.setRole': {
        const member = (world.members[teamId] ?? []).find((m) => m.userId === params.userId);
        if (member) member.role = params.role as 'admin' | 'member';
        return undefined;
      }
      case 'members.remove':
        world.members[teamId] = (world.members[teamId] ?? []).filter(
          (m) => m.userId !== params.userId,
        );
        // Removing yourself is leaving.
        if (params.userId === DEMO_ME) {
          delete world.teams[teamId];
          world.notes = world.notes.filter((n) => n.teamId !== teamId);
          reseed();
        }
        return undefined;

      case 'invites.list':
        return { invitations: world.invitations[teamId] ?? [] };
      case 'invites.create': {
        const invitation: Invitation = {
          id: madeUpId(),
          email: String(params.email),
          role: params.role as 'admin' | 'member',
          createdAt: Date.now(),
          expiresAt: Date.now() + 7 * 86_400_000,
          expired: false,
        };
        world.invitations[teamId] = [...(world.invitations[teamId] ?? []), invitation];
        return {
          invitation,
          link: `https://hamesh.app/join#${'D'.repeat(43)}`,
        };
      }
      case 'invites.revoke':
        world.invitations[teamId] = (world.invitations[teamId] ?? []).filter(
          (i) => i.id !== params.invitationId,
        );
        return undefined;
      case 'invites.preview':
        return {
          team: { id: madeUpId(), name: 'Somebody else’s team' },
          invitedBy: 'Sara Mansour',
          role: 'member',
          expiresAt: Date.now() + 3 * 86_400_000,
        };
      case 'invites.accept': {
        const joined: TeamResponse = {
          team: {
            id: madeUpId(),
            name: 'Somebody else’s team',
            role: 'member',
            state: 'active',
            readOnlyUntil: null,
          },
          capabilities: ['team.view', 'team.leave', 'notes.create', 'comments.create'],
          serverTime: Date.now(),
        };
        world.teams[joined.team.id] = joined;
        world.members[joined.team.id] = [
          { userId: DEMO_ME, displayName: 'You', role: 'member', joinedAt: Date.now() },
        ];
        world.invitations[joined.team.id] = [];
        world.folders[joined.team.id] = [];
        reseed();
        return joined;
      }

      case 'notes.changes':
        return { notes: [], folders: [], cursor: 'demo', hasMore: false };
      case 'notes.share': {
        const shared: CachedTeamNote = {
          id: madeUpId(),
          teamId,
          originalUrl: String(params.originalUrl),
          pageTitle: (params.pageTitle as string) ?? null,
          content: String(params.content),
          anchor: params.anchor as CachedTeamNote['anchor'],
          folderId: null,
          authorId: DEMO_ME,
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        world.notes = [shared, ...world.notes];
        reseed();
        return { note: toWire(shared) };
      }
      case 'notes.update': {
        const note = world.notes.find((n) => n.id === params.noteId);
        if (note) {
          if (params.content !== undefined) note.content = String(params.content);
          if (params.folderId !== undefined) note.folderId = (params.folderId as string) ?? null;
          note.version += 1;
          note.updatedAt = Date.now();
        }
        reseed();
        return { note: note ? toWire(note) : undefined };
      }
      case 'notes.delete':
        world.notes = world.notes.filter((n) => n.id !== params.noteId);
        delete world.comments[params.noteId as string];
        reseed();
        return undefined;
      case 'notes.unshare': {
        const note = world.notes.find((n) => n.id === params.noteId);
        world.notes = world.notes.filter((n) => n.id !== params.noteId);
        reseed();
        return { note: note ? toWire(note) : undefined };
      }

      case 'folders.create': {
        const folder: CachedFolder = {
          id: madeUpId(),
          parentId: (params.parentId as string) ?? null,
          name: String(params.name),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        world.folders[teamId] = [...(world.folders[teamId] ?? []), folder];
        return { folder };
      }
      case 'folders.rename': {
        const folder = (world.folders[teamId] ?? []).find((f) => f.id === params.folderId);
        if (folder) {
          folder.name = String(params.name);
          folder.updatedAt = Date.now();
        }
        return { folder };
      }
      case 'folders.delete':
        world.folders[teamId] = (world.folders[teamId] ?? []).filter(
          (f) => f.id !== params.folderId,
        );
        // The notes in it stay, unfiled — as the server does it.
        for (const note of world.notes) {
          if (note.folderId === params.folderId) note.folderId = null;
        }
        reseed();
        return undefined;

      case 'comments.list':
        return { comments: commentsFor(params.noteId as string), nextAfter: null };
      case 'comments.replies': {
        const found = findComment(params.commentId as string);
        return { replies: found?.comment.replies ?? [], nextAfter: null };
      }
      case 'comments.create': {
        const made: Comment = {
          id: madeUpId(),
          parentId: (params.parentId as string) ?? null,
          authorId: DEMO_ME,
          body: String(params.body),
          mentions: mentionsIn(String(params.body)),
          createdAt: Date.now(),
          editedAt: null,
          deleted: false,
        };
        const thread = commentsFor(params.noteId as string);
        if (made.parentId) {
          const parent = thread.find((c) => c.id === made.parentId);
          if (parent) {
            parent.replies = [...(parent.replies ?? []), made];
            parent.replyCount = (parent.replyCount ?? 0) + 1;
          }
        } else {
          thread.push({ ...made, replyCount: 0, replies: [] });
        }
        return { comment: made };
      }
      case 'comments.update': {
        const found = findComment(params.commentId as string);
        if (found) {
          found.comment.body = String(params.body);
          found.comment.mentions = mentionsIn(String(params.body));
          found.comment.editedAt = Date.now();
        }
        return { comment: found?.comment };
      }
      case 'comments.delete': {
        const found = findComment(params.commentId as string);
        if (!found) return undefined;
        const thread = commentsFor(found.note);
        const top = thread.find((c) => c.id === params.commentId);
        if (top) {
          // A top-level comment with replies stays as a placeholder, as on the server.
          if ((top.replyCount ?? 0) > 0) {
            top.deleted = true;
            top.body = '';
            top.authorId = null;
          } else {
            world.comments[found.note] = thread.filter((c) => c.id !== params.commentId);
          }
        } else {
          for (const parent of thread) {
            if (!parent.replies?.some((r) => r.id === params.commentId)) continue;
            parent.replies = parent.replies.filter((r) => r.id !== params.commentId);
            parent.replyCount = Math.max(0, (parent.replyCount ?? 1) - 1);
          }
        }
        return undefined;
      }

      case 'mentions.list':
        return { mentions: world.mentions, nextBefore: null };

      case 'realtime.ticket':
        // Nothing to connect to, and nothing that would poke this build.
        return { ticket: 'demo', url: 'wss://demo.invalid/v1/realtime', expiresAt: Date.now() };

      case 'billing.plans':
        return DEMO_PLANS;
      case 'billing.payments':
        return { payments: world.payments };
      case 'billing.submit': {
        const payment = {
          id: madeUpId(),
          method: params.method as 'instapay' | 'vodafone_cash',
          reference: String(params.reference),
          periods: Number(params.periods),
          amountMinor: 45_000 * Number(params.periods),
          currency: 'EGP',
          status: 'pending' as const,
          submittedAt: Date.now(),
          decidedAt: null,
          note: null,
        };
        world.payments = [payment, ...world.payments];
        return { payment };
      }
    }
  }

  return {
    async send(op): Promise<TeamsReply> {
      await wait();
      if (op === 'signOut') return { status: { state: 'signed_out' } };
      return { status: { state: 'signed_in', me: demoMe(teamList()) } };
    },

    async request(op, params) {
      const data = await perform(op, (params ?? {}) as Record<string, unknown>);
      return { ok: true, data } as never;
    },

    async cache(_op, teamId): Promise<TeamCacheResult> {
      await wait();
      const notes = world.notes
        .filter((n) => n.teamId === teamId)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      return {
        ok: true,
        data: { notes, folders: world.folders[teamId] ?? [], syncedAt: Date.now() },
      };
    },

    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    // Nothing to ask the browser for: this build talks to no origin at all.
    async requestPermissions() {
      return true;
    },
    async removePermissions() {},
  };
}
