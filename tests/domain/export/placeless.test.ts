import { describe, it, expect } from 'vitest';
import { buildExportModel, pageIdentity } from '@/domain/export/model';
import { renderSinglePage, type RenderOptions } from '@/domain/export/render';
import type { ExportLayout } from '@/domain/export/layout';
import type { Anchor, Note } from '@/domain/note';

const PAGE = 'https://maktaba.site/bennabi';

const note = (id: string, anchor: Anchor, at: number): Note => ({
  id,
  schemaVersion: 1,
  pageKey: PAGE,
  originalUrl: PAGE,
  content: `thought ${id}`,
  anchor,
  workspaceId: 'default',
  createdAt: `2026-01-0${at}T00:00:00.000Z`,
  updatedAt: `2026-01-0${at}T00:00:00.000Z`,
});

const words = (exact: string, start: number): Anchor => ({
  type: 'text',
  version: 1,
  exact,
  context: { prefix: 'Bennabi wrote of ', suffix: ' in 1949.' },
  textPosition: { start, end: start + exact.length },
});

const NOTES = [
  note('gone', words('colonisability', 10), 1),
  note('here', words('renaissance', 40), 2),
  note(
    'el',
    {
      primarySelector: '#chapter',
      signals: { tagName: 'section', textSnippet: 'Chapter one' },
      fallbackDocumentPosition: { x: 0, y: 900 },
    },
    3,
  ),
];

function render(layout: ExportLayout, placeless?: ReadonlySet<string>, lang: 'en' | 'ar' = 'en') {
  const model = buildExportModel(NOTES, [], { kind: 'page', pageId: pageIdentity(NOTES[0]) });
  const opts: RenderOptions = {
    flavor: 'obsidian',
    lang,
    layouts: { [model.groups[0].key]: layout },
    now: new Date('2026-11-24T00:00:00.000Z'),
    placeless,
  };
  return renderSinglePage(model, model.pages[0].id, opts).text;
}

const LINE = '*⚠ No longer found on the page*';
const count = (text: string, needle: string) => text.split(needle).length - 1;

describe('exporting notes that have no place on their page', () => {
  it('says nothing when every note has its place', () => {
    for (const layout of ['notes', 'timeline', 'checklist', 'glossary'] as const) {
      expect(render(layout)).not.toContain('No longer found');
    }
  });

  it('puts the line under the quote or element of each placeless note, in every layout', () => {
    const placeless = new Set(['gone', 'el']);
    for (const layout of ['notes', 'timeline', 'checklist'] as const) {
      expect(count(render(layout, placeless), LINE)).toBe(2);
    }
  });

  it('puts it right after the quote it no longer has a place for', () => {
    const text = render('notes', new Set(['gone']));
    const quoteAt = text.indexOf('> colonisability');
    const after = text.slice(quoteAt).split('\n');
    expect(after.slice(0, 3)).toEqual(['> colonisability', '', LINE]);
  });

  it('replaces the glossary’s context, which would claim a place on the page', () => {
    const text = render('glossary', new Set(['gone']));
    expect(text).toMatch(/\| colonisability \| thought gone \| ⚠ No longer found on the page \|/);
    expect(text).toContain('**renaissance**');
  });

  it('says it in Arabic', () => {
    expect(render('notes', new Set(['gone']), 'ar')).toContain('*⚠ لم تعد موجودة في الصفحة*');
  });
});
