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
  const lifecycle = files.get('Hamesh/Sites/react.dev/Lifecycle of Reactive Effects – React.md')!;

  it('writes properties as YAML that cannot change type', () => {
    expect(lifecycle).toMatch(/^---\ntitle: "Lifecycle of Reactive Effects – React"\n/);
    expect(lifecycle).toContain('  - "[[Hamesh/Folders/Learning/React|Learning / React]]"');
  });

  it('links the canvas by its own name', () => {
    expect(lifecycle).toContain(
      '> On the canvas: [[Hamesh/Sites/react.dev/Lifecycle of Reactive Effects – React.canvas|',
    );
  });

  it('writes quotes as callouts and gives every note a block id', () => {
    expect(lifecycle).toContain('> [!quote] On the page\n> connection.disconnect();');
    expect(lifecycle).toMatch(
      /useEffect should only return undefined or a function\. \^hm-[a-z0-9]{8}/,
    );
  });

  it('keeps a note that is just "#2" as text', () => {
    const useState = files.get('Hamesh/Sites/react.dev/useState – React.md')!;
    expect(useState).toMatch(/^\\#2 \^hm-/m);
  });

  it('draws a map for three notes or more, and a canvas beside it', () => {
    expect(lifecycle).toContain('```mermaid\nmindmap');
    expect(files.has('Hamesh/Sites/react.dev/Lifecycle of Reactive Effects – React.canvas')).toBe(
      true,
    );
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
    const vocab = files.get('Hamesh/Folders/English - Vocab.md')!;
    const words = [...vocab.matchAll(/^\| ([a-z ]+) \| /gm)].map((m) => m[1]);
    expect(words).toEqual(['cohesive', 'escape hatch', 'intend', 'mutable', 'suppressing']);
  });

  it('lays podcasts out as moments with links to the second', () => {
    const travel = [...files.entries()].find(([p]) => p.includes('لو بتفكر تسافر'))![1];
    expect(travel).toContain('### [▶ 40:51](https://youtu.be/DM6Uq2ixzjs?t=2451)');
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
  const lifecycle = files.get('Hamesh/Sites/react.dev/Lifecycle of Reactive Effects – React.md')!;

  it('has no frontmatter, callouts or block ids', () => {
    expect(lifecycle.startsWith('# Lifecycle')).toBe(true);
    expect(lifecycle).not.toMatch(/\[!quote\]|\^hm-|^---\ntitle/m);
  });

  it('puts the properties in a table and links with encoded relative paths', () => {
    expect(lifecycle).toContain(
      '| المصدر | [react.dev](https://react.dev/learn/lifecycle-of-reactive-effects) |',
    );
    expect(lifecycle).toContain('[Learning / React](../../Folders/Learning/React.md)');
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
    textNote({ id: 'a1', exact: 'comfy', content: 'مُريح', start: 1 }),
    textNote({ id: 'a2', exact: 'intend', content: 'ينوي', start: 2 }),
    elementNote({
      id: 'a3',
      content: 'Check the button label',
      url: 'https://react.dev/learn/lifecycle-of-reactive-effects',
      title: 'Lifecycle of Reactive Effects – React',
    }),
  ];
  const model = buildExportModel(page, [], { kind: 'all' });
  const group = model.groups[0].key;
  const render = (layout: 'glossary' | 'checklist' | 'timeline') =>
    renderSinglePage(model, model.pages[0].id, opts({ layouts: { [group]: layout } })).text;

  it('glossary: word, meaning and the words around it', () => {
    const text = render('glossary');
    expect(text).toContain('| Word | Meaning | In context |');
    expect(text).toContain('| comfy | مُريح | …**comfy**… |');
    expect(text).toContain('## Other notes');
  });

  it('checklist: every note a task, with what it was on', () => {
    const text = render('checklist');
    expect(text).toMatch(/^- \[ \] مُريح \^hm-/m);
    expect(text).toContain('  > comfy');
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
    const note = textNote({ exact: 'mutable', content: 'مُتقلب' });
    if (note.anchor.type === 'text') {
      note.anchor.context = {
        prefix: 'ty. This value is intentionally ',
        suffix: ', meaning you can both read and ',
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
      '| mutable | مُتقلب | …This value is intentionally **mutable**, meaning you can both read and… |',
    );
  });
});
