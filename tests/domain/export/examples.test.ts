import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { buildExportModel } from '@/domain/export/model';
import { renderExport } from '@/domain/export/render';
import { realisticLibrary } from './fixtures';

/**
 * The examples in the plan folder are the renderer's own output for the fixture library. If the
 * renderer changes, these change with it, on purpose: regenerate them and review the diff.
 */
const ROOT = resolve(__dirname, '../../../docs/plans/markdown-export/examples');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

describe('the examples in the plan', () => {
  const { notes, folders } = realisticLibrary();
  const model = buildExportModel(notes, folders, { kind: 'all' });
  const now = new Date('2026-11-20T12:00:00Z');

  for (const [flavor, lang] of [
    ['obsidian', 'en'],
    ['notion', 'ar'],
  ] as const) {
    it(`are exactly what the renderer writes for ${flavor}`, () => {
      const rendered = new Map(
        renderExport(model, { flavor, lang, layouts: {}, now }).map((f) => [f.path, f.text]),
      );
      const dir = join(ROOT, flavor);
      const onDisk = new Map(
        filesUnder(dir).map((full) => [
          relative(dir, full).split(sep).join('/'),
          readFileSync(full, 'utf8'),
        ]),
      );
      expect([...onDisk.keys()].sort()).toEqual([...rendered.keys()].sort());
      // A Windows checkout may turn line endings into CRLF; the renderer always writes LF.
      for (const [path, text] of rendered) {
        expect(onDisk.get(path)?.replace(/\r\n/g, '\n'), path).toBe(text.replace(/\r\n/g, '\n'));
      }
    });
  }
});
