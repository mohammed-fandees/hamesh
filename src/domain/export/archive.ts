import { strToU8, zipSync, type Zippable } from 'fflate';
import type { RenderedFile } from './render';

/** A path we wrote ourselves, checked anyway: nothing in a zip may climb out of its folder. */
function assertSafePath(path: string): void {
  const parts = path.split('/');
  if (
    path.startsWith('/') ||
    parts.some((p) => p === '' || p === '.' || p === '..') ||
    path.includes('\\')
  ) {
    throw new Error(`Refusing an unsafe path in an export: ${path}`);
  }
}

/** Files into one zip. Text is UTF-8, dates are fixed so the same export gives the same bytes. */
export function toZip(files: readonly RenderedFile[]): Uint8Array {
  const entries: Zippable = {};
  const mtime = new Date('2026-01-01T00:00:00Z');
  for (const file of files) {
    assertSafePath(file.path);
    entries[file.path] = [strToU8(file.text), { mtime }];
  }
  return zipSync(entries, { level: 6 });
}
