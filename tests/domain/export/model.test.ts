import { describe, it, expect } from 'vitest';
import { buildExportModel, cleanTitle, pageIdentity, orderKey } from '@/domain/export/model';
import { textNote, videoNote, elementNote, folder, realisticLibrary } from './fixtures';

describe('pageIdentity', () => {
  it('keeps two YouTube videos apart although they share a page key', () => {
    const a = videoNote({ timestamp: 1, videoId: 'aaa' });
    const b = videoNote({ timestamp: 1, videoId: 'bbb' });
    expect(a.pageKey).toBe(b.pageKey);
    expect(pageIdentity(a)).not.toBe(pageIdentity(b));
  });
});

describe('cleanTitle', () => {
  it('drops YouTube’s unread count and its name', () => {
    expect(
      cleanTitle('(93) قبل أن تسافر | ضيف - YouTube', 'https://www.youtube.com/watch?v=x'),
    ).toBe('قبل أن تسافر | ضيف');
  });

  it('falls back to the last part of the address', () => {
    expect(cleanTitle('', 'https://example.com/docs/getting%20started')).toBe('getting started');
    expect(cleanTitle(undefined, 'https://example.com/')).toBe('example.com');
  });
});

describe('orderKey', () => {
  it('orders by text position, element position or video time', () => {
    expect(orderKey(textNote({ start: 40 }))).toBe(40);
    expect(orderKey(elementNote({ y: 900 }))).toBe(900);
    expect(orderKey(videoNote({ timestamp: 12.5 }))).toBe(12.5);
  });
});

describe('buildExportModel', () => {
  const { notes, folders } = realisticLibrary();

  it('makes one page per page or video, notes in page order', () => {
    const model = buildExportModel(notes, folders, { kind: 'all' });
    expect(model.pages).toHaveLength(6);
    const lifecycle = model.pages.find(
      (p) => p.title === 'The Conditions of Renaissance – Maktaba',
    )!;
    expect(lifecycle.notes.map((n) => n.id)).toEqual([
      'n-cleanup',
      'n-advice',
      'n-twice',
      'n-imitation',
      'n-dependence',
      'n-renaissance',
    ]);
    expect(lifecycle.folderIds).toEqual(['f-react', 'f-vocab']);
    expect(model.pages.filter((p) => p.kind === 'video')).toHaveLength(3);
  });

  it('suggests a glossary for vocabulary, a timeline for podcasts, notes for the rest', () => {
    const model = buildExportModel(notes, folders, { kind: 'all' });
    const suggested = Object.fromEntries(model.groups.map((g) => [g.label, g.suggested]));
    expect(suggested).toEqual({
      'Bennabi - Vocab': 'glossary',
      'Reading / Science': 'notes',
      'Videos / Talks Notes': 'timeline',
      'youtube.com': 'timeline',
    });
  });

  it('gives a page the layout group most of its notes are in', () => {
    const model = buildExportModel(notes, folders, { kind: 'all' });
    const lifecycle = model.pages.find((p) => p.title.startsWith('The Conditions'))!;
    const refs = model.pages.find((p) => p.title.startsWith('The Book of Algebra'))!;
    expect(lifecycle.groupKey).toBe('folder:f-react');
    expect(refs.groupKey).toBe('folder:f-vocab');
  });

  it('exports a folder with its sub-folders and nothing else', () => {
    const model = buildExportModel(notes, folders, { kind: 'folder', folderId: 'f-learning' });
    expect(model.noteCount).toBe(4);
    expect(model.folders.map((f) => f.path.join('/'))).toEqual(['Reading', 'Reading/Science']);
  });

  it('exports one page', () => {
    const pageId = pageIdentity(notes.find((n) => n.id === 'v-debate')!);
    const model = buildExportModel(notes, folders, { kind: 'page', pageId });
    expect(model.pages).toHaveLength(1);
    expect(model.pages[0].duration).toBeCloseTo(6719.06);
  });

  it('only lists folders that hold notes', () => {
    const model = buildExportModel(notes, folders, { kind: 'all' });
    expect(model.folders.map((f) => f.name)).not.toContain('Hamesh');
    expect(model.folders.find((f) => f.id === 'f-youtube')!.childIds).toEqual(['f-podcasts']);
  });

  it('splits a page into sections where the heading changes', () => {
    const page = [
      textNote({ start: 1, section: 'Making a request' }),
      textNote({ start: 2, section: 'Making a request' }),
      textNote({ start: 3, section: 'Setting headers' }),
    ];
    const [only] = buildExportModel(page, [], { kind: 'all' }).pages;
    expect(only.sections.map((s) => [s.title, s.notes.length])).toEqual([
      ['Making a request', 2],
      ['Setting headers', 1],
    ]);
  });

  it('is the same every time for the same library', () => {
    const one = buildExportModel(notes, folders, { kind: 'all' });
    const two = buildExportModel([...notes].reverse(), [...folders].reverse(), { kind: 'all' });
    expect(two.pages.map((p) => p.id)).toEqual(one.pages.map((p) => p.id));
    expect(two.groups.map((g) => g.key)).toEqual(one.groups.map((g) => g.key));
  });

  it('treats a folder id that no longer exists as unfiled', () => {
    const lost = textNote({ folderId: 'gone', url: 'https://a.example/x' });
    const model = buildExportModel([lost], [folder('other', 'Other')], { kind: 'all' });
    expect(model.groups.map((g) => g.key)).toEqual(['site:a.example']);
  });
});
