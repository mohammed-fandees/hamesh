import type { Lang } from '../i18n';
import type { TeamsErrorCode } from '@/teams/errors';

/**
 * Wording for the Teams page, kept beside it rather than in the shared
 * `i18n.ts`: Teams is optional, and a build without it should not carry a page
 * worth of text it will never show.
 *
 * Nothing here states a price, a limit, or what a role may do — those come
 * from the server, and the page prints what it is given.
 */
export interface TeamsStrings {
  teams: string;
  yourTeams: string;
  noTeams: string;
  createTeam: string;
  teamNamePlaceholder: string;
  create: string;
  cancel: string;
  working: string;
  retry: string;
  signedOutTitle: string;
  signedOutBody: string;
  goToSettings: string;

  role: (role: 'owner' | 'admin' | 'member') => string;
  stateActive: string;
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
  joinedTeam: (team: string) => string;

  renameTeam: string;
  rename: string;
  leaveTeam: string;
  leaveConfirm: (team: string) => string;
  deleteTeam: string;
  deleteConfirm: (team: string) => string;
  dangerZone: string;

  sharedNotes: string;
  sharedNotesHint: string;
  noSharedNotes: string;
  shareWithTeam: string;
  sharingNote: string;
  noteShared: (team: string) => string;
  refreshNotes: string;
  syncedAgo: (when: string) => string;
  neverSynced: string;
  noteEdited: (when: string) => string;
  editNote: string;
  saveNote: string;
  unshareNote: string;
  unshareConfirm: string;
  deleteSharedNote: string;
  deleteSharedConfirm: string;
  openPage: string;

  teamFolders: string;
  newTeamFolder: string;
  folderNamePlaceholder: string;
  renameFolder: string;
  deleteFolder: string;
  deleteFolderConfirm: (name: string) => string;
  noTeamFolders: string;
  unfiled: string;
  moveToFolder: string;
  noFolderOption: string;

  comments: string;
  discuss: string;
  hideComments: string;
  noComments: string;
  commentPlaceholder: string;
  postComment: string;
  replyTo: string;
  replyPlaceholder: string;
  postReply: string;
  editComment: string;
  saveComment: string;
  deleteComment: string;
  deleteCommentConfirm: string;
  commentDeleted: string;
  commentEdited: string;
  commentedAgo: (when: string) => string;
  showReplies: (count: number) => string;
  moreComments: string;
  formerMember: string;
  mentionNobody: string;
  mentionHint: string;

  mentions: string;
  noMentions: string;
  mentionIn: (team: string) => string;
  openNote: string;
  moreMentions: string;

  billing: string;
  planActive: (until: string) => string;
  planNone: string;
  planPending: string;
  planExpired: string;
  planCanceled: string;
  price: (amount: string, days: number) => string;
  payWith: string;
  methodInstapay: string;
  methodVodafoneCash: string;
  periods: string;
  referencePlaceholder: string;
  referenceHint: string;
  submitPayment: string;
  paymentSubmitted: string;
  paymentHistory: string;
  noPayments: string;
  paymentStatus: (status: 'pending' | 'approved' | 'rejected' | 'refunded') => string;
  paymentLine: (amount: string, date: string) => string;

  error: (code: TeamsErrorCode) => string;
}

const en: TeamsStrings = {
  teams: 'Teams',
  yourTeams: 'Your teams',
  noTeams: "You're not in a team yet. Create one, or join with an invite link.",
  createTeam: 'Create a team',
  teamNamePlaceholder: 'Team name…',
  create: 'Create',
  cancel: 'Cancel',
  working: 'Working…',
  retry: 'Try again',
  signedOutTitle: 'Teams is off',
  signedOutBody: 'Turn on Teams and sign in from Settings to share notes with your team.',
  goToSettings: 'Open Settings',

  role: (role) => ({ owner: 'Owner', admin: 'Admin', member: 'Member' })[role],
  stateActive: 'Active',
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
  joinedTeam: (team) => `You are now in ${team}.`,

  renameTeam: 'Team name',
  rename: 'Rename',
  leaveTeam: 'Leave team',
  leaveConfirm: (team) => `Leave ${team}? You lose access to its notes.`,
  deleteTeam: 'Delete team',
  deleteConfirm: (team) => `Delete ${team} and everything in it? This cannot be undone.`,
  dangerZone: 'Team',

  sharedNotes: 'Shared notes',
  sharedNotesHint:
    'These appear on the pages they belong to, for everyone in the team. Your own notes stay on this device until you share them.',
  noSharedNotes: 'Nothing has been shared with this team yet.',
  shareWithTeam: 'Share with team',
  sharingNote: 'Sharing…',
  noteShared: (team) => `Shared with ${team}.`,
  refreshNotes: 'Check for changes',
  syncedAgo: (when) => `Up to date as of ${when}`,
  neverSynced: 'Not loaded on this device yet',
  noteEdited: (when) => `Edited ${when}`,
  editNote: 'Edit',
  saveNote: 'Save',
  unshareNote: 'Stop sharing',
  unshareConfirm: 'Take this note out of the team? It stays yours, on your device.',
  deleteSharedNote: 'Delete',
  deleteSharedConfirm: 'Delete this note for everyone in the team?',
  openPage: 'Open the page',

  teamFolders: 'Folders',
  newTeamFolder: 'New folder',
  folderNamePlaceholder: 'Folder name…',
  renameFolder: 'Rename',
  deleteFolder: 'Delete',
  deleteFolderConfirm: (name) => `Delete ${name}? The notes in it stay, unfiled.`,
  noTeamFolders: 'No folders yet.',
  unfiled: 'Unfiled',
  moveToFolder: 'Move to',
  noFolderOption: 'No folder',

  comments: 'Comments',
  discuss: 'Discuss',
  hideComments: 'Hide the discussion',
  noComments: 'Nothing said about this one yet.',
  commentPlaceholder: 'Say something… type @ to name someone',
  postComment: 'Comment',
  replyTo: 'Reply',
  replyPlaceholder: 'Write a reply…',
  postReply: 'Send the reply',
  editComment: 'Edit',
  saveComment: 'Save',
  deleteComment: 'Delete',
  deleteCommentConfirm: 'Delete this comment?',
  commentDeleted: 'This comment was deleted.',
  commentEdited: 'edited',
  commentedAgo: (when) => `Said ${when}`,
  showReplies: (count) => (count === 1 ? 'Show the reply' : `Show all ${count} replies`),
  moreComments: 'Show more',
  formerMember: 'someone who has left',
  mentionNobody: 'Nobody in this team by that name.',
  mentionHint:
    'Only people in this team can be named, and they are named by who they are — so a change of name reaches every comment at once.',

  mentions: 'Where you were named',
  noMentions: 'Nobody has named you yet.',
  mentionIn: (team) => `in ${team}`,
  openNote: 'Open the page',
  moreMentions: 'Show older',

  billing: 'Plan',
  planActive: (until) => `Active until ${until}`,
  planNone: 'No plan',
  planPending: 'Waiting for your payment to be checked',
  planExpired: 'Expired',
  planCanceled: 'Cancelled — the paid period is still yours',
  price: (amount, days) => `${amount} every ${days} days`,
  payWith: 'Pay with',
  methodInstapay: 'InstaPay',
  methodVodafoneCash: 'Vodafone Cash',
  periods: 'Periods',
  referencePlaceholder: 'Transaction reference…',
  referenceHint:
    'Pay first, then put the reference from your bank or wallet here. Someone checks it by hand.',
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
};

const ar: TeamsStrings = {
  teams: 'الفرق',
  yourTeams: 'فرقك',
  noTeams: 'لست في أي فريق بعد. أنشئ فريقًا، أو انضم برابط دعوة.',
  createTeam: 'إنشاء فريق',
  teamNamePlaceholder: 'اسم الفريق…',
  create: 'إنشاء',
  cancel: 'إلغاء',
  working: 'جارٍ التنفيذ…',
  retry: 'حاول مرة أخرى',
  signedOutTitle: 'الفرق متوقفة',
  signedOutBody: 'فعّل الفرق وسجّل دخولك من الإعدادات لمشاركة الملاحظات مع فريقك.',
  goToSettings: 'فتح الإعدادات',

  role: (role) => ({ owner: 'المالك', admin: 'مشرف', member: 'عضو' })[role],
  stateActive: 'فعّال',
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
  joinedTeam: (team) => `أنت الآن في ${team}.`,

  renameTeam: 'اسم الفريق',
  rename: 'إعادة تسمية',
  leaveTeam: 'مغادرة الفريق',
  leaveConfirm: (team) => `مغادرة ${team}؟ ستفقد الوصول إلى ملاحظاته.`,
  deleteTeam: 'حذف الفريق',
  deleteConfirm: (team) => `حذف ${team} وكل ما فيه؟ لا يمكن التراجع عن هذا.`,
  dangerZone: 'الفريق',

  sharedNotes: 'الملاحظات المشتركة',
  sharedNotesHint:
    'تظهر هذه على الصفحات التي تنتمي إليها، لكل من في الفريق. وملاحظاتك الخاصة تبقى على جهازك حتى تشاركها.',
  noSharedNotes: 'لم تُشارَك أي ملاحظة مع هذا الفريق بعد.',
  shareWithTeam: 'مشاركة مع فريق',
  sharingNote: 'جارٍ المشاركة…',
  noteShared: (team) => `شُوركت مع ${team}.`,
  refreshNotes: 'تحقق من التغييرات',
  syncedAgo: (when) => `محدَّثة حتى ${when}`,
  neverSynced: 'لم تُحمَّل على هذا الجهاز بعد',
  noteEdited: (when) => `عُدِّلت ${when}`,
  editNote: 'تعديل',
  saveNote: 'حفظ',
  unshareNote: 'إيقاف المشاركة',
  unshareConfirm: 'إخراج هذه الملاحظة من الفريق؟ تبقى لك على جهازك.',
  deleteSharedNote: 'حذف',
  deleteSharedConfirm: 'حذف هذه الملاحظة لكل من في الفريق؟',
  openPage: 'فتح الصفحة',

  teamFolders: 'المجلدات',
  newTeamFolder: 'مجلد جديد',
  folderNamePlaceholder: 'اسم المجلد…',
  renameFolder: 'إعادة تسمية',
  deleteFolder: 'حذف',
  deleteFolderConfirm: (name) => `حذف ${name}؟ الملاحظات التي فيه تبقى، دون مجلد.`,
  noTeamFolders: 'لا توجد مجلدات بعد.',
  unfiled: 'دون مجلد',
  moveToFolder: 'نقل إلى',
  noFolderOption: 'دون مجلد',

  comments: 'التعليقات',
  discuss: 'مناقشة',
  hideComments: 'إخفاء المناقشة',
  noComments: 'لا شيء عن هذه بعد.',
  commentPlaceholder: 'قل شيئًا… اكتب @ لذكر أحدهم',
  postComment: 'تعليق',
  replyTo: 'رد',
  replyPlaceholder: 'اكتب ردًا…',
  postReply: 'إرسال الرد',
  editComment: 'تعديل',
  saveComment: 'حفظ',
  deleteComment: 'حذف',
  deleteCommentConfirm: 'حذف هذا التعليق؟',
  commentDeleted: 'حُذِف هذا التعليق.',
  commentEdited: 'مُعدّل',
  commentedAgo: (when) => `قاله ${when}`,
  showReplies: (count) => (count === 1 ? 'عرض الرد' : `عرض الردود الـ ${count}`),
  moreComments: 'عرض المزيد',
  formerMember: 'عضو غادر الفريق',
  mentionNobody: 'لا أحد في هذا الفريق بهذا الاسم.',
  mentionHint:
    'يُذكر أعضاء هذا الفريق وحدهم، ويُذكرون بمن هم — فتغيير الاسم يصل إلى كل التعليقات دفعة واحدة.',

  mentions: 'حيث ذُكِرت',
  noMentions: 'لم يذكرك أحد بعد.',
  mentionIn: (team) => `في ${team}`,
  openNote: 'فتح الصفحة',
  moreMentions: 'عرض الأقدم',

  billing: 'الاشتراك',
  planActive: (until) => `فعّال حتى ${until}`,
  planNone: 'لا يوجد اشتراك',
  planPending: 'في انتظار مراجعة دفعتك',
  planExpired: 'منتهٍ',
  planCanceled: 'مُلغى — المدة المدفوعة تبقى لك',
  price: (amount, days) => `${amount} كل ${days} يومًا`,
  payWith: 'ادفع عبر',
  methodInstapay: 'إنستا باي',
  methodVodafoneCash: 'فودافون كاش',
  periods: 'عدد المدد',
  referencePlaceholder: 'رقم العملية…',
  referenceHint: 'ادفع أولًا، ثم ضع رقم العملية من بنكك أو محفظتك هنا. تُراجع الدفعة يدويًا.',
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
};

export function getTeamsStrings(lang: Lang): TeamsStrings {
  return lang === 'ar' ? ar : en;
}
