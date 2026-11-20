import type { Note, TextAnchor, VideoAnchor, ElementAnchor } from '@/domain/note';
import type { Folder } from '@/domain/folder';

let seq = 0;
function nextId(): string {
  seq += 1;
  return `${String(seq).padStart(8, '0')}-0000-4000-8000-000000000000`;
}

interface Base {
  id?: string;
  content?: string;
  url?: string;
  pageKey?: string;
  title?: string;
  folderId?: string;
  createdAt?: string;
  updatedAt?: string;
  section?: string;
  chapter?: string;
}

function note(anchor: Note['anchor'], base: Base): Note {
  const url = base.url ?? 'https://maktaba.site/bennabi/conditions-of-renaissance';
  const createdAt = base.createdAt ?? '2026-08-22T15:00:00.000Z';
  const capture =
    base.section || base.chapter
      ? {
          ...(base.section ? { section: base.section } : {}),
          ...(base.chapter ? { chapter: base.chapter } : {}),
        }
      : undefined;
  return {
    id: base.id ?? nextId(),
    schemaVersion: 1,
    pageKey: base.pageKey ?? url.split('#')[0],
    originalUrl: url,
    content: base.content ?? 'A note',
    anchor,
    workspaceId: 'default',
    pageContext:
      base.title === undefined
        ? { title: 'The Conditions of Renaissance – Maktaba' }
        : { title: base.title },
    ...(base.folderId ? { folderId: base.folderId } : {}),
    ...(capture ? { capture } : {}),
    createdAt,
    updatedAt: base.updatedAt ?? createdAt,
  };
}

export function textNote(opts: Base & { exact?: string; start?: number }): Note {
  const anchor: TextAnchor = {
    type: 'text',
    version: 1,
    exact: opts.exact ?? 'some words',
    context: { prefix: 'before ', suffix: ' after' },
    textPosition: { start: opts.start ?? 0, end: (opts.start ?? 0) + 10 },
  };
  return note(anchor, opts);
}

export function videoNote(
  opts: Base & { timestamp: number; videoId?: string; duration?: number },
): Note {
  const videoId = opts.videoId ?? 'Qx7aL2mP9dE';
  const anchor: VideoAnchor = {
    type: 'video',
    platform: 'youtube',
    videoId,
    timestamp: opts.timestamp,
    duration: opts.duration ?? 4360,
  };
  return note(anchor, {
    url: `https://www.youtube.com/watch?v=${videoId}`,
    pageKey: 'https://www.youtube.com/watch',
    title: '(93) مقدمة في الخوارزميات — المحاضرة 3 - YouTube',
    ...opts,
  });
}

export function elementNote(opts: Base & { tagName?: string; y?: number }): Note {
  const anchor: ElementAnchor = {
    primarySelector: null,
    signals: { tagName: opts.tagName ?? 'button', textSnippet: 'Continue' },
    fallbackDocumentPosition: { x: 0, y: opts.y ?? 0 },
  };
  return note(anchor, { url: 'https://shop.example/checkout', title: 'Checkout', ...opts });
}

export function folder(id: string, name: string, parentId: string | null = null): Folder {
  return {
    id,
    name,
    parentId,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

/** The shape of a real backup (anonymised): vocabulary on docs pages, long notes on one page,
 *  three podcast episodes that share YouTube's one page key, an empty folder tree. */
export function realisticLibrary(): { notes: Note[]; folders: Folder[] } {
  const folders = [
    folder('f-youtube', 'Videos'),
    folder('f-podcasts', 'Talks Notes', 'f-youtube'),
    folder('f-vocab', 'Bennabi - Vocab'),
    folder('f-learning', 'Reading'),
    folder('f-react', 'Science', 'f-learning'),
    folder('f-hamesh', 'Projects'),
    folder('f-landing', 'Garden Plans', 'f-hamesh'),
  ];
  const lifecycle = { url: 'https://maktaba.site/bennabi/conditions-of-renaissance' };
  const refs = {
    url: 'https://maktaba.site/khwarizmi/the-book-of-algebra',
    title: 'The Book of Algebra – Maktaba',
  };
  const notes = [
    textNote({
      ...lifecycle,
      id: 'n-cleanup',
      exact: 'civilization is creation;',
      start: 8848,
      folderId: 'f-react',
      content:
        'This is the core claim of the book: a civilization makes its products, never the reverse.',
    }),
    textNote({
      ...lifecycle,
      id: 'n-advice',
      exact:
        'When you look from the market’s perspective, it is tempting to think of progress as buying.',
      start: 9263,
      folderId: 'f-react',
      content: 'Bennabi advice #1',
    }),
    textNote({
      ...lifecycle,
      id: 'n-twice',
      exact: 'The author states the argument one extra time in this chapter',
      start: 12889,
      folderId: 'f-react',
      content: 'Every idea in this chapter is said twice',
    }),
    textNote({
      ...lifecycle,
      id: 'n-imitation',
      exact: 'imitation',
      start: 14859,
      folderId: 'f-vocab',
      content: 'تقليد',
    }),
    textNote({
      ...lifecycle,
      id: 'n-dependence',
      exact: 'dependence',
      start: 15465,
      folderId: 'f-vocab',
      content: 'تبعية أو اعتماد',
    }),
    textNote({
      ...lifecycle,
      id: 'n-renaissance',
      exact: 'renaissance',
      start: 29914,
      folderId: 'f-vocab',
      content: 'نهضة',
    }),
    textNote({
      ...refs,
      id: 'n-creation',
      exact: 'creation',
      start: 2207,
      folderId: 'f-vocab',
      content: 'إبداع - خلق',
    }),
    textNote({
      ...refs,
      id: 'n-wisdom',
      exact: 'house of wisdom',
      start: 2356,
      folderId: 'f-vocab',
      content: 'بيت الحكمة',
    }),
    textNote({
      url: 'https://maktaba.site/haytham/the-book-of-optics',
      title: 'The Book of Optics – Maktaba',
      id: 'n-two',
      exact: 'The eye sends out no rays; light comes into it from what it sees.',
      start: 5358,
      folderId: 'f-react',
      content: '#2',
    }),
    videoNote({
      id: 'v-travel',
      videoId: 'Qx7mT2pLk9A',
      timestamp: 2451.08,
      duration: 6207.66,
      folderId: 'f-podcasts',
      title: '(93) قبل أن تسافر , اقرأ عن بيت الحكمة ! | حوار - YouTube',
      content: 'Learning starts in childhood',
    }),
    videoNote({
      id: 'v-debate',
      videoId: 'Rb3nW8sDf0C',
      timestamp: 585.86,
      duration: 6719.06,
      folderId: 'f-podcasts',
      title: '(118) المناظرة : هل تُستورد الحضارة؟ - YouTube',
      content: 'عواقب ما تتمناه',
    }),
    videoNote({
      id: 'v-cast',
      videoId: 'Tz5kH1vGy4E',
      timestamp: 2057.9,
      duration: 5991.78,
      title: '(147) مجالس العلم 13 | حديث صريح - YouTube',
      content: 'معقول!!',
      createdAt: '2026-11-07T13:00:00.000Z',
    }),
  ];
  return { notes, folders };
}
