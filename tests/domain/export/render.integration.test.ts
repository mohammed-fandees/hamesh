// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import mermaid from 'mermaid';
import { buildExportModel } from '@/domain/export/model';
import { renderExport } from '@/domain/export/render';
import { EXPORT_LAYOUTS } from '@/domain/export/layout';
import { realisticLibrary } from './fixtures';

/** Splits a table row into cells, ignoring escaped pipes. */
const cells = (row: string) => row.replace(/\\\|/g, '').split('|').length;

function tablesOf(text: string): string[][] {
  const tables: string[][] = [];
  let current: string[] | null = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('|')) (current ??= []).push(line);
    else if (current) {
      tables.push(current);
      current = null;
    }
  }
  if (current) tables.push(current);
  return tables;
}

const diagramsOf = (text: string) =>
  [...text.matchAll(/```mermaid\n([\s\S]*?)\n```/g)].map((m) => m[1]);

describe('a whole export, every tool, language and layout', () => {
  const { notes, folders } = realisticLibrary();
  const model = buildExportModel(notes, folders, { kind: 'all' });
  const now = new Date('2026-11-20T12:00:00Z');

  for (const flavor of ['obsidian', 'notion'] as const) {
    for (const lang of ['en', 'ar'] as const) {
      for (const forced of [undefined, ...EXPORT_LAYOUTS]) {
        const layouts = forced ? Object.fromEntries(model.groups.map((g) => [g.key, forced])) : {};
        it(`${flavor} · ${lang} · ${forced ?? 'suggested'}`, async () => {
          const files = renderExport(model, { flavor, lang, layouts, now });
          for (const file of files.filter((f) => f.path.endsWith('.md'))) {
            for (const t of tablesOf(file.text)) {
              const width = cells(t[0]);
              for (const row of t) expect(cells(row), `${file.path}: ${row}`).toBe(width);
            }
            for (const d of diagramsOf(file.text))
              await expect(mermaid.parse(d)).resolves.toBeTruthy();
            expect(file.text.endsWith('*\n')).toBe(true);
          }
          for (const file of files.filter((f) => f.path.endsWith('.canvas'))) {
            expect(() => JSON.parse(file.text)).not.toThrow();
          }
          const paths = files.map((f) => f.path);
          expect(new Set(paths).size).toBe(paths.length);
        });
      }
    }
  }
});
