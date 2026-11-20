import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildExportModel } from '@/domain/export/model';
import { renderCanvas, renderCsv, wantsCanvas } from '@/domain/export/extras';
import { exportStrings } from '@/domain/export/strings';
import { toZip } from '@/domain/export/archive';
import { textNote, videoNote } from './fixtures';

describe('canvas', () => {
  const notes = [1, 2, 3].map((i) => textNote({ start: i, exact: `q${i}`, content: `n${i}` }));
  const [page] = buildExportModel(notes, [], { kind: 'all' }).pages;

  it('is JSON Canvas: the page, one card and one edge per note', () => {
    const canvas = JSON.parse(renderCanvas(page, 'Hamesh/Sites/x/Page'));
    expect(canvas.nodes).toHaveLength(4);
    expect(canvas.nodes[0]).toMatchObject({ type: 'file', file: 'Hamesh/Sites/x/Page.md' });
    expect(canvas.edges).toHaveLength(3);
    expect(canvas.nodes[1].text).toMatch(/^> q1\n\nn1\n\n\[\[Hamesh\/Sites\/x\/Page#\^hm-/);
  });

  it('is only made for three notes or more, laid out as notes, not for videos', () => {
    expect(wantsCanvas(page, 'notes')).toBe(true);
    expect(wantsCanvas(page, 'glossary')).toBe(false);
    const video = buildExportModel(
      [1, 2, 3].map((t) => videoNote({ timestamp: t })),
      [],
      { kind: 'all' },
    );
    expect(wantsCanvas(video.pages[0], 'notes')).toBe(false);
  });
});

describe('csv', () => {
  it('starts with a BOM, quotes what needs quoting, and never runs a formula', () => {
    const model = buildExportModel(
      [
        textNote({ content: '=HYPERLINK("x")', exact: 'a, "b"' }),
        textNote({ content: 'سطر\nثاني', start: 9 }),
      ],
      [],
      { kind: 'all' },
    );
    const csv = renderCsv(model, exportStrings('en'));
    expect(csv.startsWith('\uFEFFNote,Page,')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"a, ""b"""');
    expect(csv).toContain('"سطر\nثاني"');
  });
});

describe('zip', () => {
  it('keeps every path and byte', () => {
    const files = [
      { path: 'Hamesh/نظرة عامة.md', text: '# هامش\n' },
      { path: 'Hamesh/Sites/maktaba.site/The Book of Optics – Maktaba.md', text: 'x' },
    ];
    const out = unzipSync(toZip(files));
    expect(Object.keys(out).sort()).toEqual(files.map((f) => f.path).sort());
    expect(strFromU8(out['Hamesh/نظرة عامة.md'])).toBe('# هامش\n');
  });

  it('gives the same bytes for the same files', () => {
    const files = [{ path: 'a/b.md', text: 'x' }];
    expect(toZip(files)).toEqual(toZip(files));
  });

  it('refuses a path that climbs out', () => {
    expect(() => toZip([{ path: 'Hamesh/../evil.md', text: '' }])).toThrow(/unsafe path/);
    expect(() => toZip([{ path: '/abs.md', text: '' }])).toThrow(/unsafe path/);
  });
});
