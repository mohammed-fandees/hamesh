/**
 * Minimal UI localization for Hamesh (English + Arabic).
 *
 * Layout direction and chrome strings are driven by the extension's UI locale,
 * independent of the host page's own language — per the design handoff. Note
 * *content* direction is handled separately with `dir="auto"` so mixed
 * Arabic/Latin text lays out correctly regardless of UI language.
 */
import type { TeamsErrorCode } from '@/teams/errors';

export type Lang = 'en' | 'ar';

export interface Strings {
  note: string;
  writePlaceholder: string;
  save: string;
  saving: string;
  cancel: string;
  edit: string;
  delete: string;
  keepIt: string;
  saveChanges: string;
  deleteConfirm: string;
  emptyError: string;
  saveError: string;
  editedAgo: (rel: string) => string;
  hint: string;
  anchorUnavailable: string;
  viewNote: string;
  addNote: string;
  notesOnPage: (n: number) => string;
  activeOnPage: string;
  /** Said in the popup on a page Hamesh cannot work on (a browser page, the
   *  store, a PDF viewer) — what happened, and what to do instead. */
  popupUnavailableTitle: string;
  popupUnavailableBody: string;
  brand: string;
  settings: string;
  settingsBack: string;
  settingsLanguage: string;
  settingsAppearance: string;
  settingsMatchWebsite: string;
  settingsLanguageEnglish: string;
  settingsLanguageArabic: string;
  settingsAppearanceLight: string;
  settingsAppearanceDark: string;
  openNotesLibrary: string;
  notesLibrary: string;
  continueSection: string;
  continueLastActivity: (rel: string) => string;
  notesCount: (n: number) => string;
  notesLibraryEmptyTitle: string;
  notesLibraryEmptyBody: string;
  searchPlaceholder: string;
  searchNoResultsTitle: string;
  searchNoResultsBody: (query: string) => string;
  sortLabel: string;
  sortAlphabetical: string;
  sortRecent: string;
  pinNote: string;
  unpinNote: string;
  pinnedSection: string;
  loadingNotes: string;
  videoQuickNotePlaceholder: string;
  videoQuickNoteLabel: string;
  videoMarkerLabel: (timestamp: string) => string;
  videoClusterLabel: (count: number) => string;
  settingsShortcuts: string;
  shortcutNotSet: string;
  shortcutOpenChromeSettings: string;
  settingsOpenFull: string;
  libraryModeLabel: string;
  modeDomain: string;
  modeFolder: string;
  newFolder: string;
  folderNamePlaceholder: string;
  renameFolder: string;
  deleteFolder: string;
  deleteFolderConfirm: (name: string) => string;
  unfiledSection: string;
  moveToFolder: string;
  noFolderOption: string;
  addSubfolder: string;
  noteActions: string;
  textNoteAction: string;
  attachedText: string;
  textAnchorUnavailable: string;
  addTextNote: string;
  settingsTextNotes: string;
  settingsTextNotesEnabled: string;
  settingsTextSelectionAction: string;
  settingsOn: string;
  settingsOff: string;
  whatsNew: string;
  whatsNewIntro: string;
  whatsNewCurrentBadge: string;
  whatsNewNewBadge: string;
  whatsNewEarlier: string;
  whatsNewEarlierHint: (count: number) => string;
  whatsNewReleaseDate: (date: string) => string;
  settingsBackup: string;
  backupExport: string;
  backupExportHint: string;
  backupImport: string;
  backupImportHint: string;
  backupChooseFile: string;
  backupExported: (notes: number, folders: number) => string;
  backupImported: (notes: number, folders: number) => string;
  backupImportedNothingNew: string;
  backupErrorInvalidJson: string;
  backupErrorNotABackup: string;
  backupErrorUnsupported: string;
  backupErrorEmpty: string;
  backupErrorFailed: string;
  settingsTeams: string;
  settingsMentions: string;
  teamsIntro: string;
  teamsTurnOn: string;
  teamsTurnOnHint: string;
  teamsTurnOff: string;
  teamsPermissionDenied: string;
  teamsSignIn: string;
  teamsSignInHint: string;
  teamsSignOut: string;
  teamsChecking: string;
  teamsAccount: string;
  teamsPlan: string;
  teamsPlanActive: (until: string) => string;
  teamsPlanNone: string;
  teamsYourTeams: string;
  teamsMemberOf: (n: number) => string;
  teamsError: (code: TeamsErrorCode) => string;
  composerFolder: string;
  composerNoFolders: string;
  composerCreateFolder: string;
  composerCreateFolderSubmit: string;
  composerNewFolderOption: string;
  defaultFolderMenu: string;
  defaultFolderForPage: string;
  defaultFolderForAllPages: string;
  defaultFolderCaption: (page: boolean, global: boolean) => string;
  showMore: string;
  showLess: string;
}

const en: Strings = {
  note: 'Note',
  writePlaceholder: 'Write a note…',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  edit: 'Edit',
  delete: 'Delete',
  keepIt: 'Keep it',
  saveChanges: 'Save changes',
  deleteConfirm: "Delete this note? The anchor won't be affected.",
  emptyError: 'A note needs some text.',
  saveError: "Couldn't save — storage is unavailable.",
  editedAgo: (rel) => `Edited ${rel}`,
  hint: 'Click to add a note · Esc to cancel',
  anchorUnavailable: 'Page changed — showing last known position',
  viewNote: 'View note',
  addNote: 'Add a note',
  notesOnPage: (n) => (n === 1 ? 'note on this page' : 'notes on this page'),
  activeOnPage: 'Active on this page',
  popupUnavailableTitle: 'Notes can’t go on this page',
  popupUnavailableBody:
    'Hamesh works on ordinary websites. Open one, or read the notes you have already made.',
  brand: 'Hamesh',
  settings: 'Settings',
  settingsBack: 'Back',
  settingsLanguage: 'Language',
  settingsAppearance: 'Appearance',
  settingsMatchWebsite: 'Match website',
  settingsLanguageEnglish: 'English',
  settingsLanguageArabic: 'Arabic',
  settingsAppearanceLight: 'Light',
  settingsAppearanceDark: 'Dark',
  openNotesLibrary: 'Notes Library',
  notesLibrary: 'Notes Library',
  continueSection: 'Continue',
  continueLastActivity: (rel) => `Updated ${rel}`,
  notesCount: (n) => (n === 1 ? '1 note' : `${n} notes`),
  notesLibraryEmptyTitle: 'No notes yet',
  notesLibraryEmptyBody: 'Press Alt+H on any page to leave your first note.',
  searchPlaceholder: 'Search notes…',
  searchNoResultsTitle: 'No matches',
  searchNoResultsBody: (query) => `Nothing found for "${query}".`,
  sortLabel: 'Sort',
  sortAlphabetical: 'A–Z',
  sortRecent: 'Recent',
  pinNote: 'Pin this note',
  unpinNote: 'Unpin this note',
  pinnedSection: 'Pinned',
  loadingNotes: 'Loading notes…',
  videoQuickNotePlaceholder: 'Note this moment…',
  videoQuickNoteLabel: 'Add a video note',
  videoMarkerLabel: (timestamp) => `Note at ${timestamp}`,
  videoClusterLabel: (count) => (count === 1 ? '1 note here' : `${count} notes here`),
  settingsShortcuts: 'Shortcuts',
  shortcutNotSet: 'Not set',
  shortcutOpenChromeSettings: 'Change in Chrome settings',
  settingsOpenFull: 'Open full settings',
  libraryModeLabel: 'View',
  modeDomain: 'By site',
  modeFolder: 'By folder',
  newFolder: 'New folder',
  folderNamePlaceholder: 'Folder name…',
  renameFolder: 'Rename folder',
  deleteFolder: 'Delete folder',
  deleteFolderConfirm: (name) =>
    `Delete "${name}"? Its notes (and any sub-folders) will become unfiled, not deleted.`,
  unfiledSection: 'Unfiled',
  moveToFolder: 'Move to folder',
  noFolderOption: 'No folder',
  addSubfolder: 'Add sub-folder',
  noteActions: 'Note actions',
  textNoteAction: 'Add a note to the selected text',
  attachedText: 'Attached text',
  textAnchorUnavailable: "Page changed — couldn't find this text",
  addTextNote: 'Add a note to selected text',
  settingsTextNotes: 'Text notes',
  settingsTextNotesEnabled: 'Notes on selected text',
  settingsTextSelectionAction: 'Show icon after selecting',
  settingsOn: 'On',
  settingsOff: 'Off',
  whatsNew: "What's New",
  whatsNewIntro: 'Everything that has changed in Hamesh, newest first.',
  whatsNewCurrentBadge: 'Installed',
  whatsNewNewBadge: 'New',
  whatsNewEarlier: 'Earlier releases',
  whatsNewEarlierHint: (count) => (count === 1 ? '1 release' : `${count} releases`),
  whatsNewReleaseDate: (date) => date,
  settingsBackup: 'Backup',
  backupExport: 'Export',
  backupExportHint: 'Save every note and folder to a file on this device.',
  backupImport: 'Import',
  backupImportHint: 'Restore from a backup file. Nothing is ever deleted.',
  backupChooseFile: 'Choose a backup file',
  backupExported: (notes, folders) =>
    `Saved ${notes} ${notes === 1 ? 'note' : 'notes'} and ${folders} ${
      folders === 1 ? 'folder' : 'folders'
    }.`,
  backupImported: (notes, folders) =>
    `Restored ${notes} ${notes === 1 ? 'note' : 'notes'} and ${folders} ${
      folders === 1 ? 'folder' : 'folders'
    }.`,
  backupImportedNothingNew: 'Everything in that file was already here.',
  backupErrorInvalidJson: "That file isn't readable JSON.",
  backupErrorNotABackup: "That file isn't a Hamesh backup.",
  backupErrorUnsupported: 'That backup was made by a newer version of Hamesh.',
  backupErrorEmpty: 'That backup has no notes or folders in it.',
  backupErrorFailed: "Couldn't finish — your existing notes are untouched.",
  settingsTeams: 'Teams',
  settingsMentions: 'Mentions',
  teamsIntro:
    'Share notes with the people you work with. Your personal notes stay on this device either way.',
  teamsTurnOn: 'Turn on Teams',
  teamsTurnOnHint:
    'Hamesh will ask to reach its Teams server and to open Google sign-in. Nothing is sent until you sign in.',
  teamsTurnOff: 'Turn off Teams',
  teamsPermissionDenied: "Permission wasn't granted, so Teams stays off.",
  teamsSignIn: 'Sign in with Google',
  teamsSignInHint: 'Your Google name and email identify you to your teammates.',
  teamsSignOut: 'Sign out',
  teamsChecking: 'Checking…',
  teamsAccount: 'Account',
  teamsPlan: 'Plan',
  teamsPlanActive: (until) => `Active until ${until}`,
  teamsPlanNone: 'No plan',
  teamsYourTeams: 'Your teams',
  teamsMemberOf: (n) =>
    n === 0 ? 'Not in a team yet' : n === 1 ? 'Member of 1 team' : `Member of ${n} teams`,
  teamsError: (code) => {
    switch (code) {
      case 'network':
      case 'unavailable':
        return "Couldn't reach Hamesh Teams. Check your connection and try again.";
      case 'cancelled':
        return 'Sign-in was cancelled.';
      case 'account_disabled':
        return 'This account has been disabled.';
      case 'permission_missing':
        return 'Teams needs its permissions. Turn it on again.';
      case 'rate_limited':
        return 'Too many attempts. Try again in a minute.';
      case 'unauthenticated':
      case 'signed_out':
        return 'You were signed out. Sign in again.';
      default:
        return 'Something went wrong. Try again.';
    }
  },
  composerFolder: 'Folder',
  composerNoFolders: 'No folders yet.',
  composerCreateFolder: 'Create folder',
  composerCreateFolderSubmit: 'Create',
  composerNewFolderOption: '+ New folder…',
  defaultFolderMenu: 'Default folder',
  defaultFolderForPage: 'Default for this page',
  defaultFolderForAllPages: 'Default for all pages',
  defaultFolderCaption: (page, global) =>
    page && global
      ? 'Default here and on every page'
      : page
        ? 'Default for this page'
        : 'Default for all pages',
  showMore: 'Show more',
  showLess: 'Show less',
};

const ar: Strings = {
  note: 'ملاحظة',
  writePlaceholder: 'اكتب ملاحظة…',
  save: 'حفظ',
  saving: 'جارٍ الحفظ…',
  cancel: 'إلغاء',
  edit: 'تعديل',
  delete: 'حذف',
  keepIt: 'الاحتفاظ',
  saveChanges: 'حفظ التغييرات',
  deleteConfirm: 'حذف هذه الملاحظة؟ لن يتأثر العنصر المرتبط بها.',
  emptyError: 'الملاحظة تحتاج إلى نص.',
  saveError: 'تعذّر الحفظ — التخزين غير متاح.',
  editedAgo: (rel) => `عُدّلت ${rel}`,
  hint: 'انقر لإضافة ملاحظة · Esc للإلغاء',
  anchorUnavailable: 'تغيّرت الصفحة — نعرض آخر موضع معروف',
  viewNote: 'عرض الملاحظة',
  addNote: 'إضافة ملاحظة',
  notesOnPage: () => 'ملاحظات على هذه الصفحة',
  activeOnPage: 'نشِط على هذه الصفحة',
  popupUnavailableTitle: 'لا يمكن وضع ملاحظات على هذه الصفحة',
  popupUnavailableBody: 'يعمل هامش على المواقع العادية. افتح موقعًا، أو اقرأ ملاحظاتك السابقة.',
  brand: 'هامش',
  settings: 'الإعدادات',
  settingsBack: 'رجوع',
  settingsLanguage: 'اللغة',
  settingsAppearance: 'المظهر',
  settingsMatchWebsite: 'مطابقة الموقع',
  settingsLanguageEnglish: 'الإنجليزية',
  settingsLanguageArabic: 'العربية',
  settingsAppearanceLight: 'فاتح',
  settingsAppearanceDark: 'داكن',
  openNotesLibrary: 'مكتبة الملاحظات',
  notesLibrary: 'مكتبة الملاحظات',
  continueSection: 'تابع',
  continueLastActivity: (rel) => `آخر تحديث ${rel}`,
  notesCount: (n) => `${n} ${n === 1 ? 'ملاحظة' : 'ملاحظات'}`,
  notesLibraryEmptyTitle: 'لا توجد ملاحظات بعد',
  notesLibraryEmptyBody: 'اضغط Alt+H في أي صفحة لتترك ملاحظتك الأولى.',
  searchPlaceholder: 'ابحث في الملاحظات…',
  searchNoResultsTitle: 'لا نتائج',
  searchNoResultsBody: (query) => `لا توجد نتائج لـ "${query}".`,
  sortLabel: 'ترتيب',
  sortAlphabetical: 'أبجديًا',
  sortRecent: 'الأحدث',
  pinNote: 'تثبيت هذه الملاحظة',
  unpinNote: 'إلغاء تثبيت هذه الملاحظة',
  pinnedSection: 'مثبّت',
  loadingNotes: 'جارٍ تحميل الملاحظات…',
  videoQuickNotePlaceholder: 'دوّن هذه اللحظة…',
  videoQuickNoteLabel: 'إضافة ملاحظة فيديو',
  videoMarkerLabel: (timestamp) => `ملاحظة عند ${timestamp}`,
  videoClusterLabel: (count) => `${count} ${count === 1 ? 'ملاحظة' : 'ملاحظات'} هنا`,
  settingsShortcuts: 'الاختصارات',
  shortcutNotSet: 'غير محدد',
  shortcutOpenChromeSettings: 'تغيير من إعدادات Chrome',
  settingsOpenFull: 'فتح الإعدادات الكاملة',
  libraryModeLabel: 'العرض',
  modeDomain: 'حسب الموقع',
  modeFolder: 'حسب الفولدر',
  newFolder: 'فولدر جديد',
  folderNamePlaceholder: 'اسم الفولدر…',
  renameFolder: 'إعادة تسمية الفولدر',
  deleteFolder: 'حذف الفولدر',
  deleteFolderConfirm: (name) =>
    `حذف "${name}"؟ ملاحظاته (وأي فولدرات فرعية) هتبقى بدون فولدر، مش هتتحذف.`,
  unfiledSection: 'بدون فولدر',
  moveToFolder: 'نقل إلى فولدر',
  noFolderOption: 'بدون فولدر',
  addSubfolder: 'إضافة فولدر فرعي',
  noteActions: 'خيارات الملاحظة',
  textNoteAction: 'أضف ملاحظة على النص المحدد',
  attachedText: 'النص المرتبط',
  textAnchorUnavailable: 'تغيّرت الصفحة — تعذّر العثور على هذا النص',
  addTextNote: 'ملاحظة على النص المحدد',
  settingsTextNotes: 'ملاحظات النص',
  settingsTextNotesEnabled: 'ملاحظات على النص المحدد',
  settingsTextSelectionAction: 'إظهار الأيقونة بعد التحديد',
  settingsOn: 'مفعّل',
  settingsOff: 'معطّل',
  whatsNew: 'ما الجديد',
  whatsNewIntro: 'كل ما تغيّر في هامش، الأحدث أولًا.',
  whatsNewCurrentBadge: 'المثبّتة',
  whatsNewNewBadge: 'جديد',
  whatsNewEarlier: 'الإصدارات السابقة',
  whatsNewEarlierHint: (count) => (count === 1 ? 'إصدار واحد' : `${count} إصدارات`),
  whatsNewReleaseDate: (date) => date,
  settingsBackup: 'النسخ الاحتياطي',
  backupExport: 'تصدير',
  backupExportHint: 'احفظ كل ملاحظاتك وفولدراتك في ملف على جهازك.',
  backupImport: 'استيراد',
  backupImportHint: 'استعد ملاحظاتك من ملف نسخة احتياطية. لا يُحذف أي شيء أبدًا.',
  backupChooseFile: 'اختر ملف نسخة احتياطية',
  backupExported: (notes, folders) => `حُفظت ${notes} ملاحظة و${folders} فولدر.`,
  backupImported: (notes, folders) => `استُعيدت ${notes} ملاحظة و${folders} فولدر.`,
  backupImportedNothingNew: 'كل ما في الملف موجود لديك بالفعل.',
  backupErrorInvalidJson: 'الملف ليس بصيغة JSON صالحة.',
  backupErrorNotABackup: 'هذا الملف ليس نسخة احتياطية من هامش.',
  backupErrorUnsupported: 'هذه النسخة الاحتياطية من إصدار أحدث من هامش.',
  backupErrorEmpty: 'لا توجد ملاحظات أو فولدرات في هذه النسخة.',
  backupErrorFailed: 'تعذّر إكمال العملية — ملاحظاتك الحالية لم تتأثّر.',
  settingsTeams: 'الفرق',
  settingsMentions: 'الإشارات',
  teamsIntro: 'شارك الملاحظات مع من تعمل معهم. ملاحظاتك الشخصية تبقى على جهازك في كل الأحوال.',
  teamsTurnOn: 'تفعيل الفرق',
  teamsTurnOnHint:
    'سيطلب هامش إذنًا بالاتصال بخادم الفرق وفتح تسجيل الدخول بحساب Google. لا يُرسل أي شيء قبل أن تسجّل دخولك.',
  teamsTurnOff: 'إيقاف الفرق',
  teamsPermissionDenied: 'لم يُمنح الإذن، لذا تبقى الفرق متوقفة.',
  teamsSignIn: 'تسجيل الدخول بحساب Google',
  teamsSignInHint: 'اسمك وبريدك في Google يعرّفان بك لزملائك في الفريق.',
  teamsSignOut: 'تسجيل الخروج',
  teamsChecking: 'جارٍ التحقق…',
  teamsAccount: 'الحساب',
  teamsPlan: 'الاشتراك',
  teamsPlanActive: (until) => `فعّال حتى ${until}`,
  teamsPlanNone: 'لا يوجد اشتراك',
  teamsYourTeams: 'فرقك',
  teamsMemberOf: (n) =>
    n === 0
      ? 'لست في أي فريق بعد'
      : n === 1
        ? 'عضو في فريق واحد'
        : n === 2
          ? 'عضو في فريقين'
          : n <= 10
            ? `عضو في ${n} فرق`
            : `عضو في ${n} فريقًا`,
  teamsError: (code) => {
    switch (code) {
      case 'network':
      case 'unavailable':
        return 'تعذّر الوصول إلى خادم الفرق. تحقّق من اتصالك وحاول مرة أخرى.';
      case 'cancelled':
        return 'أُلغي تسجيل الدخول.';
      case 'account_disabled':
        return 'هذا الحساب معطّل.';
      case 'permission_missing':
        return 'تحتاج الفرق إلى أذوناتها. فعّلها مرة أخرى.';
      case 'rate_limited':
        return 'محاولات كثيرة. حاول مرة أخرى بعد دقيقة.';
      case 'unauthenticated':
      case 'signed_out':
        return 'انتهت جلستك. سجّل دخولك مرة أخرى.';
      default:
        return 'حدث خطأ ما. حاول مرة أخرى.';
    }
  },
  composerFolder: 'الفولدر',
  composerNoFolders: 'لا توجد فولدرات بعد.',
  composerCreateFolder: 'إنشاء فولدر',
  composerCreateFolderSubmit: 'إنشاء',
  composerNewFolderOption: '+ فولدر جديد…',
  defaultFolderMenu: 'الفولدر الافتراضي',
  defaultFolderForPage: 'افتراضي لهذه الصفحة',
  defaultFolderForAllPages: 'افتراضي لكل الصفحات',
  defaultFolderCaption: (page, global) =>
    page && global
      ? 'افتراضي هنا وفي كل الصفحات'
      : page
        ? 'افتراضي لهذه الصفحة'
        : 'افتراضي لكل الصفحات',
  showMore: 'عرض المزيد',
  showLess: 'عرض أقل',
};

export function resolveLang(uiLanguage?: string): Lang {
  const lang = (uiLanguage ?? '').toLowerCase();
  return lang.startsWith('ar') ? 'ar' : 'en';
}

export function getStrings(lang: Lang): Strings {
  return lang === 'ar' ? ar : en;
}

export function dirForLang(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

/** Compact relative time for note timestamps, localized to en/ar. */
export function relativeTime(iso: string, lang: Lang): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  const hr = Math.round(diffMs / 3600000);
  const day = Math.round(diffMs / 86400000);
  if (lang === 'ar') {
    if (min < 1) return 'الآن';
    if (min < 60) return `قبل ${min} دقيقة`;
    if (hr < 24) return `قبل ${hr} ساعة`;
    return `قبل ${day} يوم`;
  }
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  return `${day}d ago`;
}
