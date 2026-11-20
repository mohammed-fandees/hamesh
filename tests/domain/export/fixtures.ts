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
  const url = base.url ?? 'https://react.dev/learn/lifecycle-of-reactive-effects';
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
        ? { title: 'Lifecycle of Reactive Effects – React' }
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
    folder('f-youtube', 'Youtube'),
    folder('f-podcasts', 'Podcasts Notes', 'f-youtube'),
    folder('f-vocab', 'English - Vocab'),
    folder('f-learning', 'Learning'),
    folder('f-react', 'React', 'f-learning'),
    folder('f-hamesh', 'Hamesh'),
    folder('f-landing', 'Landing Page', 'f-hamesh'),
  ];
  const lifecycle = { url: 'https://react.dev/learn/lifecycle-of-reactive-effects' };
  const refs = {
    url: 'https://react.dev/learn/referencing-values-with-refs',
    title: 'Referencing Values with Refs – React',
  };
  const notes = [
    textNote({
      ...lifecycle,
      id: 'n-cleanup',
      exact: 'connection.disconnect();',
      start: 8848,
      folderId: 'f-react',
      content:
        'This is the default api contract in useEffect: useEffect should only return undefined or a function.',
    }),
    textNote({
      ...lifecycle,
      id: 'n-advice',
      exact:
        'When you looked from the component’s perspective, it was tempting to think of Effects as callbacks.',
      start: 9263,
      folderId: 'f-react',
      content: 'React lifecycle advice #1',
    }),
    textNote({
      ...lifecycle,
      id: 'n-twice',
      exact: 'React starts and stops your Effect one extra time in development',
      start: 12889,
      folderId: 'f-react',
      content: 'Every Effect in React development env is done twice',
    }),
    textNote({
      ...lifecycle,
      id: 'n-intend',
      exact: 'intend',
      start: 14859,
      folderId: 'f-vocab',
      content: 'ينوي',
    }),
    textNote({
      ...lifecycle,
      id: 'n-cohesive',
      exact: 'cohesive',
      start: 15465,
      folderId: 'f-vocab',
      content: 'مُتماسك أو مُلتحم',
    }),
    textNote({
      ...lifecycle,
      id: 'n-suppress',
      exact: 'suppressing',
      start: 29914,
      folderId: 'f-vocab',
      content: 'قمع',
    }),
    textNote({
      ...refs,
      id: 'n-mutable',
      exact: 'mutable',
      start: 2207,
      folderId: 'f-vocab',
      content: 'مُتقلب - مُتغير',
    }),
    textNote({
      ...refs,
      id: 'n-hatch',
      exact: 'escape hatch',
      start: 2356,
      folderId: 'f-vocab',
      content: 'فتحة الهروب',
    }),
    textNote({
      url: 'https://react.dev/reference/react/useState',
      title: 'useState – React',
      id: 'n-two',
      exact: 'The set function only updates the state variable for the next render.',
      start: 5358,
      folderId: 'f-react',
      content: '#2',
    }),
    videoNote({
      id: 'v-travel',
      videoId: 'DM6Uq2ixzjs',
      timestamp: 2451.08,
      duration: 6207.66,
      folderId: 'f-podcasts',
      title: '(93) لو بتفكر تسافر , شوف الفيديو دا الأول ! | ضيف - YouTube',
      content: 'Teamwork from the childhood',
    }),
    videoNote({
      id: 'v-debate',
      videoId: 'Jfl9kguMZj4',
      timestamp: 585.86,
      duration: 6719.06,
      folderId: 'f-podcasts',
      title: '(118) المناظرة الكبرى : سؤال كبير؟ - YouTube',
      content: 'مألات ما تتمنى',
    }),
    videoNote({
      id: 'v-cast',
      videoId: 'JYDxiSJAwBE',
      timestamp: 2057.9,
      duration: 5991.78,
      title: '(147) صيد كاست 13 | حوار جريء - YouTube',
      content: 'ازااااي!!',
      createdAt: '2026-11-07T13:12:47.515Z',
    }),
  ];
  return { notes, folders };
}
