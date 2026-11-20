import type { Note } from '../note';
import type { FolderLike } from '../folder';
import { inferLayout, type ExportLayout } from './layout';

/**
 * Notes and folders, shaped once for every renderer: which pages exist, in which order their
 * notes sit, which sections they fall under, and which group (a folder, or a site's unfiled
 * notes) decides each page's layout. Pure and deterministic: the same library always gives
 * the same model, so an export can be repeated and diffed.
 */

export type ExportScope =
  { kind: 'page'; pageId: string } | { kind: 'folder'; folderId: string } | { kind: 'all' };

export type PageKind = 'article' | 'video' | 'mixed';

export interface ExportSection {
  /** The heading or chapter the notes were written under, or null when unknown. */
  title: string | null;
  notes: Note[];
}

export interface ExportPage {
  /** `platform:videoId` for a video, the page key otherwise (see `pageIdentity`). */
  id: string;
  url: string;
  site: string;
  title: string;
  kind: PageKind;
  /** In page order: text position, element position, or video time. */
  notes: Note[];
  sections: ExportSection[];
  created: string;
  updated: string;
  /** Local folders its notes are filed in, in first-seen order. */
  folderIds: string[];
  /** Seconds, for a video. */
  duration?: number;
  /** The group whose layout this page follows. */
  groupKey: string;
}

export interface ExportGroup {
  /** `folder:<id>` or `site:<host>`: the key a chosen layout is remembered by. */
  key: string;
  kind: 'folder' | 'site';
  /** Folder path (`Reading / Science`) or site name. */
  label: string;
  folderId?: string;
  site?: string;
  /** Pages that follow this group's layout. */
  pageIds: string[];
  /** Every note in scope that belongs to this group. */
  notes: Note[];
  suggested: ExportLayout;
}

export interface ExportFolder {
  id: string;
  name: string;
  parentId: string | null;
  /** Names from the top folder down to this one. */
  path: string[];
  /** Notes filed directly in this folder. */
  notes: Note[];
  /** Child folders that hold notes somewhere below. */
  childIds: string[];
}

export interface ExportModel {
  scope: ExportScope;
  pages: ExportPage[];
  groups: ExportGroup[];
  folders: ExportFolder[];
  noteCount: number;
}

/** A page is a video (YouTube keeps every video under one page key) or a page key. */
export function pageIdentity(note: Pick<Note, 'anchor' | 'pageKey'>): string {
  const a = note.anchor;
  return a.type === 'video' ? `video:${a.platform}:${a.videoId}` : note.pageKey;
}

export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'local';
  } catch {
    return 'local';
  }
}

/** A tab title without the noise browsers and sites add: YouTube's unread count in front and
 *  its name at the end. Falls back to the last part of the address. */
export function cleanTitle(title: string | undefined, url: string): string {
  const cleaned = (title ?? '')
    .replace(/^\(\d+\)\s+/, '')
    .replace(/\s+-\s+YouTube$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned) return cleaned;
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : parsed.hostname;
  } catch {
    return url;
  }
}

export function orderKey(note: Note): number {
  const a = note.anchor;
  if (a.type === 'video') return a.timestamp;
  if (a.type === 'text') return a.textPosition?.start ?? 0;
  return a.fallbackDocumentPosition?.y ?? 0;
}

function byPageOrder(a: Note, b: Note): number {
  return (
    orderKey(a) - orderKey(b) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
}

function sectionOf(note: Note): string | null {
  const capture = note.capture;
  if (!capture) return null;
  return (note.anchor.type === 'video' ? capture.chapter : capture.section) ?? null;
}

/** Notes in order, split wherever the section changes. */
function sectionsOf(notes: Note[]): ExportSection[] {
  const sections: ExportSection[] = [];
  for (const note of notes) {
    const title = sectionOf(note);
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.notes.push(note);
    else sections.push({ title, notes: [note] });
  }
  return sections;
}

function descendantsOf(rootId: string, folders: readonly FolderLike[]): Set<string> {
  const ids = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
}

export function buildExportModel(
  allNotes: readonly Note[],
  allFolders: readonly FolderLike[],
  scope: ExportScope,
): ExportModel {
  const folderById = new Map(allFolders.map((f) => [f.id, f]));
  const pathOf = (id: string): string[] => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (
      let f = folderById.get(id);
      f && !seen.has(f.id);
      f = f.parentId ? folderById.get(f.parentId) : undefined
    ) {
      seen.add(f.id);
      names.unshift(f.name);
    }
    return names;
  };
  const filedIn = (note: Note): string | null =>
    note.folderId && folderById.has(note.folderId) ? note.folderId : null;

  let notes: Note[];
  if (scope.kind === 'page') notes = allNotes.filter((n) => pageIdentity(n) === scope.pageId);
  else if (scope.kind === 'folder') {
    const inside = descendantsOf(scope.folderId, allFolders);
    notes = allNotes.filter((n) => {
      const id = filedIn(n);
      return id !== null && inside.has(id);
    });
  } else notes = [...allNotes];

  const groupKeyOf = (note: Note): string => {
    const id = filedIn(note);
    return id ? `folder:${id}` : `site:${siteOf(note.originalUrl)}`;
  };

  // Pages
  const byPage = new Map<string, Note[]>();
  for (const note of notes) {
    const id = pageIdentity(note);
    const list = byPage.get(id);
    if (list) list.push(note);
    else byPage.set(id, [note]);
  }
  const pages: ExportPage[] = [...byPage.entries()].map(([id, list]) => {
    const ordered = [...list].sort(byPageOrder);
    const first = [...list].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    )[0];
    const hasVideo = ordered.some((n) => n.anchor.type === 'video');
    const hasOther = ordered.some((n) => n.anchor.type !== 'video');
    const video = ordered.find((n) => n.anchor.type === 'video');
    const url = video ? video.originalUrl : first.pageKey;
    const votes = new Map<string, number>();
    for (const n of list) votes.set(groupKeyOf(n), (votes.get(groupKeyOf(n)) ?? 0) + 1);
    const top = Math.max(...votes.values());
    const groupKey = [groupKeyOf(first), ...votes.keys()].find((k) => votes.get(k) === top)!;
    const folderIds = [...new Set(ordered.map(filedIn).filter((f): f is string => f !== null))];
    const duration = video?.anchor.type === 'video' ? video.anchor.duration : undefined;
    return {
      id,
      url,
      site: siteOf(first.originalUrl),
      title: cleanTitle(first.pageContext?.title, url),
      kind: hasVideo && hasOther ? 'mixed' : hasVideo ? 'video' : 'article',
      notes: ordered,
      sections: sectionsOf(ordered),
      created: first.createdAt,
      updated: list.map((n) => n.updatedAt).sort()[list.length - 1],
      folderIds,
      ...(duration ? { duration } : {}),
      groupKey,
    };
  });
  pages.sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));

  // Groups
  const groupNotes = new Map<string, Note[]>();
  for (const note of notes) {
    const key = groupKeyOf(note);
    const list = groupNotes.get(key);
    if (list) list.push(note);
    else groupNotes.set(key, [note]);
  }
  for (const page of pages) if (!groupNotes.has(page.groupKey)) groupNotes.set(page.groupKey, []);
  const groups: ExportGroup[] = [...groupNotes.entries()].map(([key, list]) => {
    const isFolder = key.startsWith('folder:');
    const id = key.slice(key.indexOf(':') + 1);
    return {
      key,
      kind: isFolder ? 'folder' : 'site',
      label: isFolder ? pathOf(id).join(' / ') : id,
      ...(isFolder ? { folderId: id } : { site: id }),
      pageIds: pages.filter((p) => p.groupKey === key).map((p) => p.id),
      notes: list,
      suggested: inferLayout(list),
    };
  });
  groups.sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === 'folder' ? -1 : 1) || a.label.localeCompare(b.label),
  );

  // Folders that hold a note somewhere below them
  const withNotes = new Set<string>();
  for (const note of notes) {
    const seen = new Set<string>();
    for (
      let f = folderById.get(filedIn(note) ?? '');
      f && !seen.has(f.id);
      f = f.parentId ? folderById.get(f.parentId) : undefined
    ) {
      seen.add(f.id);
      withNotes.add(f.id);
    }
  }
  const folders: ExportFolder[] = allFolders
    .filter((f) => withNotes.has(f.id))
    .map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      path: pathOf(f.id),
      notes: notes.filter((n) => filedIn(n) === f.id).sort(byPageOrder),
      childIds: allFolders
        .filter((c) => c.parentId === f.id && withNotes.has(c.id))
        .map((c) => c.id),
    }))
    .sort((a, b) => a.path.join('/').localeCompare(b.path.join('/')));

  return { scope, pages, groups, folders, noteCount: notes.length };
}
