import type { SupportedLanguage } from './preferences';

/**
 * What's New — the user-facing history of Hamesh, in both interface
 * languages.
 *
 * Deliberately hand-written rather than generated from `CHANGELOG.md`: the
 * changelog is written for whoever maintains this repo (root causes, file
 * names, PR groupings) and only in English. This is the same history told to
 * the person using the extension — what changed for them, in their language.
 *
 * Keeping it here, as typed data, means the page needs no network, no
 * bundled markdown parser, and no build step; and because it's plain data,
 * `pnpm release:validate` can refuse to tag a version that forgot to add its
 * entry (see `tooling/release/version.ts`).
 *
 * Newest first — that ordering is asserted by this module's tests rather
 * than sorted at runtime, so a mis-filed entry is caught in CI instead of
 * silently reordering the page.
 */

/** One line of "here's what changed", in both languages. */
export interface ReleaseNoteItem {
  en: string;
  ar: string;
}

export interface ReleaseNote {
  /** MAJOR.MINOR.PATCH, matching the tag and the manifest. */
  version: string;
  /** ISO calendar date (YYYY-MM-DD) the version was released. */
  date: string;
  /** A few words naming the release, shown beside the version number. */
  title: ReleaseNoteItem;
  items: ReleaseNoteItem[];
}

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: '1.3.0',
    date: '2026-08-21',
    title: { en: 'Notes on the words themselves', ar: 'ملاحظات على الكلمات نفسها' },
    items: [
      {
        en: 'Select any text on a page and a small Hamesh mark appears beside it. Click it, write a note, and those exact words stay highlighted.',
        ar: 'حدّد أي نص في الصفحة فتظهر بجانبه علامة هامش صغيرة. انقرها واكتب ملاحظتك، فتبقى تلك الكلمات بالذات مظلَّلة.',
      },
      {
        en: 'Hover the highlighted words to see the note again; click to open it. Selecting text still just selects text — nothing opens unless you ask it to.',
        ar: 'مرّر المؤشر على الكلمات المظلَّلة لترى ملاحظتك، وانقرها لفتحها. وتحديد النص يبقى مجرّد تحديد — لا يُفتح شيء إلا إذا طلبته.',
      },
      {
        en: 'Hamesh finds the same words again on your next visit, even after the page changes. When it cannot be certain which words were yours, it highlights none of them rather than the wrong ones — the note itself is never lost.',
        ar: 'يعثر هامش على الكلمات نفسها عند زيارتك التالية، حتى بعد تغيّر الصفحة. وإن لم يتأكّد أيّها كانت كلماتك، فلا يظلّل شيئًا بدل أن يظلّل الخطأ — والملاحظة نفسها لا تضيع أبدًا.',
      },
      {
        en: 'Back up everything: Settings → Backup saves all your notes and folders to a file on your device, and restores from one. Importing never deletes anything you already have.',
        ar: 'انسخ كل شيء احتياطيًا: من الإعدادات ← النسخ الاحتياطي احفظ ملاحظاتك وفولدراتك في ملف على جهازك، واستعدها منه. والاستيراد لا يحذف أبدًا شيئًا لديك.',
      },
      {
        en: 'This page — What\u2019s New — is itself new, and Settings rows now carry icons so a setting can be found at a glance.',
        ar: 'وهذه الصفحة — ما الجديد — جديدة بذاتها، وصارت صفوف الإعدادات تحمل أيقونات ليسهل العثور على الإعداد بنظرة.',
      },
    ],
  },
  {
    version: '1.2.3',
    date: '2026-08-13',
    title: { en: 'Custom video players', ar: 'مشغّلات الفيديو المخصّصة' },
    items: [
      {
        en: "Video-note markers can now sit on a site's own video timeline, not just YouTube's, for players that opt in.",
        ar: 'صارت علامات ملاحظات الفيديو تظهر على شريط تقدّم المشغّل نفسه، لا على شريط هامش البديل، في المشغّلات التي تدعم ذلك.',
      },
      {
        en: "On those players the markers now appear and fade together with the player's own controls.",
        ar: 'وفي تلك المشغّلات صارت العلامات تظهر وتختفي مع أدوات تحكّم المشغّل نفسها.',
      },
    ],
  },
  {
    version: '1.2.1',
    date: '2026-08-01',
    title: { en: 'Fixes', ar: 'إصلاحات' },
    items: [
      {
        en: 'The note box now takes your typing the moment it opens — no need to click into it first.',
        ar: 'صار صندوق الملاحظة يستقبل الكتابة فور فتحه، دون الحاجة إلى النقر بداخله أولًا.',
      },
      {
        en: "Sites with no cached icon now show Hamesh's own globe mark instead of Chrome's gray placeholder.",
        ar: 'المواقع التي لا أيقونة محفوظة لها صارت تعرض علامة هامش بدل الأيقونة الرمادية الافتراضية.',
      },
      {
        en: 'The keyboard shortcuts could stop working silently. They now run inside the page itself, so they keep working.',
        ar: 'كانت اختصارات لوحة المفاتيح تتوقّف أحيانًا دون سبب ظاهر. صارت تعمل داخل الصفحة نفسها، فلم تعد تتوقّف.',
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-01',
    title: { en: 'Note actions in the Library', ar: 'إجراءات الملاحظات في المكتبة' },
    items: [
      {
        en: 'Pin, edit, or delete a note straight from the Notes Library, without opening its page.',
        ar: 'يمكنك تثبيت ملاحظة أو تعديلها أو حذفها من مكتبة الملاحظات مباشرةً، دون فتح صفحتها.',
      },
      {
        en: 'The move-to-folder list now marks the folder a note is already in, and the menu stays fully on screen near an edge.',
        ar: 'صارت قائمة النقل إلى فولدر تُعلّم الفولدر الموجودة فيه الملاحظة، وصارت القائمة تظهر كاملة قرب حواف الشاشة.',
      },
      {
        en: 'A folder holding both notes and sub-folders now collapses completely.',
        ar: 'صار الفولدر الذي يحتوي ملاحظات وفولدرات فرعية معًا ينطوي بالكامل.',
      },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-01',
    title: { en: 'Video notes and folders', ar: 'ملاحظات الفيديو والفولدرات' },
    items: [
      {
        en: 'Press Alt+V to note the exact moment you are watching. Saved moments appear as markers on the timeline.',
        ar: 'اضغط Alt+V لتدوين اللحظة التي تشاهدها. تظهر اللحظات المحفوظة كعلامات على شريط الفيديو.',
      },
      {
        en: 'Clicking a marker jumps to that moment and opens the note — playback is never interrupted or started for you.',
        ar: 'النقر على علامة ينقلك إلى تلك اللحظة ويفتح الملاحظة، دون أن يقاطع التشغيل أو يبدأه من تلقاء نفسه.',
      },
      {
        en: 'Organize notes into folders of your own, nested as deeply as you like, by menu or by dragging a note onto a folder.',
        ar: 'رتّب ملاحظاتك في فولدرات خاصة بك، متداخلة كما تشاء، عبر القائمة أو بسحب الملاحظة إلى الفولدر.',
      },
      {
        en: 'Deleting a folder never deletes its notes — they simply become unfiled.',
        ar: 'حذف الفولدر لا يحذف ملاحظاته أبدًا، بل تصير بلا فولدر فحسب.',
      },
      {
        en: 'Settings moved into the Notes Library as a page of its own, with a Shortcuts section.',
        ar: 'انتقلت الإعدادات إلى مكتبة الملاحظات كصفحة مستقلّة، مع قسم للاختصارات.',
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-07-14',
    title: { en: 'The Notes Library', ar: 'مكتبة الملاحظات' },
    items: [
      {
        en: 'A page of its own listing every note you have made, grouped by website.',
        ar: 'صفحة مستقلّة تعرض كل ملاحظاتك مرتّبةً حسب الموقع.',
      },
      {
        en: 'Search your notes, sort the sites, and pick up where you left off from the Continue section.',
        ar: 'ابحث في ملاحظاتك، ورتّب المواقع، وتابع من حيث توقّفت عبر قسم "تابع".',
      },
      {
        en: 'Opening a note from the Library takes you to its page and scrolls straight to it.',
        ar: 'فتح ملاحظة من المكتبة ينقلك إلى صفحتها ويمرّر إليها مباشرةً.',
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-07-10',
    title: { en: 'Language and appearance', ar: 'اللغة والمظهر' },
    items: [
      {
        en: 'Choose English or Arabic for Hamesh itself. The choice applies immediately, in every open tab.',
        ar: 'اختر الإنجليزية أو العربية لواجهة هامش. يُطبَّق الاختيار فورًا في كل التبويبات المفتوحة.',
      },
      {
        en: "Choose Light, Dark, or Match website — which follows each page's own background, as before.",
        ar: 'اختر المظهر الفاتح أو الداكن أو مطابقة الموقع، التي تتبع خلفية كل صفحة كما كان الحال.',
      },
      {
        en: 'Hamesh arrived on the Chrome Web Store.',
        ar: 'صار هامش متاحًا على متجر Chrome.',
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-07-08',
    title: { en: 'The first Hamesh', ar: 'هامش الأولى' },
    items: [
      {
        en: 'Press Alt+H, pick anything on a page, and leave a note on it. It comes back when you do.',
        ar: 'اضغط Alt+H، واختر أي عنصر في الصفحة، واترك عليه ملاحظة. ستجدها في مكانها عند عودتك.',
      },
      {
        en: 'Everything stays on your own device. Hamesh sends nothing anywhere.',
        ar: 'كل شيء يبقى على جهازك. لا يرسل هامش أي شيء إلى أي مكان.',
      },
    ],
  },
];

/** The version the notes above describe as the newest. */
export function getLatestReleaseVersion(): string {
  return RELEASE_NOTES[0]?.version ?? '0.0.0';
}

/** Picks one language out of a bilingual entry. */
export function localizeReleaseNote(item: ReleaseNoteItem, lang: SupportedLanguage): string {
  return lang === 'ar' ? item.ar : item.en;
}

/**
 * Compares two `MAJOR.MINOR.PATCH` strings numerically: negative when `a` is
 * older, positive when newer, `0` when equal. String comparison would get
 * "1.10.0" vs "1.9.0" backwards, which is exactly the case that would make
 * an update silently fail to announce itself.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string): number[] =>
    value
      .split('.')
      .slice(0, 3)
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isFinite(part) ? part : 0));
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Every release newer than `since`, newest first. `null` (nothing seen yet)
 * yields the whole history — the honest answer for someone who has never
 * opened this page, rather than an empty "nothing new".
 */
export function releasesSince(since: string | null): ReleaseNote[] {
  if (!since) return [...RELEASE_NOTES];
  return RELEASE_NOTES.filter((release) => compareVersions(release.version, since) > 0);
}

/** Whether the What's New page has something the user hasn't seen yet. */
export function hasUnseenReleases(lastSeenVersion: string | null): boolean {
  return releasesSince(lastSeenVersion).length > 0;
}

/**
 * Whether a just-completed extension install/update should open What's New.
 *
 * Only a real version-to-version update qualifies. A first install doesn't
 * (there is no "what's new" for someone with no old version to compare to,
 * and opening a changelog uninvited is a poor first impression), and neither
 * does a browser restart or a developer reload of the same version — Chrome
 * reports those through the same listener.
 *
 * Kept as a pure function so the decision is unit-testable; `onInstalled`
 * itself can't be driven from a test.
 */
export function shouldAnnounceUpdate(
  reason: string,
  previousVersion: string | undefined,
  currentVersion: string,
): boolean {
  if (reason !== 'update') return false;
  if (!previousVersion) return false;
  if (compareVersions(currentVersion, previousVersion) <= 0) return false;
  return releasesSince(previousVersion).length > 0;
}
