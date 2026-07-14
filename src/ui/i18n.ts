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
  untitledPage: string;
  notesLibraryEmptyTitle: string;
  notesLibraryEmptyBody: string;
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
  untitledPage: 'Untitled page',
  notesLibraryEmptyTitle: 'No notes yet',
  notesLibraryEmptyBody: 'Select an element on any page to leave your first note.',
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
  untitledPage: 'صفحة بدون عنوان',
  notesLibraryEmptyTitle: 'لا توجد ملاحظات بعد',
  notesLibraryEmptyBody: 'اختر عنصرًا في أي صفحة لتترك ملاحظتك الأولى.',
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
