import type { Note } from './note';

export interface PageNoteGroup {
  pageKey: string;
  pageLabel: string;
  noteCount: number;
  latestUpdatedAt: string;
  notes: Note[];
}

export interface WebsiteNoteGroup {
  websiteKey: string;
  websiteLabel: string;
  noteCount: number;
  latestUpdatedAt: string;
  pages: PageNoteGroup[];
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function pageLabelFor(pageKey: string): string {
  const url = parseUrl(pageKey);
  if (!url) return pageKey;

  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const search = url.search;
  if (pathname === '/') return url.host;
  return `${url.host}${pathname}${search}`;
}

function websiteLabelFor(note: Pick<Note, 'originalUrl' | 'pageKey'>): string {
  const parsedOriginal = parseUrl(note.originalUrl);
  if (parsedOriginal) return parsedOriginal.host;

  const parsedPage = parseUrl(note.pageKey);
  if (parsedPage) return parsedPage.host;

  return note.pageKey;
}

export function getWebsiteKey(note: Pick<Note, 'originalUrl' | 'pageKey'>): string {
  const parsedOriginal = parseUrl(note.originalUrl);
  if (parsedOriginal) return parsedOriginal.origin;

  const parsedPage = parseUrl(note.pageKey);
  if (parsedPage) return parsedPage.origin;

  return note.pageKey;
}

export function groupNotesByWebsite(notes: Note[]): WebsiteNoteGroup[] {
  const websites = new Map<
    string,
    WebsiteNoteGroup & { pageMap: Map<string, PageNoteGroup> }
  >();

  for (const note of notes) {
    const websiteKey = getWebsiteKey(note);
    const websiteLabel = websiteLabelFor(note);
    const website =
      websites.get(websiteKey) ??
      (() => {
        const next = {
          websiteKey,
          websiteLabel,
          noteCount: 0,
          latestUpdatedAt: note.updatedAt,
          pages: [] as PageNoteGroup[],
          pageMap: new Map<string, PageNoteGroup>(),
        };
        websites.set(websiteKey, next);
        return next;
      })();

    website.noteCount += 1;
    if (note.updatedAt > website.latestUpdatedAt) {
      website.latestUpdatedAt = note.updatedAt;
    }

    const page =
      website.pageMap.get(note.pageKey) ??
      (() => {
        const next = {
          pageKey: note.pageKey,
          pageLabel: pageLabelFor(note.pageKey),
          noteCount: 0,
          latestUpdatedAt: note.updatedAt,
          notes: [] as Note[],
        };
        website.pageMap.set(note.pageKey, next);
        website.pages.push(next);
        return next;
      })();

    page.noteCount += 1;
    if (note.updatedAt > page.latestUpdatedAt) {
      page.latestUpdatedAt = note.updatedAt;
    }
    page.notes.push(note);
  }

  const compareLatest = (
    a: { latestUpdatedAt: string; noteCount: number },
    b: { latestUpdatedAt: string; noteCount: number },
  ) => {
    if (a.latestUpdatedAt !== b.latestUpdatedAt) {
      return b.latestUpdatedAt.localeCompare(a.latestUpdatedAt);
    }
    if (a.noteCount !== b.noteCount) return b.noteCount - a.noteCount;
    return 0;
  };

  const grouped = [...websites.values()].map(({ pageMap: _pageMap, ...website }) => ({
    ...website,
    pages: [...website.pages]
      .map((page) => ({
        ...page,
        notes: [...page.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      }))
      .sort((a, b) => {
        const latest = compareLatest(a, b);
        if (latest !== 0) return latest;
        return a.pageLabel.localeCompare(b.pageLabel);
      }),
  }));

  return grouped.sort((a, b) => {
    const latest = compareLatest(a, b);
    if (latest !== 0) return latest;
    return a.websiteLabel.localeCompare(b.websiteLabel);
  });
}
