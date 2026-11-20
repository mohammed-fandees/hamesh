import type { Note } from '../note';
import { formatVideoTimestamp } from '../video-markers';
import type { ExportLayout } from './layout';
import type { ExportModel, ExportPage } from './model';
import type { ExportStrings } from './strings';
import { truncateWords } from './text';

/** The files each tool gets beyond Markdown: an Obsidian canvas and base, a Notion CSV. */

const CANVAS_MIN = 3;

/** A canvas helps when a page has several notes on its words or elements, laid out as notes. */
export function wantsCanvas(page: ExportPage, layout: ExportLayout): boolean {
  return (
    layout === 'notes' &&
    page.kind !== 'video' &&
    page.notes.filter((n) => n.anchor.type !== 'video').length >= CANVAS_MIN
  );
}

function blockId(note: Note): string {
  return `hm-${note.id
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toLowerCase()}`;
}

/** JSON Canvas (jsoncanvas.org): the page on top, its notes below in rows, one edge each. */
export function renderCanvas(page: ExportPage, pagePath: string): string {
  const W = 420;
  const H = 220;
  const GAP = 40;
  const COLS = 3;
  const width = COLS * W + (COLS - 1) * GAP;
  const nodes: Record<string, unknown>[] = [
    {
      id: 'page',
      type: 'file',
      file: `${pagePath}.md`,
      x: -W / 2,
      y: -360,
      width: W,
      height: 160,
      color: '6',
    },
  ];
  const edges: Record<string, unknown>[] = [];
  page.notes.forEach((note, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const quote =
      note.anchor.type === 'text' ? `> ${truncateWords(note.anchor.exact, 160)}\n\n` : '';
    nodes.push({
      id: `n${i + 1}`,
      type: 'text',
      text: `${quote}${note.content}\n\n[[${pagePath}#^${blockId(note)}|↗]]`,
      x: -width / 2 + col * (W + GAP),
      y: row * (H + GAP),
      width: W,
      height: H,
    });
    edges.push({
      id: `e${i + 1}`,
      fromNode: 'page',
      fromSide: 'bottom',
      toNode: `n${i + 1}`,
      toSide: 'top',
    });
  });
  return `${JSON.stringify({ nodes, edges }, null, 2)}\n`;
}

/** An Obsidian Base over every exported page: a live table to sort and filter. */
export function renderBase(s: ExportStrings): string {
  return [
    'filters:',
    '  and:',
    '    - file.hasTag("hamesh")',
    '    - file.inFolder("Hamesh/Sites")',
    'properties:',
    '  note.site:',
    `    displayName: ${JSON.stringify(s.colSite)}`,
    '  note.layout:',
    `    displayName: ${JSON.stringify(s.colLayout)}`,
    '  note.notes:',
    `    displayName: ${JSON.stringify(s.colNotes)}`,
    '  note.updated:',
    `    displayName: ${JSON.stringify(s.colLastWritten)}`,
    'views:',
    '  - type: table',
    `    name: ${JSON.stringify(s.pages)}`,
    '    order:',
    '      - file.name',
    '      - site',
    '      - kind',
    '      - layout',
    '      - notes',
    '      - updated',
    '    sort:',
    '      - property: updated',
    '        direction: DESC',
    '',
  ].join('\n');
}

const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Every note as one row, ready to import into Notion as a database. Starts with a BOM so a
 *  spreadsheet opens Arabic correctly; a cell that a spreadsheet would run is made text. */
export function renderCsv(model: ExportModel, s: ExportStrings): string {
  const header = [
    s.colNote,
    s.colPage,
    s.colSite,
    s.colOn,
    s.colSection,
    s.colTime,
    s.source,
    s.folder,
    s.colWritten,
    s.colLastWritten,
  ];
  const rows = model.pages.flatMap((page) =>
    page.notes.map((note) => {
      const a = note.anchor;
      const folder = model.folders.find((f) => f.id === note.folderId)?.path.join(' / ') ?? '';
      const section = (a.type === 'video' ? note.capture?.chapter : note.capture?.section) ?? '';
      return [
        note.content,
        page.title,
        page.site,
        a.type === 'text' ? a.exact : a.type === 'video' ? '' : a.signals.tagName,
        section,
        a.type === 'video' ? formatVideoTimestamp(a.timestamp) : '',
        note.originalUrl,
        folder,
        note.createdAt,
        note.updatedAt,
      ];
    }),
  );
  return `\uFEFF${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
