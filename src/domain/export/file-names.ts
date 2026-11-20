/**
 * File and folder names that every system accepts and that stay the same from one export to
 * the next, so exporting again replaces files instead of piling up copies.
 */

const FORBIDDEN = /[\\/:*?"<>|#^[\]]/g;
const DEVICE_NAMES = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
export const FILE_NAME_MAX = 80;

export function safeFileName(raw: string, max = FILE_NAME_MAX): string {
  let name = raw
    .replace(FORBIDDEN, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .trim();
  if (name.length > max) name = name.slice(0, max).trim().replace(/\.+$/, '');
  if (!name || DEVICE_NAMES.test(name)) name = `_${name || 'untitled'}`;
  return name;
}

export interface NamedItem {
  /** Stable id of the thing being named (a page). */
  id: string;
  /** Folder the file goes in, already safe. */
  dir: string;
  /** What the file should be called before it is made safe. */
  name: string;
  /** Short, stable text to tell two same-named items apart. */
  tiebreak: string;
  /** Sort key: the first-made item keeps the plain name. */
  order: string;
}

/** Paths without an extension, keyed by item id. A clash (same name, same folder, ignoring case)
 *  gets ` (tiebreak)` on every item after the first, so names never move between exports. */
export function assignPaths(items: readonly NamedItem[]): Map<string, string> {
  const taken = new Set<string>();
  const paths = new Map<string, string>();
  const sorted = [...items].sort(
    (a, b) => a.order.localeCompare(b.order) || a.id.localeCompare(b.id),
  );
  for (const item of sorted) {
    let name = safeFileName(item.name);
    let path = `${item.dir}/${name}`;
    if (taken.has(path.toLowerCase())) {
      const suffix = ` (${safeFileName(item.tiebreak)})`;
      name = `${safeFileName(item.name, FILE_NAME_MAX - suffix.length)}${suffix}`;
      path = `${item.dir}/${name}`;
    }
    taken.add(path.toLowerCase());
    paths.set(item.id, path);
  }
  return paths;
}
