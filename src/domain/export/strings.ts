import type { ExportLayout } from './layout';
import type { PageKind } from './model';

/**
 * The words an exported file is written in, in Hamesh's two languages. Kept apart from the
 * UI strings: these end up in someone's vault, so they read as document headings, not buttons.
 */
export type ExportLang = 'en' | 'ar';

export interface ExportStrings {
  rootTitle: string;
  overviewFile: string;
  notesCount: (n: number) => string;
  pagesCount: (n: number) => string;
  date: (iso: string) => string;
  kind: Record<PageKind, string>;
  layout: Record<ExportLayout, string>;
  openPage: string;
  openVideo: string;
  lastWritten: (date: string) => string;
  sharedWith: (team: string) => string;
  onCanvas: string;
  mapOfPage: string;
  timeline: string;
  atAGlance: string;
  notes: string;
  glossary: string;
  otherNotes: string;
  toDo: string;
  onThePage: string;
  onAnElement: (tag: string) => string;
  colNumber: string;
  colSection: string;
  colChapter: string;
  colOn: string;
  colNote: string;
  colTime: string;
  colWritten: string;
  colWord: string;
  colMeaning: string;
  colContext: string;
  colPage: string;
  colSite: string;
  colLayout: string;
  colNotes: string;
  colLastWritten: string;
  property: string;
  value: string;
  source: string;
  kindLabel: string;
  folder: string;
  inside: string;
  subfolders: string;
  words: string;
  element: string;
  ownedTitle: string;
  ownedBody: (root: string) => string;
  whereNotesAre: string;
  notesPerSite: string;
  pages: string;
  folders: string;
  liveTable: string;
  csvHint: (file: string) => string;
  exportedFrom: string;
  /** Under a note whose words or element are no longer on its page. */
  noPlace: string;
  footer: (date: string) => string;
}

const enDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(iso),
  );
const arDate = (iso: string) =>
  new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));

/** Arabic counts take the dual and the plural that fits the number. */
function arabicCount(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

const HAMESH = 'https://hamesh.fandees.tech';

const en: ExportStrings = {
  rootTitle: 'Hamesh',
  overviewFile: 'Overview',
  notesCount: (n) => (n === 1 ? '1 note' : `${n} notes`),
  pagesCount: (n) => (n === 1 ? '1 page' : `${n} pages`),
  date: enDate,
  kind: { article: 'Article', video: 'Video', mixed: 'Mixed' },
  layout: { notes: 'Notes', glossary: 'Glossary', timeline: 'Timeline', checklist: 'Checklist' },
  openPage: 'Open the page',
  openVideo: 'Open the video',
  lastWritten: (date) => `last written ${date}`,
  sharedWith: (team) => `shared with ${team}`,
  onCanvas: 'On the canvas',
  mapOfPage: 'Map of the page',
  timeline: 'Timeline',
  atAGlance: 'At a glance',
  notes: 'Notes',
  glossary: 'Glossary',
  otherNotes: 'Other notes',
  toDo: 'To do',
  onThePage: 'On the page',
  onAnElement: (tag) => `On ${tag ? `a ${tag}` : 'an element'}`,
  colNumber: '#',
  colSection: 'Section',
  colChapter: 'Chapter',
  colOn: 'On',
  colNote: 'Note',
  colTime: 'Time',
  colWritten: 'Written',
  colWord: 'Word',
  colMeaning: 'Meaning',
  colContext: 'In context',
  colPage: 'Page',
  colSite: 'Site',
  colLayout: 'Layout',
  colNotes: 'Notes',
  colLastWritten: 'Last written',
  property: 'Property',
  value: 'Value',
  source: 'Source',
  kindLabel: 'Kind',
  folder: 'Folder',
  inside: 'Inside',
  subfolders: 'Sub-folders',
  words: 'words',
  element: 'element',
  ownedTitle: 'This folder belongs to the export',
  ownedBody: (root) =>
    `Exporting again replaces the files in \`${root}/\`. Keep your own writing outside it, and link in.`,
  whereNotesAre: 'Where your notes are',
  notesPerSite: 'Notes per site',
  pages: 'Pages',
  folders: 'Folders',
  liveTable: 'Every page as a live table',
  csvHint: (file) =>
    `\`${file}\` holds every note. Import it on its own in Notion to get a database you can sort and filter.`,
  exportedFrom: 'Exported from',
  noPlace: 'No longer found on the page',
  footer: (date) => `*Exported from [Hamesh](${HAMESH}) · ${date}*`,
};

const ar: ExportStrings = {
  rootTitle: 'هامش',
  overviewFile: 'نظرة عامة',
  notesCount: (n) => arabicCount(n, 'ملاحظة واحدة', 'ملاحظتان', 'ملاحظات', 'ملاحظة'),
  pagesCount: (n) => arabicCount(n, 'صفحة واحدة', 'صفحتان', 'صفحات', 'صفحة'),
  date: arDate,
  kind: { article: 'مقال', video: 'فيديو', mixed: 'مختلط' },
  layout: { notes: 'ملاحظات', glossary: 'قاموس', timeline: 'خط زمني', checklist: 'قائمة مهام' },
  openPage: 'افتح الصفحة',
  openVideo: 'افتح الفيديو',
  lastWritten: (date) => `آخر ملاحظة ${date}`,
  sharedWith: (team) => `مشاركة مع ${team}`,
  onCanvas: 'على الـ Canvas',
  mapOfPage: 'خريطة الصفحة',
  timeline: 'الخط الزمني',
  atAGlance: 'نظرة سريعة',
  notes: 'الملاحظات',
  glossary: 'القاموس',
  otherNotes: 'ملاحظات أخرى',
  toDo: 'المهام',
  onThePage: 'على الصفحة',
  onAnElement: (tag) => (tag ? `على عنصر ${tag}` : 'على عنصر'),
  colNumber: '#',
  colSection: 'القسم',
  colChapter: 'الفصل',
  colOn: 'على',
  colNote: 'الملاحظة',
  colTime: 'الوقت',
  colWritten: 'كُتبت',
  colWord: 'الكلمة',
  colMeaning: 'المعنى',
  colContext: 'في سياقها',
  colPage: 'الصفحة',
  colSite: 'الموقع',
  colLayout: 'طريقة العرض',
  colNotes: 'الملاحظات',
  colLastWritten: 'آخر ملاحظة',
  property: 'الخاصية',
  value: 'القيمة',
  source: 'المصدر',
  kindLabel: 'النوع',
  folder: 'الفولدر',
  inside: 'داخل',
  subfolders: 'فولدرات فرعية',
  words: 'كلام',
  element: 'عنصر',
  ownedTitle: 'هذا الفولدر خاص بالتصدير',
  ownedBody: (root) =>
    `التصدير مرة أخرى يستبدل الملفات داخل \`${root}/\`. اكتب ملاحظاتك الخاصة خارجه، واربطها به.`,
  whereNotesAre: 'أين ملاحظاتك',
  notesPerSite: 'الملاحظات حسب الموقع',
  pages: 'الصفحات',
  folders: 'الفولدرات',
  liveTable: 'كل الصفحات كجدول حي',
  csvHint: (file) =>
    `الملف \`${file}\` فيه كل الملاحظات. استورده وحده في Notion ليصبح قاعدة بيانات ترتّبها وتفلترها.`,
  exportedFrom: 'صُدِّرت من',
  noPlace: 'لم تعد موجودة في الصفحة',
  footer: (date) => `*صُدِّرت من [هامش](${HAMESH}) · ${date}*`,
};

export function exportStrings(lang: ExportLang): ExportStrings {
  return lang === 'ar' ? ar : en;
}
