// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LayoutPreview } from '@/ui/export/LayoutPreview';
import { buildExportModel } from '@/domain/export/model';
import { textNote, videoNote } from '../../domain/export/fixtures';

afterEach(cleanup);
const now = new Date('2026-11-20T12:00:00Z');
const words = buildExportModel(
  [
    textNote({ exact: 'comfy', content: 'مُريح', start: 1 }),
    textNote({ exact: 'intend', content: 'ينوي', start: 2 }),
  ],
  [],
  { kind: 'all' },
).pages[0];

function show(
  layout: 'notes' | 'glossary' | 'timeline' | 'checklist',
  flavor: 'obsidian' | 'notion' = 'obsidian',
  page = words,
) {
  render(
    <LayoutPreview
      page={page}
      layout={layout}
      flavor={flavor}
      lang="en"
      now={now}
      label="Preview"
    />,
  );
  return screen.getByRole('article', { name: 'Preview' });
}

describe('LayoutPreview', () => {
  it('glossary: a row per word and its meaning', () => {
    const preview = show('glossary');
    expect(within(preview).getByRole('row', { name: 'comfy مُريح' })).toBeInTheDocument();
  });

  it('checklist: a box per note, with what it was on', () => {
    const preview = show('checklist');
    expect(within(preview).getAllByRole('listitem')).toHaveLength(2);
    expect(within(preview).getByText('comfy')).toBeInTheDocument();
  });

  it('timeline: the time of each moment', () => {
    const video = buildExportModel([videoNote({ timestamp: 252, content: 'Big-O' })], [], {
      kind: 'all',
    }).pages[0];
    const preview = show('timeline', 'obsidian', video);
    expect(within(preview).getByText('4:12')).toBeInTheDocument();
  });

  it('notes: a callout in Obsidian, a plain quote in Notion', () => {
    expect(within(show('notes')).getAllByText('On the page')).toHaveLength(2);
    cleanup();
    expect(within(show('notes', 'notion')).queryByText('On the page')).toBeNull();
  });

  it('ends with the Hamesh line', () => {
    expect(within(show('notes')).getByText(/Exported from/)).toHaveTextContent(
      'Exported from Hamesh · 20 November 2026',
    );
  });
});
