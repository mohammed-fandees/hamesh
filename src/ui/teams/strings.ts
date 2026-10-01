import { getStrings, type Lang, type Strings } from '../i18n';
import type { TeamsErrorCode } from '@/teams/errors';

/**
 * The words Teams says exactly as the rest of Hamesh does — Cancel, Keep it,
 * Delete, a folder, "Edited …". They live once, in the core table, and the
 * Teams table is composed from them, so the same button can never be worded
 * two ways on two pages.
 */
const SHARED = [
  'brand',
  'cancel',
  'keepIt',
  'save',
  'edit',
  'delete',
  'create',
  'working',
  'retry',
  'editedAgo',
  'showMore',
  'newFolder',
  'folderNamePlaceholder',
  'renameFolder',
  'deleteFolder',
  'addSubfolder',
  'folderActions',
  'unfiledSection',
  'noFolderOption',
  'moveToFolder',
] as const satisfies readonly (keyof Strings)[];

export type SharedStrings = Pick<Strings, (typeof SHARED)[number]>;
type TeamsOwnStrings = Omit<TeamsStrings, keyof SharedStrings>;

/**
 * Wording for the Teams page, kept beside it rather than in the shared
 * `i18n.ts`: Teams is optional, and a build without it should not carry a page
 * worth of text it will never show.
 *
 * Nothing here states a price, a limit, or what a role may do — those come
 * from the server, and the page prints what it is given.
 */
export interface TeamsStrings extends SharedStrings {
  teams: string;
  /** Said beside the Teams page's title: what a team is for. */
  tagline: string;
  /** Under the comment box: how to send, and how to start a new line. */
  composeHint: string;
  yourTeams: string;
  createTeam: string;
  teamNamePlaceholder: string;
  signedOutTitle: string;
  signedOutBody: string;
  goToSettings: string;

  role: (role: 'owner' | 'admin' | 'member') => string;
  stateReadOnly: (until: string) => string;
  stateReadOnlyNoDate: string;
  stateLocked: string;

  members: string;
  memberSince: (date: string) => string;
  makeAdmin: string;
  makeMember: string;
  removeMember: string;
  removeMemberConfirm: (name: string) => string;
  transferOwnership: string;
  transferConfirm: (name: string) => string;
  youMarker: string;

  invitations: string;
  inviteSomeone: string;
  inviteEmailPlaceholder: string;
  inviteAsMember: string;
  inviteAsAdmin: string;
  sendInvite: string;
  inviteLinkReady: string;
  inviteLinkHint: string;
  copyLink: string;
  copied: string;
  inviteExpires: (date: string) => string;
  inviteExpired: string;
  revokeInvite: string;
  noInvitations: string;

  joinTeam: string;
  joinHint: string;
  joinPlaceholder: string;
  joinCheck: string;
  joinInvitedTo: (team: string, role: string) => string;
  joinInvitedBy: (who: string) => string;
  joinAccept: string;

  renameTeam: string;
  rename: string;
  leaveTeam: string;
  leaveConfirm: (team: string) => string;
  deleteTeam: string;
  deleteTeamConfirm: (team: string) => string;

  sharedNotes: string;
  shareWithTeam: string;
  sharingNote: string;
  /** A team's space in the Library. */
  teamSpaceMeta: (count: number) => string;
  dropToShare: string;
  /** Asked before a note leaves this device for a team. */
  consentTitle: (team: string) => string;
  consentIntro: string;
  consentWhat: string;
  consentWho: (team: string) => string;
  consentWhere: string;
  consentUndo: string;
  consentPrivacy: string;
  consentDontAsk: string;
  consentShare: string;
  /** Where a new note goes, in the composer on the page. */
  destination: string;
  destDevice: string;
  destDeviceHint: string;
  destTeam: string;
  destTeamHint: string;
  destTeamLabel: string;
  destUploadHint: string;
  saveAndShare: string;
  /** Hamesh in Chrome's side panel. */
  panelShow: string;
  panelThisNote: string;
  panelWholePage: (count: number) => string;
  panelEmptyTitle: string;
  panelEmptyBody: string;
  panelNoneHere: string;
  shareFailedKept: (reason: string) => string;
  refreshNotes: string;
  syncedAgo: (when: string) => string;
  neverSynced: string;
  unshareNote: string;
  unshareConfirm: string;
  deleteSharedConfirm: string;
  openPage: string;

  teamFolders: string;
  deleteTeamFolderConfirm: (name: string) => string;

  comments: string;
  discuss: string;
  commentPlaceholder: string;
  /** The popup's own reply field: plain text, its mentions are in the full view. */
  quickReplyPlaceholder: string;
  openWholeDiscussion: (count: number) => string;
  postComment: string;
  replyTo: string;
  replyPlaceholder: string;
  postReply: string;
  deleteCommentConfirm: string;
  commentDeleted: string;
  commentEdited: string;
  commentedAgo: (when: string) => string;
  showReplies: (count: number) => string;
  formerMember: string;
  mentionNobody: string;
  mentionHint: string;

  mentionsTitle: string;
  mentionIn: (team: string) => string;
  openNote: string;
  moreMentions: string;
  manage: string;
  openInLibrary: string;
  whoIsIn: (team: string) => string;
  teamSettings: string;
  teamSettingsHint: string;
  seatsUsed: (count: number) => string;
  notesShared: (count: number) => string;

  emptyTeamsTitle: string;
  emptyTeamsBody: string;
  /** Founding a team is an owner's, and owners subscribe. */
  needsPlanTitle: string;
  needsPlanBody: string;
  seePlan: string;
  subscribeToCreate: string;
  atTeamLimit: (allowed: number) => string;
  emptyNotesTitle: (team: string) => string;
  emptyNotesBody: (team: string) => string;
  goToLibrary: string;
  emptyMentionsTitle: string;
  emptyMentionsBody: string;
  emptyCommentsTitle: string;
  emptyCommentsBody: string;

  filterEverything: string;
  filterMine: string;
  openInTeams: string;
  teamNoteHint: string;
  /** The chip that says the Library is narrowed to one folder, and its way out. */
  clearFolderFilter: (folder: string) => string;
  /** Said when a team, or one of its folders, has no notes to show in the Library. */
  filterEmptyTitle: string;
  filterEmptyBody: string;
  filterShowAll: string;
  /** A folder nested in another, named by where it sits. */
  folderIn: (parent: string) => string;
  /** The Teams pages' trail back to where the reader came from. */
  breadcrumb: string;
  whoIsInIt: string;
  noteGoneTitle: string;
  noteGoneBody: string;
  backToTeam: (team: string) => string;

  plan: string;
  planActive: (until: string) => string;
  planNone: string;
  planPending: string;
  planExpired: string;
  planCanceled: string;
  price: (amount: string, days: number) => string;
  payWith: string;
  methodInstapay: string;
  methodVodafoneCash: string;
  /** How many periods are paid for — months, when a period is a month. */
  periodsLabel: (days: number) => string;
  periodsCount: (count: number, days: number) => string;
  fewerPeriods: string;
  morePeriods: string;
  total: (amount: string, count: string) => string;
  howToPay: string;
  payStepSend: (amount: string, method: string) => string;
  payStepConfirm: string;
  payStepReference: string;
  paymentsClosed: string;
  copyNumber: string;
  referenceLabel: string;
  referencePlaceholder: string;
  /** Agreeing to the terms on a first payment; later ones are made under them. */
  termsAgreeLead: string;
  termsNoticeLead: string;
  termsOfUse: string;
  privacyPolicy: string;
  termsAnd: string;
  submitPayment: string;
  paymentSubmitted: string;
  paymentHistory: string;
  noPayments: string;
  paymentStatus: (status: 'pending' | 'approved' | 'rejected' | 'refunded') => string;
  paymentLine: (amount: string, date: string) => string;

  error: (code: TeamsErrorCode) => string;

  // Settings → Teams: the account, and turning Teams on and off.
  mentions: string;
  intro: string;
  turnOn: string;
  turnOnHint: string;
  turnOff: string;
  permissionDenied: string;
  signIn: string;
  signInHint: string;
  signOut: string;
  checking: string;
  account: string;
  memberOf: (n: number) => string;
}

/** "شهر", "شهران", "3 أشهر", "11 شهرًا" — Arabic counts its months in four forms. */
function arabicMonths(n: number): string {
  if (n === 1) return 'شهر واحد';
  if (n === 2) return 'شهران';
  if (n >= 3 && n <= 10) return `${n} أشهر`;
  return `${n} شهرًا`;
}

const en: TeamsOwnStrings = {
  teams: 'Teams',
  tagline: 'Notes you keep together',
  composeHint: 'Enter sends · Shift+Enter starts a new line',
  yourTeams: 'Your teams',
  createTeam: 'Create a team',
  teamNamePlaceholder: 'Team name…',
  signedOutTitle: 'Teams is off',
  signedOutBody: 'Turn on Teams and sign in from Settings to share notes with your team.',
  goToSettings: 'Open Settings',

  role: (role) => ({ owner: 'Owner', admin: 'Admin', member: 'Member' })[role],
  stateReadOnly: (until) => `Read-only until ${until}`,
  stateReadOnlyNoDate: 'Read-only',
  stateLocked: 'Locked',

  members: 'Members',
  memberSince: (date) => `Joined ${date}`,
  makeAdmin: 'Make admin',
  makeMember: 'Make member',
  removeMember: 'Remove',
  removeMemberConfirm: (name) => `Remove ${name} from this team?`,
  transferOwnership: 'Make owner',
  transferConfirm: (name) =>
    `Hand this team over to ${name}? You become an admin, and this can't be undone by you alone.`,
  youMarker: 'you',

  invitations: 'Invitations',
  inviteSomeone: 'Invite someone',
  inviteEmailPlaceholder: 'Their email…',
  inviteAsMember: 'As member',
  inviteAsAdmin: 'As admin',
  sendInvite: 'Create invite link',
  inviteLinkReady: 'Here is the link — it is shown once.',
  inviteLinkHint: 'Send it to them yourself. Hamesh sends no email.',
  copyLink: 'Copy link',
  copied: 'Copied',
  inviteExpires: (date) => `Expires ${date}`,
  inviteExpired: 'Expired',
  revokeInvite: 'Revoke',
  noInvitations: 'No open invitations.',

  joinTeam: 'Join a team',
  joinHint: 'Paste the invite link someone sent you.',
  joinPlaceholder: 'Invite link…',
  joinCheck: 'Check link',
  joinInvitedTo: (team, role) => `You have been invited to ${team} as ${role}.`,
  joinInvitedBy: (who) => `Invited by ${who}.`,
  joinAccept: 'Join',
  renameTeam: 'Team name',
  rename: 'Rename',
  leaveTeam: 'Leave team',
  leaveConfirm: (team) => `Leave ${team}? You lose access to its notes.`,
  deleteTeam: 'Delete team',
  deleteTeamConfirm: (team) => `Delete ${team} and everything in it? This cannot be undone.`,
  sharedNotes: 'Shared notes',
  shareWithTeam: 'Share with team',
  sharingNote: 'Sharing…',
  teamSpaceMeta: (count) => `Shared on the server · ${count === 1 ? '1 note' : `${count} notes`}`,
  dropToShare: 'Drop to share with the team',
  consentTitle: (team) => `Share this note with ${team}?`,
  consentIntro:
    'Your own notes never leave this device. Sharing this one uploads it to Hamesh’s servers so the team can see it.',
  consentWhat:
    'What goes up: the note’s text, the page’s address and title, and where on the page it sits.',
  consentWho: (team) =>
    `Every member of ${team} can see it, and may keep a copy on their own devices.`,
  consentWhere:
    'It is stored on Cloudflare’s servers, which may be outside Egypt. Sharing means you agree to it being moved there for this.',
  consentUndo: 'You can stop sharing it later, and it comes back to this device.',
  consentPrivacy: 'Read the Privacy Policy',
  consentDontAsk: 'Don’t show this again when I share',
  consentShare: 'Share',
  destination: 'Where it goes',
  destDevice: 'On my device',
  destDeviceHint: 'Never leaves this device',
  destTeam: 'In a team',
  destTeamHint: 'Its members see it',
  destTeamLabel: 'Team',
  destUploadHint: 'It is uploaded to Hamesh’s servers when you save it.',
  saveAndShare: 'Save and share',
  panelShow: 'Show',
  panelThisNote: 'This note',
  panelWholePage: (count) => `Whole page (${count})`,
  panelEmptyTitle: 'Nothing open here',
  panelEmptyBody: 'Open a shared note’s discussion from its popup on the page.',
  panelNoneHere: 'No shared notes on this page',
  shareFailedKept: (reason) => `Saved on this device, but not shared: ${reason}`,
  refreshNotes: 'Check for changes',
  syncedAgo: (when) => `Up to date as of ${when}`,
  neverSynced: 'Not loaded on this device yet',
  unshareNote: 'Stop sharing',
  unshareConfirm: 'Take this note out of the team? It stays yours, on your device.',
  deleteSharedConfirm: 'Delete this note for everyone in the team?',
  openPage: 'Open the page',

  teamFolders: 'Folders',
  deleteTeamFolderConfirm: (name) => `Delete ${name}? The notes in it stay, unfiled.`,
  comments: 'Comments',
  discuss: 'Discuss',
  commentPlaceholder: 'Say something… type @ to name someone',
  quickReplyPlaceholder: 'Write a reply…',
  openWholeDiscussion: (count) =>
    count === 0 ? 'Open the discussion' : `Open the whole discussion (${count})`,
  postComment: 'Comment',
  replyTo: 'Reply',
  replyPlaceholder: 'Write a reply…',
  postReply: 'Send the reply',
  deleteCommentConfirm: 'Delete this comment?',
  commentDeleted: 'This comment was deleted.',
  commentEdited: 'edited',
  commentedAgo: (when) => `Said ${when}`,
  showReplies: (count) => (count === 1 ? 'Show the reply' : `Show all ${count} replies`),
  formerMember: 'someone who has left',
  mentionNobody: 'Nobody in this team by that name.',
  mentionHint:
    'Only people in this team can be named, and they are named by who they are — so a change of name reaches every comment at once.',

  mentionsTitle: 'Where you were named',
  mentionIn: (team) => `in ${team}`,
  openNote: 'Open the page',
  moreMentions: 'Show older',

  manage: 'Manage',
  openInLibrary: 'Open in the Library',
  whoIsIn: (team) => `Who\u2019s in ${team}`,
  teamSettings: 'Team settings',
  teamSettingsHint: 'rename, hand over, leave, delete',
  seatsUsed: (count) => (count === 1 ? '1 member' : `${count} members`),
  notesShared: (count) => (count === 1 ? '1 note' : `${count} notes`),

  emptyTeamsTitle: 'No teams yet',
  emptyTeamsBody:
    'A team is a place to put notes everyone can see. Make one, or join with a link somebody sent you.',
  needsPlanTitle: 'Creating a team needs a subscription',
  needsPlanBody:
    'The person who creates a team subscribes; the people they invite do not. You can still join a team with a link someone sent you.',
  seePlan: 'See the plan',
  subscribeToCreate: 'Subscribe to create a team',
  atTeamLimit: (allowed) =>
    `Your plan allows ${allowed} ${allowed === 1 ? 'team' : 'teams'} of your own, and you have them all.`,
  emptyNotesTitle: (team) => `Nothing in ${team} yet`,
  emptyNotesBody: (team) =>
    `Open a note in your Library and choose ${team}. It will appear on the page it belongs to, for everyone here.`,
  goToLibrary: 'Go to the Library',
  emptyMentionsTitle: 'Nobody has named you yet',
  emptyMentionsBody:
    'When someone types @ and picks you in a comment, it turns up here \u2014 whichever team it was in.',
  emptyCommentsTitle: 'Nothing said about this one yet',
  emptyCommentsBody: 'Start it off. Type @ to bring someone in.',

  filterEverything: 'Everything',
  filterMine: 'Only mine',
  openInTeams: 'Open in Teams',
  teamNoteHint:
    'This one lives in a team. It is read where it is, and changed from the team it belongs to.',
  clearFolderFilter: (folder) => `Show all of the team’s notes, not only ${folder}`,
  filterEmptyTitle: 'Nothing here yet',
  filterEmptyBody: 'No notes match this filter. Show everything to see the rest.',
  filterShowAll: 'Show everything',
  folderIn: (parent) => `in ${parent}`,
  breadcrumb: 'Breadcrumb',
  whoIsInIt: 'Who’s in it',
  noteGoneTitle: 'This note is no longer here',
  noteGoneBody: 'It was taken back, or deleted for everyone.',
  backToTeam: (team) => `Back to ${team}`,

  plan: 'Plan',
  planActive: (until) => `Active until ${until}`,
  planNone: 'No plan',
  planPending: 'Waiting for your payment to be checked',
  planExpired: 'Expired',
  planCanceled: 'Cancelled — the paid period is still yours',
  price: (amount, days) => (days === 30 ? `${amount} a month` : `${amount} every ${days} days`),
  payWith: 'Pay with',
  methodInstapay: 'InstaPay',
  methodVodafoneCash: 'Vodafone Cash',
  periodsLabel: (days) => (days === 30 ? 'Months' : `Periods of ${days} days`),
  periodsCount: (count, days) =>
    days === 30
      ? `${count} ${count === 1 ? 'month' : 'months'}`
      : `${count} ${count === 1 ? 'period' : 'periods'}`,
  fewerPeriods: 'One less',
  morePeriods: 'One more',
  total: (amount, count) => `Total: ${amount} for ${count}`,
  howToPay: 'How to pay',
  payStepSend: (amount, method) => `Send ${amount} by ${method} to`,
  payStepConfirm: 'Send a screenshot of the transfer on WhatsApp to',
  payStepReference:
    'Enter the transaction reference below and submit. Your subscription starts once the payment has been checked.',
  paymentsClosed: 'Payments are not open right now.',
  copyNumber: 'Copy',
  referenceLabel: 'Transaction reference',
  referencePlaceholder: 'Transaction reference…',
  termsAgreeLead: 'I have read and agree to the',
  termsNoticeLead: 'Payments are made under the',
  termsOfUse: 'Terms of Use',
  privacyPolicy: 'Privacy Policy',
  termsAnd: 'and the',
  submitPayment: 'Submit payment',
  paymentSubmitted: 'Submitted. You will see it below once it has been checked.',
  paymentHistory: 'Payments',
  noPayments: 'No payments yet.',
  paymentStatus: (status) =>
    ({
      pending: 'Being checked',
      approved: 'Approved',
      rejected: 'Rejected',
      refunded: 'Refunded',
    })[status],
  paymentLine: (amount, date) => `${amount} · ${date}`,

  error: (code) => {
    switch (code) {
      case 'network':
      case 'unavailable':
        return "Couldn't reach Hamesh Teams. Check your connection and try again.";
      case 'cancelled':
        return 'Sign-in was cancelled.';
      case 'account_disabled':
        return 'This account has been disabled.';
      case 'signed_out':
      case 'unauthenticated':
        return 'You were signed out. Sign in again from Settings.';
      case 'permission_missing':
        return 'Teams needs its permissions. Turn it on again in Settings.';
      case 'forbidden':
        return "You don't have permission to do that.";
      case 'not_found':
        return "That isn't there any more.";
      case 'subscription_required':
        return 'That needs an active plan.';
      case 'team_not_entitled':
        return "This team's plan has lapsed.";
      case 'team_locked':
        return 'This team is locked until its plan is renewed.';
      case 'limit_reached':
        return "That would go past your plan's limit.";
      case 'already_member':
        return 'They are already in this team.';
      case 'owner_must_transfer':
        return 'Hand the team to someone else, or delete it, before leaving.';
      case 'invitation_expired':
        return 'That invitation has expired.';
      case 'invitation_revoked':
        return 'That invitation was revoked.';
      case 'invitation_used':
        return 'That invitation has already been used.';
      case 'rate_limited':
        return 'Too many attempts. Try again in a minute.';
      case 'invalid_request':
        return "That doesn't look right. Check what you typed.";
      case 'conflict':
      case 'version_conflict':
        return 'Someone changed this first. Try again.';
      default:
        return 'Something went wrong. Try again.';
    }
  },

  mentions: 'Mentions',
  intro:
    'Share notes with the people you work with. Your personal notes stay on this device either way.',
  turnOn: 'Turn on Teams',
  turnOnHint:
    'Hamesh will ask to reach its Teams server and to open Google sign-in. Nothing is sent until you sign in.',
  turnOff: 'Turn off Teams',
  permissionDenied: "Permission wasn't granted, so Teams stays off.",
  signIn: 'Sign in with Google',
  signInHint: 'Your Google name and email identify you to your teammates.',
  signOut: 'Sign out',
  checking: 'Checking…',
  account: 'Account',
  memberOf: (n) =>
    n === 0 ? 'Not in a team yet' : n === 1 ? 'Member of 1 team' : `Member of ${n} teams`,
};

const ar: TeamsOwnStrings = {
  teams: 'الفرق',
  tagline: 'ملاحظات تحتفظون بها معًا',
  composeHint: 'Enter للإرسال · Shift+Enter لسطر جديد',
  yourTeams: 'فرقك',
  createTeam: 'إنشاء فريق',
  teamNamePlaceholder: 'اسم الفريق…',
  signedOutTitle: 'الفرق متوقفة',
  signedOutBody: 'فعّل الفرق وسجّل دخولك من الإعدادات لمشاركة الملاحظات مع فريقك.',
  goToSettings: 'فتح الإعدادات',

  role: (role) => ({ owner: 'المالك', admin: 'مشرف', member: 'عضو' })[role],
  stateReadOnly: (until) => `للقراءة فقط حتى ${until}`,
  stateReadOnlyNoDate: 'للقراءة فقط',
  stateLocked: 'مقفل',

  members: 'الأعضاء',
  memberSince: (date) => `انضم في ${date}`,
  makeAdmin: 'ترقية إلى مشرف',
  makeMember: 'إعادة إلى عضو',
  removeMember: 'إزالة',
  removeMemberConfirm: (name) => `إزالة ${name} من هذا الفريق؟`,
  transferOwnership: 'نقل الملكية',
  transferConfirm: (name) =>
    `تسليم الفريق إلى ${name}؟ ستصبح مشرفًا، ولا يمكنك التراجع عن هذا وحدك.`,
  youMarker: 'أنت',

  invitations: 'الدعوات',
  inviteSomeone: 'دعوة شخص',
  inviteEmailPlaceholder: 'بريده الإلكتروني…',
  inviteAsMember: 'كعضو',
  inviteAsAdmin: 'كمشرف',
  sendInvite: 'إنشاء رابط دعوة',
  inviteLinkReady: 'هذا هو الرابط — يظهر مرة واحدة فقط.',
  inviteLinkHint: 'أرسله إليه بنفسك. هامش لا يرسل أي بريد.',
  copyLink: 'نسخ الرابط',
  copied: 'نُسخ',
  inviteExpires: (date) => `ينتهي في ${date}`,
  inviteExpired: 'منتهية',
  revokeInvite: 'إلغاء',
  noInvitations: 'لا توجد دعوات مفتوحة.',

  joinTeam: 'الانضمام إلى فريق',
  joinHint: 'الصق رابط الدعوة الذي أرسله لك أحدهم.',
  joinPlaceholder: 'رابط الدعوة…',
  joinCheck: 'فحص الرابط',
  joinInvitedTo: (team, role) => `أنت مدعو إلى ${team} بصفة ${role}.`,
  joinInvitedBy: (who) => `الدعوة من ${who}.`,
  joinAccept: 'انضمام',
  renameTeam: 'اسم الفريق',
  rename: 'إعادة تسمية',
  leaveTeam: 'مغادرة الفريق',
  leaveConfirm: (team) => `مغادرة ${team}؟ ستفقد الوصول إلى ملاحظاته.`,
  deleteTeam: 'حذف الفريق',
  deleteTeamConfirm: (team) => `حذف ${team} وكل ما فيه؟ لا يمكن التراجع عن هذا.`,
  sharedNotes: 'الملاحظات المشتركة',
  shareWithTeam: 'مشاركة مع فريق',
  sharingNote: 'جارٍ المشاركة…',
  teamSpaceMeta: (count) => `مشتركة على الخادم · ${count} ${count === 1 ? 'ملاحظة' : 'ملاحظات'}`,
  dropToShare: 'أفلت للمشاركة مع الفريق',
  consentTitle: (team) => `مشاركة الملاحظة مع ${team}؟`,
  consentIntro:
    'ملاحظاتك الشخصية لا تغادر جهازك. مشاركة هذه الملاحظة ترفعها إلى خوادم هامش ليراها أعضاء الفريق.',
  consentWhat: 'يُرفع نص الملاحظة، ورابط الصفحة وعنوانها، وموضعها فيها.',
  consentWho: (team) => `يراها كل أعضاء ${team}، وقد يحتفظون بنسخة منها على أجهزتهم.`,
  consentWhere:
    'تُخزَّن على خوادم Cloudflare، وقد تكون خارج مصر. بمشاركتك توافق على نقلها لهذا الغرض.',
  consentUndo: 'يمكنك إيقاف مشاركتها لاحقًا فتعود إلى جهازك.',
  consentPrivacy: 'اقرأ سياسة الخصوصية',
  consentDontAsk: 'لا تُظهر هذه الرسالة مرة أخرى عند المشاركة',
  consentShare: 'مشاركة',
  destination: 'أين تحفظها؟',
  destDevice: 'على جهازي',
  destDeviceHint: 'لا تغادر هذا الجهاز',
  destTeam: 'في فريق',
  destTeamHint: 'يراها أعضاؤه',
  destTeamLabel: 'الفريق',
  destUploadHint: 'تُرفع إلى خوادم هامش عند الحفظ.',
  saveAndShare: 'حفظ ومشاركة',
  panelShow: 'عرض',
  panelThisNote: 'هذه الملحوظة',
  panelWholePage: (count) => `كل الصفحة (${count})`,
  panelEmptyTitle: 'لا شيء مفتوح هنا',
  panelEmptyBody: 'افتح محادثة ملحوظة مشتركة من نافذتها على الصفحة.',
  panelNoneHere: 'لا توجد ملحوظات مشتركة على هذه الصفحة',
  shareFailedKept: (reason) => `حُفظت على جهازك، لكن لم تُشارك: ${reason}`,
  refreshNotes: 'تحقق من التغييرات',
  syncedAgo: (when) => `محدَّثة حتى ${when}`,
  neverSynced: 'لم تُحمَّل على هذا الجهاز بعد',
  unshareNote: 'إيقاف المشاركة',
  unshareConfirm: 'إخراج هذه الملاحظة من الفريق؟ تبقى لك على جهازك.',
  deleteSharedConfirm: 'حذف هذه الملاحظة لكل من في الفريق؟',
  openPage: 'فتح الصفحة',

  teamFolders: 'المجلدات',
  deleteTeamFolderConfirm: (name) => `حذف ${name}؟ الملاحظات التي فيه تبقى، دون مجلد.`,
  comments: 'التعليقات',
  discuss: 'مناقشة',
  commentPlaceholder: 'قل شيئًا… اكتب @ لذكر أحدهم',
  quickReplyPlaceholder: 'اكتب ردًا…',
  openWholeDiscussion: (count) =>
    count === 0 ? 'افتح المحادثة' : `افتح المحادثة كاملة (${count})`,
  postComment: 'تعليق',
  replyTo: 'رد',
  replyPlaceholder: 'اكتب ردًا…',
  postReply: 'إرسال الرد',
  deleteCommentConfirm: 'حذف هذا التعليق؟',
  commentDeleted: 'حُذِف هذا التعليق.',
  commentEdited: 'مُعدّل',
  commentedAgo: (when) => `قاله ${when}`,
  showReplies: (count) => (count === 1 ? 'عرض الرد' : `عرض الردود الـ ${count}`),
  formerMember: 'عضو غادر الفريق',
  mentionNobody: 'لا أحد في هذا الفريق بهذا الاسم.',
  mentionHint:
    'يُذكر أعضاء هذا الفريق وحدهم، ويُذكرون بمن هم — فتغيير الاسم يصل إلى كل التعليقات دفعة واحدة.',

  mentionsTitle: 'حيث ذُكِرت',
  mentionIn: (team) => `في ${team}`,
  openNote: 'فتح الصفحة',
  moreMentions: 'عرض الأقدم',

  manage: '\u0625\u062f\u0627\u0631\u0629',
  openInLibrary: '\u0641\u062a\u062d \u0641\u064a \u0627\u0644\u0645\u0643\u062a\u0628\u0629',
  whoIsIn: (team) => `\u0645\u0646 \u0641\u064a ${team}`,
  teamSettings: '\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0641\u0631\u064a\u0642',
  teamSettingsHint:
    '\u0625\u0639\u0627\u062f\u0629 \u062a\u0633\u0645\u064a\u0629\u060c \u062a\u0633\u0644\u064a\u0645\u060c \u0645\u063a\u0627\u062f\u0631\u0629\u060c \u062d\u0630\u0641',
  seatsUsed: (count) =>
    count === 1
      ? '\u0639\u0636\u0648 \u0648\u0627\u062d\u062f'
      : `${count} \u0623\u0639\u0636\u0627\u0621`,
  notesShared: (count) =>
    count === 1
      ? '\u0645\u0644\u0627\u062d\u0638\u0629 \u0648\u0627\u062d\u062f\u0629'
      : `${count} \u0645\u0644\u0627\u062d\u0638\u0629`,

  emptyTeamsTitle: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0641\u0631\u0642 \u0628\u0639\u062f',
  emptyTeamsBody:
    '\u0627\u0644\u0641\u0631\u064a\u0642 \u0645\u0643\u0627\u0646 \u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u064a\u0631\u0627\u0647\u0627 \u0627\u0644\u062c\u0645\u064a\u0639. \u0623\u0646\u0634\u0626 \u0648\u0627\u062d\u062f\u064b\u0627\u060c \u0623\u0648 \u0627\u0646\u0636\u0645 \u0628\u0631\u0627\u0628\u0637 \u0623\u0631\u0633\u0644\u0647 \u0644\u0643 \u0623\u062d\u062f\u0647\u0645.',
  needsPlanTitle: 'إنشاء فريق يحتاج اشتراكًا',
  needsPlanBody:
    'الاشتراك على من ينشئ الفريق، ولا يحتاجه من يدعوهم. وما زال بإمكانك الانضمام إلى فريق برابط أرسله لك أحد.',
  seePlan: 'عرض الخطة',
  subscribeToCreate: 'اشترك لتنشئ فريقًا',
  atTeamLimit: (allowed) =>
    `خطتك تسمح بـ${allowed} ${allowed <= 10 && allowed >= 3 ? 'فرق' : 'فريق'} خاصة بك، وقد أنشأتها كلها.`,
  emptyNotesTitle: (team) =>
    `\u0644\u0627 \u0634\u064a\u0621 \u0641\u064a ${team} \u0628\u0639\u062f`,
  emptyNotesBody: (team) =>
    `\u0627\u0641\u062a\u062d \u0645\u0644\u0627\u062d\u0638\u0629 \u0641\u064a \u0645\u0643\u062a\u0628\u062a\u0643 \u0648\u0627\u062e\u062a\u0631 ${team}\u060c \u0641\u062a\u0638\u0647\u0631 \u0639\u0644\u0649 \u0635\u0641\u062d\u062a\u0647\u0627 \u0644\u0643\u0644 \u0645\u0646 \u0647\u0646\u0627.`,
  goToLibrary:
    '\u0627\u0644\u0630\u0647\u0627\u0628 \u0625\u0644\u0649 \u0627\u0644\u0645\u0643\u062a\u0628\u0629',
  emptyMentionsTitle:
    '\u0644\u0645 \u064a\u0630\u0643\u0631\u0643 \u0623\u062d\u062f \u0628\u0639\u062f',
  emptyMentionsBody:
    '\u062d\u064a\u0646 \u064a\u0643\u062a\u0628 \u0623\u062d\u062f\u0647\u0645 @ \u0648\u064a\u062e\u062a\u0627\u0631\u0643 \u0641\u064a \u062a\u0639\u0644\u064a\u0642\u060c \u064a\u0638\u0647\u0631 \u0647\u0646\u0627 \u2014 \u0645\u0647\u0645\u0627 \u0643\u0627\u0646 \u0627\u0644\u0641\u0631\u064a\u0642.',
  emptyCommentsTitle:
    '\u0644\u0627 \u0634\u064a\u0621 \u0639\u0646 \u0647\u0630\u0647 \u0628\u0639\u062f',
  emptyCommentsBody:
    '\u0627\u0628\u062f\u0623 \u0623\u0646\u062a. \u0627\u0643\u062a\u0628 @ \u0644\u062a\u0636\u0645\u0651 \u0623\u062d\u062f\u0647\u0645.',

  filterEverything: '\u0627\u0644\u0643\u0644',
  filterMine: '\u0644\u064a \u0648\u062d\u062f\u064a',
  openInTeams: '\u0641\u062a\u062d \u0641\u064a \u0627\u0644\u0641\u0631\u0642',
  clearFolderFilter: (folder) =>
    `\u0639\u0631\u0636 \u0643\u0644 \u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u0644\u0641\u0631\u064a\u0642\u060c \u0644\u0627 ${folder} \u0641\u0642\u0637`,
  filterEmptyTitle: '\u0644\u0627 \u0634\u064a\u0621 \u0647\u0646\u0627 \u0628\u0639\u062f',
  filterEmptyBody:
    '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0644\u0627\u062d\u0638\u0627\u062a \u062a\u0637\u0627\u0628\u0642 \u0647\u0630\u0627 \u0627\u0644\u0641\u0644\u062a\u0631. \u0627\u0639\u0631\u0636 \u0627\u0644\u0643\u0644 \u0644\u062a\u0631\u0649 \u0627\u0644\u0628\u0627\u0642\u064a.',
  filterShowAll: '\u0639\u0631\u0636 \u0627\u0644\u0643\u0644',
  folderIn: (parent) => `\u062f\u0627\u062e\u0644 ${parent}`,
  breadcrumb: '\u0645\u0633\u0627\u0631 \u0627\u0644\u062a\u0646\u0642\u0644',
  whoIsInIt: '\u0645\u0646 \u0641\u064a\u0647',
  noteGoneTitle:
    '\u0647\u0630\u0647 \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0629 \u0644\u0645 \u062a\u0639\u062f \u0647\u0646\u0627',
  noteGoneBody:
    '\u0627\u0633\u062a\u064f\u0639\u064a\u062f\u062a\u060c \u0623\u0648 \u062d\u064f\u0630\u0641\u062a \u0644\u0644\u062c\u0645\u064a\u0639.',
  backToTeam: (team) => `\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 ${team}`,
  teamNoteHint:
    '\u0647\u0630\u0647 \u062a\u0639\u064a\u0634 \u0641\u064a \u0641\u0631\u064a\u0642. \u062a\u064f\u0642\u0631\u0623 \u0641\u064a \u0645\u0643\u0627\u0646\u0647\u0627\u060c \u0648\u062a\u064f\u063a\u064a\u0651\u0631 \u0645\u0646 \u0627\u0644\u0641\u0631\u064a\u0642 \u0627\u0644\u0630\u064a \u062a\u062e\u0635\u0651\u0647.',

  plan: 'الاشتراك',
  planActive: (until) => `فعّال حتى ${until}`,
  planNone: 'لا يوجد اشتراك',
  planPending: 'في انتظار مراجعة دفعتك',
  planExpired: 'منتهٍ',
  planCanceled: 'مُلغى — المدة المدفوعة تبقى لك',
  price: (amount, days) => (days === 30 ? `${amount} شهريًا` : `${amount} كل ${days} يومًا`),
  payWith: 'ادفع عبر',
  methodInstapay: 'إنستا باي',
  methodVodafoneCash: 'فودافون كاش',
  periodsLabel: (days) => (days === 30 ? 'عدد الشهور' : `عدد المدد (${days} يومًا)`),
  periodsCount: (count, days) => (days === 30 ? arabicMonths(count) : `${count} × ${days} يومًا`),
  fewerPeriods: 'أقل بواحد',
  morePeriods: 'أكثر بواحد',
  total: (amount, count) => `الإجمالي: ${amount} عن ${count}`,
  howToPay: 'طريقة الدفع',
  payStepSend: (amount, method) => `حوّل ${amount} عبر ${method} إلى`,
  payStepConfirm: 'أرسل صورة التحويل على واتساب إلى',
  payStepReference: 'اكتب رقم العملية بالأسفل وأرسله. يبدأ اشتراكك بعد مراجعة الدفعة.',
  paymentsClosed: 'الدفع غير متاح حاليًا.',
  copyNumber: 'نسخ',
  referenceLabel: 'رقم العملية',
  referencePlaceholder: 'رقم العملية…',
  termsAgreeLead: 'قرأت وأوافق على',
  termsNoticeLead: 'الدفع يتم وفق',
  termsOfUse: 'شروط الاستخدام',
  privacyPolicy: 'سياسة الخصوصية',
  termsAnd: 'و',
  submitPayment: 'إرسال الدفعة',
  paymentSubmitted: 'أُرسلت. ستظهر بالأسفل بعد مراجعتها.',
  paymentHistory: 'المدفوعات',
  noPayments: 'لا توجد مدفوعات بعد.',
  paymentStatus: (status) =>
    ({
      pending: 'قيد المراجعة',
      approved: 'مقبولة',
      rejected: 'مرفوضة',
      refunded: 'مُستردة',
    })[status],
  paymentLine: (amount, date) => `${amount} · ${date}`,

  error: (code) => {
    switch (code) {
      case 'network':
      case 'unavailable':
        return 'تعذّر الوصول إلى خادم الفرق. تحقّق من اتصالك وحاول مرة أخرى.';
      case 'cancelled':
        return 'أُلغي تسجيل الدخول.';
      case 'account_disabled':
        return 'هذا الحساب معطّل.';
      case 'signed_out':
      case 'unauthenticated':
        return 'انتهت جلستك. سجّل دخولك مرة أخرى من الإعدادات.';
      case 'permission_missing':
        return 'تحتاج الفرق إلى أذوناتها. فعّلها مرة أخرى من الإعدادات.';
      case 'forbidden':
        return 'ليس لديك صلاحية لفعل ذلك.';
      case 'not_found':
        return 'لم يعد هذا موجودًا.';
      case 'subscription_required':
        return 'هذا يحتاج إلى اشتراك فعّال.';
      case 'team_not_entitled':
        return 'انتهى اشتراك هذا الفريق.';
      case 'team_locked':
        return 'هذا الفريق مقفل حتى يُجدَّد اشتراكه.';
      case 'limit_reached':
        return 'هذا يتجاوز حد اشتراكك.';
      case 'already_member':
        return 'هو بالفعل في هذا الفريق.';
      case 'owner_must_transfer':
        return 'انقل ملكية الفريق إلى شخص آخر، أو احذفه، قبل المغادرة.';
      case 'invitation_expired':
        return 'انتهت صلاحية هذه الدعوة.';
      case 'invitation_revoked':
        return 'أُلغيت هذه الدعوة.';
      case 'invitation_used':
        return 'استُخدمت هذه الدعوة من قبل.';
      case 'rate_limited':
        return 'محاولات كثيرة. حاول مرة أخرى بعد دقيقة.';
      case 'invalid_request':
        return 'يبدو أن هناك خطأ فيما كتبت. راجعه.';
      case 'conflict':
      case 'version_conflict':
        return 'غيّر أحدهم هذا قبلك. حاول مرة أخرى.';
      default:
        return 'حدث خطأ ما. حاول مرة أخرى.';
    }
  },

  mentions: 'الإشارات',
  intro: 'شارك الملاحظات مع من تعمل معهم. ملاحظاتك الشخصية تبقى على جهازك في كل الأحوال.',
  turnOn: 'تفعيل الفرق',
  turnOnHint:
    'سيطلب هامش إذنًا بالاتصال بخادم الفرق وفتح تسجيل الدخول بحساب Google. لا يُرسل أي شيء قبل أن تسجّل دخولك.',
  turnOff: 'إيقاف الفرق',
  permissionDenied: 'لم يُمنح الإذن، لذا تبقى الفرق متوقفة.',
  signIn: 'تسجيل الدخول بحساب Google',
  signInHint: 'اسمك وبريدك في Google يعرّفان بك لزملائك في الفريق.',
  signOut: 'تسجيل الخروج',
  checking: 'جارٍ التحقق…',
  account: 'الحساب',
  memberOf: (n) =>
    n === 0
      ? 'لست في أي فريق بعد'
      : n === 1
        ? 'عضو في فريق واحد'
        : n === 2
          ? 'عضو في فريقين'
          : n <= 10
            ? `عضو في ${n} فرق`
            : `عضو في ${n} فريقًا`,
};

const composed: Partial<Record<Lang, TeamsStrings>> = {};

/** The Teams table in `lang` — the same object on every call, so it is safe in a
 *  dependency list. */
export function getTeamsStrings(lang: Lang): TeamsStrings {
  const cached = composed[lang];
  if (cached) return cached;
  const core = getStrings(lang);
  const shared = Object.fromEntries(SHARED.map((key) => [key, core[key]])) as SharedStrings;
  return (composed[lang] = { ...shared, ...(lang === 'ar' ? ar : en) });
}
