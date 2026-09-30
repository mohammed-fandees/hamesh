import type {
  Comment,
  Invitation,
  MeResponse,
  MentionEntry,
  PaymentView,
  PlansResponse,
  TeamMember,
  TeamResponse,
} from '@hamesh/teams-contract';
import type { CachedTeamNote } from '@/teams/page-cache';
import type { CachedFolder } from '@/teams/sync-store';

/**
 * A team's worth of made-up data, for looking at the Teams pages without a
 * server.
 *
 * Every id here is shaped like a real one (a ULID the operation table would
 * accept), every timestamp is relative to when the build runs, and the states
 * worth seeing are all represented: a team you own and one you are only a member
 * of, a member and an admin, an invitation that is open and one that expired, a
 * note filed and a note not, a comment with replies and one deleted with replies
 * hanging off it, a mention of you and a mention of somebody else.
 *
 * Nothing in here is a credential, and nothing it describes exists.
 */

/** 21 characters of prefix plus a 5-character tag makes a ULID-shaped id. */
const id = (tag: string) => `01JQZ8K3M4N5P6R7S8T9V${tag}`;

export const DEMO_ME = id('MEMB1');
const SARA = id('MEMB2');
const OMAR = id('MEMB3');
const LAYLA = id('MEMB4');

export const TEAM_ALPHA = id('TEAMA');
export const TEAM_READS = id('TEAMB');

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Fixed once per load, so nothing shifts under the reader mid-visit. */
const NOW = Date.now();
const ago = (ms: number) => NOW - ms;

export const DEMO_TEAM_NAMES: Record<string, string> = {
  [TEAM_ALPHA]: 'Alpha',
  [TEAM_READS]: 'Reading group',
};

export function demoMe(
  teams: { id: string; name: string; role: 'owner' | 'admin' | 'member' }[],
): MeResponse {
  return {
    user: { id: DEMO_ME, email: 'you@example.test', displayName: 'You' },
    entitlement: {
      state: 'active',
      plan: 'teams',
      until: NOW + 21 * DAY,
      limits: { ownedTeams: 3, membersPerTeam: 10, notesPerTeam: 5000 },
      sources: ['subscription'],
    },
    subscription: {
      state: 'active',
      canceled: false,
      pendingPayment: null,
    },
    teams,
    serverTime: NOW,
  };
}

/** Everything the owner of Alpha may do; the Reading group holds far less. */
const OWNER_CAPABILITIES = [
  'team.view',
  'team.rename',
  'team.delete',
  'team.transfer',
  'team.audit.view',
  'members.view_emails',
  'members.remove_member',
  'members.remove_admin',
  'members.promote',
  'members.demote',
  'invites.create_member',
  'invites.create_admin',
  'invites.manage',
  'invites.manage_admin',
  'notes.create',
  'notes.edit_own',
  'notes.edit_any',
  'notes.delete_own',
  'notes.delete_any',
  'notes.unshare_own',
  'notes.file_own',
  'notes.file_any',
  'folders.manage',
  'comments.create',
  'comments.edit_own',
  'comments.delete_own',
  'comments.delete_any',
  'realtime.connect',
  'billing.view_state',
  'billing.view_end_date',
] as const;

const MEMBER_CAPABILITIES = [
  'team.view',
  'team.leave',
  'notes.create',
  'notes.edit_own',
  'notes.delete_own',
  'notes.unshare_own',
  'notes.file_own',
  'comments.create',
  'comments.edit_own',
  'comments.delete_own',
  'realtime.connect',
] as const;

export const DEMO_TEAMS: Record<string, TeamResponse> = {
  [TEAM_ALPHA]: {
    team: { id: TEAM_ALPHA, name: 'Alpha', role: 'owner', state: 'active', readOnlyUntil: null },
    capabilities: [...OWNER_CAPABILITIES],
    serverTime: NOW,
  },
  [TEAM_READS]: {
    team: {
      id: TEAM_READS,
      name: 'Reading group',
      role: 'member',
      // The read-only state is worth seeing, so one team is in it.
      state: 'read_only',
      readOnlyUntil: NOW + 9 * DAY,
    },
    capabilities: [...MEMBER_CAPABILITIES],
    serverTime: NOW,
  },
};

export const DEMO_MEMBERS: Record<string, TeamMember[]> = {
  [TEAM_ALPHA]: [
    {
      userId: DEMO_ME,
      displayName: 'You',
      email: 'you@example.test',
      role: 'owner',
      joinedAt: ago(90 * DAY),
    },
    {
      userId: SARA,
      displayName: 'Sara Mansour',
      email: 'sara@example.test',
      role: 'admin',
      joinedAt: ago(60 * DAY),
    },
    {
      userId: OMAR,
      displayName: 'Omar Halabi',
      email: 'omar@example.test',
      role: 'member',
      joinedAt: ago(21 * DAY),
    },
    {
      userId: LAYLA,
      displayName: 'Layla Aziz',
      email: 'layla@example.test',
      role: 'member',
      joinedAt: ago(3 * DAY),
    },
  ],
  [TEAM_READS]: [
    // No emails: a plain member is not told them, and the panel must cope.
    { userId: OMAR, displayName: 'Omar Halabi', role: 'owner', joinedAt: ago(120 * DAY) },
    { userId: DEMO_ME, displayName: 'You', role: 'member', joinedAt: ago(30 * DAY) },
  ],
};

export const DEMO_INVITATIONS: Record<string, Invitation[]> = {
  [TEAM_ALPHA]: [
    {
      id: id('INVT1'),
      email: 'nadia@example.test',
      role: 'member',
      createdAt: ago(2 * DAY),
      expiresAt: NOW + 5 * DAY,
      expired: false,
    },
    {
      id: id('INVT2'),
      email: 'karim@example.test',
      role: 'admin',
      createdAt: ago(20 * DAY),
      expiresAt: ago(13 * DAY),
      expired: true,
    },
  ],
  [TEAM_READS]: [],
};

export const DEMO_FOLDERS: Record<string, CachedFolder[]> = {
  [TEAM_ALPHA]: [
    {
      id: id('FLDR1'),
      parentId: null,
      name: 'Onboarding',
      createdAt: ago(40 * DAY),
      updatedAt: ago(40 * DAY),
    },
    {
      id: id('FLDR2'),
      parentId: null,
      name: 'Competitors',
      createdAt: ago(30 * DAY),
      updatedAt: ago(30 * DAY),
    },
    {
      id: id('FLDR3'),
      parentId: id('FLDR2'),
      name: 'Pricing pages',
      createdAt: ago(12 * DAY),
      updatedAt: ago(12 * DAY),
    },
  ],
  [TEAM_READS]: [],
};

const anchor = (selector: string, text: string) => ({
  type: 'text' as const,
  version: 1 as const,
  exact: text,
  context: { prefix: '', suffix: '' },
  textPosition: { start: 0, end: text.length },
  container: { selector },
});

function note(
  tag: string,
  teamId: string,
  url: string,
  title: string,
  content: string,
  extra: Partial<CachedTeamNote> = {},
): CachedTeamNote {
  return {
    id: id(tag),
    teamId,
    originalUrl: url,
    pageTitle: title,
    content,
    anchor: anchor('main', content.slice(0, 24)),
    folderId: null,
    authorId: SARA,
    version: 1,
    createdAt: ago(9 * DAY),
    updatedAt: ago(2 * DAY),
    ...extra,
  };
}

/**
 * Real pages, so the in-page half can be seen too: open one of these in a demo
 * build and the note is on it, marked with its team.
 */
export const DEMO_NOTES: CachedTeamNote[] = [
  note(
    'NOTE1',
    TEAM_ALPHA,
    'https://developer.mozilla.org/en-US/docs/Web/API/Storage',
    'Storage — Web APIs | MDN',
    'the quota section is the one people miss — worth calling out in onboarding',
    { folderId: id('FLDR1'), updatedAt: ago(4 * HOUR) },
  ),
  note(
    'NOTE2',
    TEAM_ALPHA,
    'https://developer.mozilla.org/en-US/docs/Web/API/Storage',
    'Storage — Web APIs | MDN',
    'check whether this still applies to the self-hosted build',
    { authorId: DEMO_ME, folderId: id('FLDR1'), version: 3, updatedAt: ago(2 * DAY) },
  ),
  note(
    'NOTE3',
    TEAM_ALPHA,
    'https://en.wikipedia.org/wiki/Marginalia',
    'Marginalia — Wikipedia',
    'the Fermat story belongs in the launch post',
    { authorId: DEMO_ME, updatedAt: ago(6 * DAY) },
  ),
  note(
    'NOTE4',
    TEAM_ALPHA,
    'https://example.com/pricing',
    'Pricing',
    'they moved the per-seat tier — our comparison table is out of date',
    { folderId: id('FLDR3'), authorId: OMAR, updatedAt: ago(1 * DAY) },
  ),
  note(
    'NOTE5',
    TEAM_ALPHA,
    'https://example.com/pricing',
    'Pricing',
    // A note by somebody who has left: authorId null must render.
    'no annual discount any more?',
    { authorId: null, updatedAt: ago(15 * DAY) },
  ),
  note(
    'NOTE6',
    TEAM_READS,
    'https://en.wikipedia.org/wiki/Marginalia',
    'Marginalia — Wikipedia',
    'for next week: the section on Talmudic glosses',
    { authorId: OMAR, updatedAt: ago(8 * HOUR) },
  ),
];

function comment(
  tag: string,
  authorId: string | null,
  body: string,
  extra: Partial<Comment> = {},
): Comment {
  return {
    id: id(tag),
    parentId: null,
    authorId,
    body,
    mentions: [],
    createdAt: ago(2 * DAY),
    editedAt: null,
    deleted: false,
    ...extra,
  };
}

/** Keyed by note id. Only some notes have a discussion, as in life. */
export const DEMO_COMMENTS: Record<string, Comment[]> = {
  [id('NOTE1')]: [
    comment('CMNT1', SARA, `good catch — <@${DEMO_ME}> do you want to fix the page, or shall I?`, {
      mentions: [DEMO_ME],
      createdAt: ago(3 * HOUR),
      replyCount: 2,
      replies: [
        comment('CMNT2', DEMO_ME, 'I will — it is one line', {
          parentId: id('CMNT1'),
          createdAt: ago(2 * HOUR),
          editedAt: ago(1 * HOUR),
        }),
        comment('CMNT3', OMAR, 'filing it under Onboarding so it does not get lost', {
          parentId: id('CMNT1'),
          createdAt: ago(1 * HOUR),
        }),
      ],
    }),
    // Deleted, but kept in place because a reply hangs off it.
    comment('CMNT4', null, '', {
      deleted: true,
      createdAt: ago(1 * DAY),
      replyCount: 1,
      replies: [
        comment('CMNT5', LAYLA, 'agreed, and the same is true of the sync page', {
          parentId: id('CMNT4'),
          createdAt: ago(20 * HOUR),
        }),
      ],
    }),
  ],
  [id('NOTE4')]: [
    comment('CMNT6', OMAR, `<@${DEMO_ME}> worth a look before the review`, {
      mentions: [DEMO_ME],
      createdAt: ago(5 * HOUR),
      replyCount: 0,
      replies: [],
    }),
  ],
};

export const DEMO_MENTIONS: MentionEntry[] = [
  {
    commentId: id('CMNT6'),
    teamId: TEAM_ALPHA,
    teamName: 'Alpha',
    noteId: id('NOTE4'),
    authorId: OMAR,
    body: `<@${DEMO_ME}> worth a look before the review`,
    createdAt: ago(5 * HOUR),
  },
  {
    commentId: id('CMNT1'),
    teamId: TEAM_ALPHA,
    teamName: 'Alpha',
    noteId: id('NOTE1'),
    authorId: SARA,
    body: `good catch — <@${DEMO_ME}> do you want to fix the page, or shall I?`,
    createdAt: ago(3 * HOUR),
  },
];

export const DEMO_PLANS: PlansResponse = {
  plans: [
    {
      code: 'teams',
      price: { amountMinor: 45_000, currency: 'EGP', periodDays: 30 },
      limits: { ownedTeams: 3, membersPerTeam: 10, notesPerTeam: 5000 },
    },
  ],
  methods: ['instapay', 'vodafone_cash'],
};

export const DEMO_PAYMENTS: PaymentView[] = [
  {
    id: id('PAY01'),
    method: 'instapay',
    reference: 'REF-4182',
    periods: 1,
    amountMinor: 45_000,
    currency: 'EGP',
    status: 'approved',
    submittedAt: ago(28 * DAY),
    decidedAt: ago(27 * DAY),
    note: null,
  },
  {
    id: id('PAY02'),
    method: 'vodafone_cash',
    reference: 'REF-5003',
    periods: 1,
    amountMinor: 45_000,
    currency: 'EGP',
    status: 'pending',
    submittedAt: ago(2 * HOUR),
    decidedAt: null,
    note: null,
  },
];
