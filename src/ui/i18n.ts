/**
 * Minimal UI localization for Hamesh (English + Arabic).
 *
 * Layout direction and chrome strings are driven by the extension's UI locale,
 * independent of the host page's own language — per the design handoff. Note
 * *content* direction is handled separately with `dir="auto"` so mixed
 * Arabic/Latin text lays out correctly regardless of UI language.
 */
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
  /** The reader's own notes, as one space beside their teams' in the Library. */
  mySpace: string;
  mySpaceMeta: (count: number) => string;
  moveToFolder: string;
  noFolderOption: string;
  addSubfolder: string;
  /** The name of a folder's "⋮": what it acts on. */
  folderActions: (folder: string) => string;
  noteActions: string;
  /** A note's menu: open it where it lives in Hamesh, and copy its words. */
  openInHamesh: string;
  copyNote: string;
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
  composerFolder: string;
  composerNoFolders: string;
  composerCreateFolder: string;
  create: string;
  composerNewFolderOption: string;
  defaultFolderMenu: string;
  defaultFolderForPage: string;
  defaultFolderForAllPages: string;
  defaultFolderCaption: (page: boolean, global: boolean) => string;
  showMore: string;
  showLess: string;
  working: string;
  retry: string;
  /** Said when a note runs past what one note may hold. */
  noteTooLong: string;
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
  mySpace: 'My notes',
  mySpaceMeta: (count) => `On this device only · ${count === 1 ? '1 note' : `${count} notes`}`,
  moveToFolder: 'Move to folder',
  noFolderOption: 'No folder',
  addSubfolder: 'Add sub-folder',
  folderActions: (folder) => `Actions for ${folder}`,
  noteActions: 'Note actions',
  openInHamesh: 'Open in Hamesh',
  copyNote: 'Copy the note',
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
  composerFolder: 'Folder',
  composerNoFolders: 'No folders yet.',
  composerCreateFolder: 'Create folder',
  create: 'Create',
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
  working: 'Working…',
  retry: 'Try again',
  noteTooLong: 'That is longer than a note can be. Shorten it a little.',
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
  mySpace: 'ملاحظاتي',
  mySpaceMeta: (count) => `على هذا الجهاز فقط · ${count} ${count === 1 ? 'ملاحظة' : 'ملاحظات'}`,
  moveToFolder: 'نقل إلى فولدر',
  noFolderOption: 'بدون فولدر',
  addSubfolder: 'إضافة فولدر فرعي',
  folderActions: (folder) => `إجراءات ${folder}`,
  noteActions: 'خيارات الملاحظة',
  openInHamesh: 'افتح في هامش',
  copyNote: 'انسخ نص الملاحظة',
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
  composerFolder: 'الفولدر',
  composerNoFolders: 'لا توجد فولدرات بعد.',
  composerCreateFolder: 'إنشاء فولدر',
  create: 'إنشاء',
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
  working: 'جارٍ التنفيذ…',
  retry: 'حاول مرة أخرى',
  noteTooLong: 'هذا أطول مما تتسع له ملاحظة. اختصره قليلًا.',
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
