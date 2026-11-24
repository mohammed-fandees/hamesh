import type { Note } from '../note';
import type { ExportFlavor } from '../preferences';
import { formatVideoTimestamp } from '../video-markers';
import { isTermPair, type ExportLayout } from './layout';
import type { ExportFolder, ExportModel, ExportPage } from './model';
import { exportStrings, type ExportLang, type ExportStrings } from './strings';
import {
  blockId,
  closeFences,
  escapeBlock,
  escapeCell,
  linkAlias,
  truncateWords,
  yamlString,
} from './text';
import { assignPaths, safeFileName } from './file-names';
import { mindmap, pie, timeline, type DiagramSection } from './mermaid';
import { renderBase, renderCanvas, renderCsv, wantsCanvas } from './extras';

/**
 * Model → files. Both tools, four layouts, one set of rules (FORMAT.md). Every function here is
 * pure: the same model and options always give the same bytes.
 */

export const EXPORT_ROOT = 'Hamesh';
const SITES_DIR = `${EXPORT_ROOT}/Sites`;

export interface RenderOptions {
  flavor: ExportFlavor;
  lang: ExportLang;
  /** Chosen layouts by group key; a group without one uses its suggestion. */
  layouts: Readonly<Record<string, ExportLayout>>;
  now: Date;
  /** Notes that no longer have a place on their page (lost, or kept without one): each says so
   *  under what it was on, so nothing exported claims a place it no longer has. */
  placeless?: ReadonlySet<string>;
}

export interface RenderedFile {
  path: string;
  text: string;
}

interface Ctx {
  model: ExportModel;
  opts: RenderOptions;
  s: ExportStrings;
  obsidian: boolean;
  /** One page on its own: no other files exist to link to. */
  standalone: boolean;
  pagePaths: Map<string, string>;
  folderPaths: Map<string, string>;
  /** Lookups built once: a large library would otherwise be searched again for every note. */
  pageByNote: Map<string, ExportPage>;
  folderById: Map<string, ExportFolder>;
}

const MAP_MIN = 3;
const GLANCE_MIN = 2;
const QUOTE_CELL = 60;
const NOTE_CELL = 80;

export function layoutFor(
  model: ExportModel,
  groupKey: string,
  layouts: RenderOptions['layouts'],
): ExportLayout {
  return layouts[groupKey] ?? model.groups.find((g) => g.key === groupKey)?.suggested ?? 'notes';
}

// ---------- small pieces ----------

const isoDay = (iso: string) => iso.slice(0, 10);
const firstLine = (text: string) =>
  text
    .split(/\r?\n/)
    .find((l) => l.trim())
    ?.trim() ?? '';

/** A note's own words as a block of the file: structure escaped, code blocks closed. */
const noteText = (note: Note) => closeFences(escapeBlock(note.content));

function withBlockId(ctx: Ctx, text: string, note: Note): string {
  if (!ctx.obsidian) return text;
  const lines = text.split('\n');
  const last = lines[lines.length - 1].trim();
  return /^(```|~~~|\||[-*+] |\d+[.)] )/.test(last)
    ? `${text}\n\n^${blockId(note.id)}`
    : `${text} ^${blockId(note.id)}`;
}

function videoHref(note: Note, page: ExportPage): string {
  const a = note.anchor;
  if (a.type !== 'video') return page.url;
  const seconds = Math.max(0, Math.floor(a.timestamp));
  if (a.platform === 'youtube')
    return `https://youtu.be/${encodeURIComponent(a.videoId)}?t=${seconds}`;
  return note.originalUrl;
}

function elementWhat(note: Note): { tag: string; snippet: string } {
  if (note.anchor.type === 'video' || note.anchor.type === 'text') return { tag: '', snippet: '' };
  const signals = note.anchor.signals;
  return {
    tag: signals.tagName?.toLowerCase() ?? '',
    snippet: signals.textSnippet ?? signals.alt ?? signals.ariaLabel ?? '',
  };
}

/** What a note sits on, in a few words: its quote, its element, or its time. */
function onLabel(ctx: Ctx, note: Note): string {
  const a = note.anchor;
  if (a.type === 'text') return truncateWords(a.exact, QUOTE_CELL);
  if (a.type === 'video') return formatVideoTimestamp(a.timestamp);
  const { tag, snippet } = elementWhat(note);
  return truncateWords(snippet ? `${tag} · ${snippet}` : tag || ctx.s.element, QUOTE_CELL);
}

function relative(fromFile: string, toFile: string): string {
  const from = fromFile.split('/').slice(0, -1);
  const to = toFile.split('/');
  let common = 0;
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) common++;
  const up = from.slice(common).map(() => '..');
  return [...up, ...to.slice(common)].map(encodeURIComponent).join('/');
}

function link(
  ctx: Ctx,
  fromFile: string,
  toPath: string | undefined,
  alias: string,
  inTable: boolean,
): string {
  const text = linkAlias(alias);
  if (ctx.standalone || !toPath) return inTable ? escapeCell(text) : text;
  if (ctx.obsidian) return `[[${toPath}${inTable ? '\\|' : '|'}${text}]]`;
  return `[${text}](${relative(fromFile, `${toPath}.md`)})`;
}

function table(header: string[], rows: string[][]): string {
  return [
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

function frontmatter(entries: [string, string | number | string[] | undefined][]): string {
  const lines = ['---'];
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`, ...value.map((v) => `  - ${yamlString(v)}`));
    } else lines.push(`${key}: ${typeof value === 'number' ? value : yamlString(value)}`);
  }
  lines.push('---');
  return lines.join('\n');
}

const footer = (ctx: Ctx) => `---\n\n${ctx.s.footer(ctx.s.date(ctx.opts.now.toISOString()))}`;

/** The line under a note's quote or element when it has no place on its page any more. */
function placelessLine(ctx: Ctx, note: Note): string[] {
  return ctx.opts.placeless?.has(note.id) ? [`*⚠ ${ctx.s.noPlace}*`, ''] : [];
}

function quote(ctx: Ctx, label: string, text: string): string {
  const body = text
    .split(/\r?\n/)
    .map((l) => `> ${escapeBlock(l)}`)
    .join('\n');
  return ctx.obsidian ? `> [!quote] ${label}\n${body}` : body;
}

function elementBlock(ctx: Ctx, note: Note): string {
  const { tag, snippet } = elementWhat(note);
  const what = snippet
    ? `\`${tag}\` · "${escapeCell(truncateWords(snippet, QUOTE_CELL))}"`
    : `\`${tag}\``;
  return ctx.obsidian
    ? `> [!example] ${ctx.s.onAnElement(tag)}\n> ${what}`
    : `**${ctx.s.onAnElement(tag)}** · ${what}`;
}

function teamOf(page: ExportPage): string | undefined {
  return page.notes.find((n) => n.team)?.team?.name;
}

// ---------- page ----------

function pageHeader(ctx: Ctx, page: ExportPage, path: string, layout: ExportLayout): string[] {
  const { s } = ctx;
  const duration = page.duration ? formatVideoTimestamp(page.duration) : undefined;
  const folders = page.folderIds
    .map((id) => ctx.model.folders.find((f) => f.id === id))
    .filter((f): f is ExportFolder => !!f);
  const team = teamOf(page);
  const out: string[] = [];
  if (ctx.obsidian) {
    out.push(
      frontmatter([
        ['title', page.title],
        ['source', page.url],
        ['site', page.site],
        ['kind', page.kind],
        ['layout', layout],
        ['duration', duration],
        ['notes', page.notes.length],
        ['created', isoDay(page.created)],
        ['updated', isoDay(page.updated)],
        [
          'folders',
          folders.map((f) =>
            ctx.standalone
              ? f.path.join(' / ')
              : link(ctx, path, ctx.folderPaths.get(f.id), f.path.join(' / '), false),
          ),
        ],
        ['shared_with', team],
        ['tags', ['hamesh', `hamesh/${page.kind}`, `hamesh/${layout}`]],
      ]),
      '',
    );
  }
  out.push(`# ${escapeBlock(page.title)}`, '');
  const open = `[${page.kind === 'video' ? s.openVideo : s.openPage}](${page.url})`;
  if (ctx.obsidian) {
    const facts = [open, s.notesCount(page.notes.length), s.lastWritten(s.date(page.updated))];
    if (team) facts.push(s.sharedWith(team));
    out.push(`> [!info] ${s.rootTitle}`, `> ${facts.join(' · ')}`);
    if (!ctx.standalone && wantsCanvas(page, layout)) {
      out.push(`> ${s.onCanvas}: [[${path.replace(/\.md$/, '')}.canvas|${linkAlias(page.title)}]]`);
    }
    out.push('');
  } else {
    const rows: string[][] = [
      [s.source, `[${escapeCell(page.site)}](${page.url})`],
      [s.kindLabel, duration ? `${s.kind[page.kind]} · ${duration}` : s.kind[page.kind]],
      [s.colLayout, s.layout[layout]],
      [s.colNotes, String(page.notes.length)],
      [s.colLastWritten, s.date(page.updated)],
    ];
    if (folders.length) {
      rows.push([
        s.folder,
        folders
          .map((f) => link(ctx, path, ctx.folderPaths.get(f.id), f.path.join(' / '), true))
          .join(', '),
      ]);
    }
    if (team) rows.push([s.sharedWith(''), escapeCell(team)]);
    out.push(table([s.property, s.value], rows), '');
  }
  return out;
}

function diagramSections(page: ExportPage, label: (n: Note) => string): DiagramSection[] {
  return page.sections.map((section) => ({
    title: section.title,
    items: section.notes.map((n) => ({ label: label(n) })),
  }));
}

const mapLabel = (n: Note) =>
  n.anchor.type === 'text' && isTermPair(n)
    ? `${n.anchor.exact} → ${n.content}`
    : firstLine(n.content);

function momentLabel(ctx: Ctx, n: Note): string {
  return n.anchor.type === 'video'
    ? `${formatVideoTimestamp(n.anchor.timestamp)} · ${firstLine(n.content)}`
    : `${ctx.s.date(n.createdAt)} · ${firstLine(n.content)}`;
}

function noteBody(ctx: Ctx, page: ExportPage, note: Note): string[] {
  const a = note.anchor;
  const out: string[] = [];
  if (a.type === 'text') out.push(quote(ctx, ctx.s.onThePage, a.exact), '');
  else if (a.type === 'video')
    out.push(`### [▶ ${formatVideoTimestamp(a.timestamp)}](${videoHref(note, page)})`, '');
  else out.push(elementBlock(ctx, note), '');
  out.push(...placelessLine(ctx, note));
  out.push(withBlockId(ctx, noteText(note), note), '');
  return out;
}

function renderNotesLayout(ctx: Ctx, page: ExportPage): string[] {
  const { s } = ctx;
  const out: string[] = [];
  const titled = page.sections.some((sec) => sec.title);
  if (page.notes.length >= MAP_MIN) {
    out.push(`## ${s.mapOfPage}`, '', mindmap(page.title, diagramSections(page, mapLabel)), '');
  }
  if (page.notes.length >= GLANCE_MIN) {
    const header = titled
      ? [s.colNumber, s.colSection, s.colOn, s.colNote]
      : [s.colNumber, s.colOn, s.colNote];
    let i = 0;
    const rows = page.sections.flatMap((sec) =>
      sec.notes.map((n) => {
        i += 1;
        const on = escapeCell(onLabel(ctx, n));
        const note = escapeCell(truncateWords(n.content, NOTE_CELL));
        return titled ? [String(i), escapeCell(sec.title ?? ''), on, note] : [String(i), on, note];
      }),
    );
    out.push(`## ${s.atAGlance}`, '', table(header, rows), '');
  }
  for (const sec of page.sections) {
    out.push(`## ${escapeBlock(sec.title ?? s.notes)}`, '');
    for (const n of sec.notes) out.push(...noteBody(ctx, page, n));
  }
  return out;
}

function renderTimelineLayout(ctx: Ctx, page: ExportPage): string[] {
  const { s } = ctx;
  const isVideo = page.kind === 'video';
  // A page that is not a video reads in the order it was written.
  const sections = isVideo
    ? page.sections
    : [
        {
          title: null,
          notes: [...page.notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        },
      ];
  const titled = sections.some((sec) => sec.title);
  const out: string[] = [];
  if (page.notes.length >= MAP_MIN) {
    out.push(
      `## ${s.timeline}`,
      '',
      timeline(
        sections.map((sec) => ({
          title: sec.title,
          items: sec.notes.map((n) => ({ label: momentLabel(ctx, n) })),
        })),
      ),
      '',
    );
  }
  if (page.notes.length >= GLANCE_MIN) {
    const when = (n: Note) =>
      n.anchor.type === 'video'
        ? `[${formatVideoTimestamp(n.anchor.timestamp)}](${videoHref(n, page)})`
        : escapeCell(s.date(n.createdAt));
    const header = [
      isVideo ? s.colTime : s.colWritten,
      ...(titled ? [s.colChapter] : []),
      s.colNote,
    ];
    const rows = sections.flatMap((sec) =>
      sec.notes.map((n) => [
        when(n),
        ...(titled ? [escapeCell(sec.title ?? '')] : []),
        escapeCell(truncateWords(n.content, NOTE_CELL)),
      ]),
    );
    out.push(`## ${s.atAGlance}`, '', table(header, rows), '');
  }
  for (const sec of sections) {
    out.push(`## ${escapeBlock(sec.title ?? s.notes)}`, '');
    for (const n of sec.notes) {
      if (n.anchor.type === 'video') out.push(...noteBody(ctx, page, n));
      else {
        out.push(`### ${s.date(n.createdAt)}`, '');
        if (n.anchor.type === 'text') out.push(quote(ctx, s.onThePage, n.anchor.exact), '');
        else out.push(elementBlock(ctx, n), '');
        out.push(...placelessLine(ctx, n));
        out.push(withBlockId(ctx, noteText(n), n), '');
      }
    }
  }
  return out;
}

/** The quote inside the words around it, as they stood on the page: the stored context is cut
 *  mid-word at both ends, so the partial words are dropped, and the spacing and punctuation
 *  next to the quote are kept exactly. */
function contextOf(note: Note): string {
  if (note.anchor.type !== 'text') return '';
  const { prefix, suffix } = note.anchor.context;
  const before = prefix.replace(/\s+/g, ' ').replace(/^\S*\s/, '');
  const after = suffix.replace(/\s+/g, ' ').replace(/\s\S*$/, '');
  return `…${before}**${note.anchor.exact.trim()}**${after}…`;
}

function renderGlossaryLayout(ctx: Ctx, page: ExportPage): string[] {
  const { s } = ctx;
  const terms = page.notes.filter((n) => n.anchor.type === 'text');
  const others = page.notes.filter((n) => n.anchor.type !== 'text');
  const out: string[] = [];
  if (terms.length) {
    const rows = terms.map((n) => [
      escapeCell(n.anchor.type === 'text' ? n.anchor.exact : ''),
      escapeCell(n.content),
      escapeCell(ctx.opts.placeless?.has(n.id) ? `⚠ ${s.noPlace}` : contextOf(n)),
    ]);
    out.push(`## ${s.glossary}`, '', table([s.colWord, s.colMeaning, s.colContext], rows), '');
  }
  if (others.length) {
    out.push(`## ${s.otherNotes}`, '');
    for (const n of others) out.push(...noteBody(ctx, page, n));
  }
  return out;
}

function renderChecklistLayout(ctx: Ctx, page: ExportPage): string[] {
  const out: string[] = [`## ${ctx.s.toDo}`, ''];
  for (const n of page.notes) out.push(...taskItem(ctx, n, page, undefined));
  out.push('');
  return out;
}

function taskItem(ctx: Ctx, n: Note, page: ExportPage, pageLink: string | undefined): string[] {
  const [head, ...rest] = noteText(n).split('\n');
  const suffix = pageLink ? ` — ${pageLink}` : '';
  const lines = [`- [ ] ${head}${suffix}${ctx.obsidian ? ` ^${blockId(n.id)}` : ''}`];
  for (const line of rest) lines.push(`  ${line}`);
  const a = n.anchor;
  if (a.type === 'text') lines.push(`  > ${escapeBlock(truncateWords(a.exact, 140))}`);
  else if (a.type === 'video')
    lines.push(`  [▶ ${formatVideoTimestamp(a.timestamp)}](${videoHref(n, page)})`);
  else lines.push(`  ${onLabel(ctx, n)}`);
  if (a.type !== 'video' && ctx.opts.placeless?.has(n.id)) lines.push(`  *⚠ ${ctx.s.noPlace}*`);
  return lines;
}

function renderPage(ctx: Ctx, page: ExportPage, path: string): string {
  const layout = layoutFor(ctx.model, page.groupKey, ctx.opts.layouts);
  const out = pageHeader(ctx, page, path, layout);
  if (layout === 'glossary') out.push(...renderGlossaryLayout(ctx, page));
  else if (layout === 'timeline') out.push(...renderTimelineLayout(ctx, page));
  else if (layout === 'checklist') out.push(...renderChecklistLayout(ctx, page));
  else out.push(...renderNotesLayout(ctx, page));
  out.push(footer(ctx), '');
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ---------- folders and overview ----------

function pageOfNote(ctx: Ctx, note: Note): ExportPage {
  return ctx.pageByNote.get(note.id)!;
}

function renderFolder(ctx: Ctx, folder: ExportFolder, path: string): string {
  const { s } = ctx;
  const layout = layoutFor(ctx.model, `folder:${folder.id}`, ctx.opts.layouts);
  const out: string[] = [];
  if (ctx.obsidian) {
    out.push(
      frontmatter([
        ['title', folder.name],
        ['folder_path', folder.path.join(' / ')],
        ['layout', layout],
        ['tags', ['hamesh', 'hamesh/folder']],
      ]),
      '',
    );
  }
  out.push(`# ${escapeBlock(folder.name)}`, '');
  if (folder.parentId && ctx.folderPaths.has(folder.parentId)) {
    const parent = ctx.model.folders.find((f) => f.id === folder.parentId)!;
    out.push(
      `${s.inside} ${link(ctx, path, ctx.folderPaths.get(parent.id), parent.path.join(' / '), false)}`,
      '',
    );
  }
  if (folder.childIds.length) {
    out.push(`## ${s.subfolders}`, '');
    for (const id of folder.childIds) {
      const child = ctx.model.folders.find((f) => f.id === id)!;
      out.push(`- ${link(ctx, path, ctx.folderPaths.get(id), child.name, false)}`);
    }
    out.push('');
  }
  const notes = folder.notes;
  if (notes.length) {
    const pageLink = (n: Note) => {
      const page = pageOfNote(ctx, n);
      return link(ctx, path, ctx.pagePaths.get(page.id), truncateWords(page.title, 50), true);
    };
    out.push(`## ${s.notesCount(notes.length)}`, '');
    if (layout === 'glossary') {
      const sorted = [...notes].sort((a, b) => onLabel(ctx, a).localeCompare(onLabel(ctx, b)));
      out.push(
        table(
          [s.colWord, s.colMeaning, s.colPage],
          sorted.map((n) => [escapeCell(onLabel(ctx, n)), escapeCell(n.content), pageLink(n)]),
        ),
      );
    } else if (layout === 'timeline') {
      for (const n of [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
        const page = pageOfNote(ctx, n);
        const when =
          n.anchor.type === 'video'
            ? `[▶ ${formatVideoTimestamp(n.anchor.timestamp)}](${videoHref(n, page)})`
            : s.date(n.createdAt);
        out.push(
          `- ${when} · ${escapeCell(truncateWords(n.content, NOTE_CELL))} — ${pageLink(n).replace(/\\\|/g, '|')}`,
        );
      }
    } else if (layout === 'checklist') {
      for (const n of notes)
        out.push(...taskItem(ctx, n, pageOfNote(ctx, n), pageLink(n).replace(/\\\|/g, '|')));
    } else {
      out.push(
        table(
          [s.colOn, s.colNote, s.colPage],
          notes.map((n) => [
            escapeCell(onLabel(ctx, n)),
            escapeCell(truncateWords(n.content, NOTE_CELL)),
            pageLink(n),
          ]),
        ),
      );
    }
    out.push('');
  }
  out.push(footer(ctx), '');
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

function renderOverview(ctx: Ctx, path: string): string {
  const { s, model } = ctx;
  const scopeFolder =
    model.scope.kind === 'folder'
      ? model.folders.find((f) => f.id === (model.scope as { folderId: string }).folderId)
      : undefined;
  const title = scopeFolder ? scopeFolder.name : s.rootTitle;
  const out: string[] = [];
  if (ctx.obsidian) {
    out.push(
      frontmatter([
        ['title', title],
        ['exported', isoDay(ctx.opts.now.toISOString())],
        ['pages', model.pages.length],
        ['notes', model.noteCount],
        ['tags', ['hamesh']],
      ]),
      '',
    );
  }
  out.push(`# ${escapeBlock(title)}`, '');
  out.push(
    ctx.obsidian
      ? `> [!warning] ${s.ownedTitle}\n> ${s.ownedBody(EXPORT_ROOT)}`
      : s.ownedBody(EXPORT_ROOT),
    '',
  );
  out.push(`${s.pagesCount(model.pages.length)} · ${s.notesCount(model.noteCount)}`, '');

  const bySite = new Map<string, number>();
  for (const p of model.pages) bySite.set(p.site, (bySite.get(p.site) ?? 0) + p.notes.length);
  if (bySite.size >= 2) {
    const slices = [...bySite]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));
    out.push(`## ${s.whereNotesAre}`, '', pie(s.notesPerSite, slices), '');
  }

  const pages = [...model.pages].sort(
    (a, b) => b.updated.localeCompare(a.updated) || a.id.localeCompare(b.id),
  );
  out.push(
    `## ${s.pages}`,
    '',
    table(
      [s.colPage, s.colSite, s.colLayout, s.colNotes, s.colLastWritten],
      pages.map((p) => [
        link(ctx, path, ctx.pagePaths.get(p.id), truncateWords(p.title, 60), true),
        escapeCell(p.site),
        s.layout[layoutFor(model, p.groupKey, ctx.opts.layouts)],
        String(p.notes.length),
        isoDay(p.updated),
      ]),
    ),
    '',
  );

  if (model.folders.length) {
    const subtreeCount = (f: ExportFolder): number =>
      f.notes.length +
      f.childIds.reduce((sum, id) => sum + subtreeCount(ctx.folderById.get(id)!), 0);
    const roots = model.folders.filter(
      (f) => !f.parentId || !model.folders.some((p) => p.id === f.parentId),
    );
    const walk = (f: ExportFolder, depth: number) => {
      out.push(
        `${'  '.repeat(depth)}- ${link(ctx, path, ctx.folderPaths.get(f.id), f.name, false)} · ${s.notesCount(subtreeCount(f))}`,
      );
      for (const id of f.childIds) walk(ctx.folderById.get(id)!, depth + 1);
    };
    out.push(`## ${s.folders}`, '');
    roots.forEach((f) => walk(f, 0));
    out.push('');
  }

  if (ctx.obsidian) out.push(`## ${s.liveTable}`, '', `![[${EXPORT_ROOT}/Hamesh notes.base]]`, '');
  else out.push(s.csvHint('Hamesh notes.csv'), '');
  out.push(footer(ctx), '');
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ---------- entry points ----------

function context(model: ExportModel, opts: RenderOptions, standalone: boolean): Ctx {
  const pagePaths = assignPaths(
    model.pages.map((p) => ({
      id: p.id,
      dir: `${SITES_DIR}/${safeFileName(p.site)}`,
      name: p.title,
      tiebreak: p.notes[0].id.slice(0, 4),
      order: p.created,
    })),
  );
  // Parents first, so each folder is named inside its parent's final path; two siblings whose
  // names come out the same once made safe ("C#" and "C") get told apart like pages do.
  const folderPaths = new Map<string, string>();
  const depths = [...new Set(model.folders.map((f) => f.path.length))].sort((a, b) => a - b);
  for (const depth of depths) {
    const level = assignPaths(
      model.folders
        .filter((f) => f.path.length === depth)
        .map((f) => ({
          id: f.id,
          dir: (f.parentId && folderPaths.get(f.parentId)) || `${EXPORT_ROOT}/Folders`,
          name: f.name,
          tiebreak: f.id.slice(0, 4),
          order: f.path.join('/'),
        })),
    );
    for (const [id, path] of level) folderPaths.set(id, path);
  }
  return {
    model,
    opts,
    s: exportStrings(opts.lang),
    obsidian: opts.flavor === 'obsidian',
    standalone,
    pagePaths,
    folderPaths,
    pageByNote: new Map(model.pages.flatMap((p) => p.notes.map((n) => [n.id, p] as const))),
    folderById: new Map(model.folders.map((f) => [f.id, f])),
  };
}

/** Every file of a vault-style export: pages, folders, an overview and the tool's extras. */
export function renderExport(model: ExportModel, opts: RenderOptions): RenderedFile[] {
  const ctx = context(model, opts, false);
  const files: RenderedFile[] = [];
  const overviewPath = `${EXPORT_ROOT}/${ctx.s.overviewFile}`;
  files.push({ path: `${overviewPath}.md`, text: renderOverview(ctx, `${overviewPath}.md`) });
  for (const page of model.pages) {
    const path = ctx.pagePaths.get(page.id)!;
    files.push({ path: `${path}.md`, text: renderPage(ctx, page, `${path}.md`) });
    const layout = layoutFor(model, page.groupKey, opts.layouts);
    if (ctx.obsidian && wantsCanvas(page, layout)) {
      files.push({ path: `${path}.canvas`, text: renderCanvas(page, path) });
    }
  }
  for (const folder of model.folders) {
    const path = ctx.folderPaths.get(folder.id)!;
    files.push({ path: `${path}.md`, text: renderFolder(ctx, folder, `${path}.md`) });
  }
  if (ctx.obsidian)
    files.push({ path: `${EXPORT_ROOT}/Hamesh notes.base`, text: renderBase(ctx.s, SITES_DIR) });
  else files.push({ path: `${EXPORT_ROOT}/Hamesh notes.csv`, text: renderCsv(model, ctx.s) });
  return files;
}

/** One page as a single Markdown file, for Copy or a plain `.md` download. */
export function renderSinglePage(
  model: ExportModel,
  pageId: string,
  opts: RenderOptions,
): RenderedFile {
  const ctx = context(model, opts, true);
  const page = model.pages.find((p) => p.id === pageId);
  if (!page) throw new Error('That page is not in this export');
  return {
    path: `${safeFileName(page.title)}.md`,
    text: renderPage(ctx, page, `${safeFileName(page.title)}.md`),
  };
}
