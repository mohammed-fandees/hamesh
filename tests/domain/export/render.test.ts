import { describe, it, expect } from 'vitest';
import { buildExportModel, pageIdentity } from '@/domain/export/model';
import { renderExport, renderSinglePage, type RenderOptions } from '@/domain/export/render';
import { exportStrings } from '@/domain/export/strings';
import { textNote, videoNote, elementNote, folder, realisticLibrary } from './fixtures';

const NOW = new Date('2026-11-20T12:00:00Z');
const opts = (over: Partial<RenderOptions> = {}): RenderOptions => ({
  flavor: 'obsidian',
  lang: 'en',
  layouts: {},
  now: NOW,
  ...over,
});
const fileMap = (files: { path: string; text: string }[]) =>
  new Map(files.map((f) => [f.path, f.text]));

describe('export strings', () => {
  it('counts in Arabic the way Arabic counts', () => {
    const ar = exportStrings('ar');
    expect([1, 2, 3, 10, 11, 100].map(ar.notesCount)).toEqual([
      'ملاحظة واحدة',
      'ملاحظتان',
      '3 ملاحظات',
      '10 ملاحظات',
      '11 ملاحظة',
      '100 ملاحظة',
    ]);
  });

  it('writes Arabic dates with the digits Hamesh uses', () => {
    expect(exportStrings('ar').date('2026-08-22T12:00:00Z')).toBe('22 أغسطس 2026');
  });
});

describe('renderExport — Obsidian', () => {
  const { notes, folders } = realisticLibrary();
  const model = buildExportModel(notes, folders, { kind: 'all' });
  const files = fileMap(renderExport(model, opts()));
  const lifecycle = files.get(
    'Hamesh/Sites/maktaba.site/The Conditions of Renaissance – Maktaba.md',
  )!;

  it('writes properties as YAML that cannot change type', () => {
    expect(lifecycle).toMatch(/^---\ntitle: "The Conditions of Renaissance – Maktaba"\n/);
    expect(lifecycle).toContain('  - "[[Hamesh/Folders/Reading/Science|Reading / Science]]"');
  });

  it('links the canvas by its own name', () => {
    expect(lifecycle).toContain(
      '> On the canvas: [[Hamesh/Sites/maktaba.site/The Conditions of Renaissance – Maktaba.canvas|',
    );
  });

  it('writes quotes as callouts and gives every note a block id', () => {
    expect(lifecycle).toContain('> [!quote] On the page\n> civilization is creation;');
    expect(lifecycle).toMatch(/makes its products, never the reverse\. \^hm-[a-z0-9]{8}/);
  });

  it('keeps a note that is just "#2" as text', () => {
    const useState = files.get('Hamesh/Sites/maktaba.site/The Book of Optics – Maktaba.md')!;
    expect(useState).toMatch(/^\\#2 \^hm-/m);
  });

  it('draws a map for three notes or more, and a canvas beside it', () => {
    expect(lifecycle).toContain('```mermaid\nmindmap');
    expect(
      files.has('Hamesh/Sites/maktaba.site/The Conditions of Renaissance – Maktaba.canvas'),
    ).toBe(true);
  });

  it('ends every Markdown file with the Hamesh line', () => {
    for (const [path, text] of files) {
      if (path.endsWith('.md'))
        expect(text).toMatch(
          /\*Exported from \[Hamesh\]\(https:\/\/hamesh\.fandees\.tech\) · 20 November 2026\*\n$/,
        );
    }
  });

  it('writes no raw HTML', () => {
    for (const [path, text] of files)
      if (path.endsWith('.md')) expect(text).not.toMatch(/<\/?[a-z]+[^>]*>/i);
  });

  it('lays a vocabulary folder out as a glossary sorted A to Z', () => {
    const vocab = files.get('Hamesh/Folders/Bennabi - Vocab.md')!;
    const words = [...vocab.matchAll(/^\| ([a-z ]+) \| /gm)].map((m) => m[1]);
    expect(words).toEqual([
      'creation',
      'dependence',
      'house of wisdom',
      'imitation',
      'renaissance',
    ]);
  });

  it('lays podcasts out as moments with links to the second', () => {
    const travel = [...files.entries()].find(([p]) => p.includes('قبل أن تسافر'))![1];
    expect(travel).toContain('### [▶ 40:51](https://youtu.be/Qx7mT2pLk9A?t=2451)');
  });

  it('never lets a title with a pipe split a table row', () => {
    const overview = files.get('Hamesh/Overview.md')!;
    for (const row of overview.split('\n').filter((l) => l.startsWith('| [['))) {
      expect(row.replace(/\\\|/g, '').split('|')).toHaveLength(7);
    }
  });

  it('adds a live table, and a pie only when there are two sites or more', () => {
    expect(files.has('Hamesh/Hamesh notes.base')).toBe(true);
    expect(files.get('Hamesh/Overview.md')).toContain('pie showData');
    const one = buildExportModel([textNote({})], [], { kind: 'all' });
    expect(fileMap(renderExport(one, opts())).get('Hamesh/Overview.md')).not.toContain('pie');
  });
});

describe('renderExport — Notion', () => {
  const { notes, folders } = realisticLibrary();
  const model = buildExportModel(notes, folders, { kind: 'all' });
  const files = fileMap(renderExport(model, opts({ flavor: 'notion', lang: 'ar' })));
  const lifecycle = files.get(
    'Hamesh/Sites/maktaba.site/The Conditions of Renaissance – Maktaba.md',
  )!;

  it('has no frontmatter, callouts or block ids', () => {
    expect(lifecycle.startsWith('# The Conditions')).toBe(true);
    expect(lifecycle).not.toMatch(/\[!quote\]|\^hm-|^---\ntitle/m);
  });

  it('puts the properties in a table and links with encoded relative paths', () => {
    expect(lifecycle).toContain(
      '| المصدر | [maktaba.site](https://maktaba.site/bennabi/conditions-of-renaissance) |',
    );
    expect(lifecycle).toContain('[Reading / Science](../../Folders/Reading/Science.md)');
  });

  it('writes a CSV for a database, and no canvas or base', () => {
    expect(files.has('Hamesh/Hamesh notes.csv')).toBe(true);
    expect([...files.keys()].some((p) => p.endsWith('.canvas') || p.endsWith('.base'))).toBe(false);
  });

  it('ends with the Arabic Hamesh line', () => {
    expect(lifecycle.trimEnd().split('\n').pop()).toBe(
      '*صُدِّرت من [هامش](https://hamesh.fandees.tech) · 20 نوفمبر 2026*',
    );
  });
});

describe('layouts on a page', () => {
  const page = [
    textNote({ id: 'a1', exact: 'scholar', content: 'عالِم', start: 1 }),
    textNote({ id: 'a2', exact: 'imitation', content: 'تقليد', start: 2 }),
    elementNote({
      id: 'a3',
      content: 'Check the button label',
      url: 'https://maktaba.site/bennabi/conditions-of-renaissance',
      title: 'The Conditions of Renaissance – Maktaba',
    }),
  ];
  const model = buildExportModel(page, [], { kind: 'all' });
  const group = model.groups[0].key;
  const render = (layout: 'glossary' | 'checklist' | 'timeline') =>
    renderSinglePage(model, model.pages[0].id, opts({ layouts: { [group]: layout } })).text;

  it('glossary: word, meaning and the words around it', () => {
    const text = render('glossary');
    expect(text).toContain('| Word | Meaning | In context |');
    expect(text).toContain('| scholar | عالِم | …**scholar**… |');
    expect(text).toContain('## Other notes');
  });

  it('checklist: every note a task, with what it was on', () => {
    const text = render('checklist');
    expect(text).toMatch(/^- \[ \] عالِم \^hm-/m);
    expect(text).toContain('  > scholar');
    expect(text).toMatch(/^- \[ \] Check the button label/m);
  });

  it('timeline on an article: in the order the notes were written', () => {
    expect(render('timeline')).toContain('| Written | Note |');
  });

  it('a single page has no links to files that are not there', () => {
    const filed = buildExportModel([textNote({ folderId: 'f' })], [folder('f', 'Work')], {
      kind: 'all',
    });
    const text = renderSinglePage(filed, filed.pages[0].id, opts()).text;
    expect(text).toContain('  - "Work"');
    expect(text).not.toContain('[[');
  });
});

describe('names and code blocks', () => {
  it('gives two folders whose names come out the same their own files', () => {
    const model = buildExportModel(
      [
        textNote({ folderId: 'csharp', content: 'In C#' }),
        textNote({ folderId: 'c', content: 'In C', start: 50 }),
      ],
      [folder('csharp', 'C#'), folder('c', 'C')],
      { kind: 'all' },
    );
    const paths = renderExport(model, opts())
      .map((f) => f.path)
      .filter((p) => p.startsWith('Hamesh/Folders/'));
    expect(paths).toHaveLength(2);
    expect(new Set(paths.map((p) => p.toLowerCase())).size).toBe(2);
  });

  it('nests a folder under its parent’s final name', () => {
    const model = buildExportModel(
      [textNote({ folderId: 'kid', content: 'Deep' }), textNote({ folderId: 'p1', start: 9 })],
      [folder('p1', 'Work'), folder('p2', 'work'), folder('kid', 'Notes', 'p2')],
      { kind: 'all' },
    );
    const paths = renderExport(model, opts()).map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'Hamesh/Folders/work.md',
        'Hamesh/Folders/Work (p1).md',
        'Hamesh/Folders/work/Notes.md',
      ]),
    );
  });

  it('closes a code block a note leaves open, so the rest of the file stays text', () => {
    const model = buildExportModel(
      [textNote({ content: 'Try this:\n```js\nuseEffect(() => {})' })],
      [],
      { kind: 'all' },
    );
    for (const flavor of ['obsidian', 'notion'] as const) {
      const text = renderSinglePage(model, model.pages[0].id, opts({ flavor })).text;
      const fences = text.split('\n').filter((l) => l.startsWith('```')).length;
      expect(fences % 2).toBe(0);
    }
  });
});

describe('sections and chapters', () => {
  it('groups notes under the heading they were written under', () => {
    const notes = [
      textNote({ start: 1, section: 'Making a request', content: 'one' }),
      textNote({ start: 2, section: 'Setting headers', content: 'two' }),
    ];
    const model = buildExportModel(notes, [], { kind: 'all' });
    const text = renderSinglePage(model, model.pages[0].id, opts()).text;
    expect(text).toContain('## Making a request');
    expect(text).toContain('| # | Section | On | Note |');
  });

  it('boxes a video’s moments by chapter', () => {
    const notes = [1, 2, 3].map((t) =>
      videoNote({
        timestamp: t * 60,
        chapter: t < 3 ? 'Big-O' : 'Binary search',
        content: `m${t}`,
      }),
    );
    const model = buildExportModel(notes, [], { kind: 'all' });
    const text = renderSinglePage(model, pageIdentity(notes[0]), opts()).text;
    expect(text).toContain('subgraph c1["Big-O"]');
    expect(text).toContain('| Time | Chapter | Note |');
  });
});

describe('glossary context', () => {
  it('keeps the punctuation next to the word and drops cut-off words', () => {
    const note = textNote({ exact: 'creation', content: 'إبداع' });
    if (note.anchor.type === 'text') {
      note.anchor.context = {
        prefix: 'ed. This book is about ',
        suffix: ', meaning more than products and ',
      };
    }
    const model = buildExportModel(
      [
        note,
        textNote({ exact: 'a', content: 'b', start: 5 }),
        textNote({ exact: 'c', content: 'd', start: 6 }),
      ],
      [],
      { kind: 'all' },
    );
    const text = renderSinglePage(
      model,
      model.pages[0].id,
      opts({ layouts: { [model.groups[0].key]: 'glossary' } }),
    ).text;
    expect(text).toContain(
      '| creation | إبداع | …This book is about **creation**, meaning more than products and… |',
    );
  });
});
