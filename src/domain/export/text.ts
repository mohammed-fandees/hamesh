/**
 * The small string rules every exported file follows (docs/plans/markdown-export/FORMAT.md).
 * The person's own words are kept as they wrote them; only what would turn into Markdown
 * structure, break a table, a link or a diagram is touched.
 */

const BLOCK_START = /^(\s*)(#|>|-(?!-{2})|\+|\*|\d+[.)]|---)/;

/** A note's text, safe to place as a paragraph: a line that would become a heading, quote,
 *  list or rule gets a backslash in front. Line breaks stay. */
export function escapeBlock(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(BLOCK_START, '$1\\$2'))
    .join('\n');
}

/** Text for one table cell: no line breaks, no bare pipes. */
export function escapeCell(text: string): string {
  return text
    .replace(/\s*\r?\n\s*/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

/** Whitespace folded and cut on a word boundary, with `…` when anything was cut. */
export function truncateWords(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const room = flat.slice(0, max - 1);
  const space = room.lastIndexOf(' ');
  const cut = space >= max * 0.6 ? room.slice(0, space) : room;
  return `${cut.trimEnd()}…`;
}

/** A YAML scalar that can never change type: a JSON string is a valid YAML string. */
export function yamlString(value: string): string {
  return JSON.stringify(value);
}

/** A Mermaid node label: characters that open or close a shape, start a comment or end a
 *  statement are dropped, then the label is cut. Never empty. */
export function mermaidLabel(text: string, max = 44): string {
  return truncateWords(text.replace(/["()[\]{}<>`#;|%]/g, ' '), max) || '·';
}

/** The visible text of a link: it may hold no `|` (ends an Obsidian alias, splits a table)
 *  and no brackets (end a link). */
export function linkAlias(text: string): string {
  return text.replace(/\|/g, '–').replace(/[[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The script a text is mostly written in, by its letters. */
export function dominantScript(text: string): 'arabic' | 'latin' | 'none' {
  const arabic = (text.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) ?? [])
    .length;
  const latin = (text.match(/[A-Za-z\u00C0-\u024F]/g) ?? []).length;
  if (arabic === 0 && latin === 0) return 'none';
  return arabic >= latin ? 'arabic' : 'latin';
}

/** A word count that works for Arabic and English alike. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
