// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import mermaid from 'mermaid';
import { mindmap, timeline, pie } from '@/domain/export/mermaid';

const body = (block: string) => block.replace(/^```mermaid\n/, '').replace(/\n```$/, '');
const parses = (block: string) => expect(mermaid.parse(body(block))).resolves.toBeTruthy();

const hostile = 'end"]; click n1 call alert(1) %% [[x]] {y} <b>z</b> #tag | pipe';

describe('mermaid builders', () => {
  it('draws a mind map Mermaid accepts, with and without sections', async () => {
    await parses(
      mindmap('Lifecycle of Reactive Effects – React', [
        { title: null, items: [{ label: 'intend → ينوي' }, { label: hostile }] },
      ]),
    );
    await parses(
      mindmap(hostile, [
        { title: 'Making a request', items: [{ label: 'a' }] },
        { title: hostile, items: [{ label: 'b' }, { label: '' }] },
      ]),
    );
  });

  it('draws a timeline Mermaid accepts, boxed by chapter', async () => {
    await parses(
      timeline([{ title: null, items: [{ label: '4:12 · تعريف Big-O' }, { label: hostile }] }]),
    );
    await parses(
      timeline([
        { title: 'الفصل 1 · التعقيد', items: [{ label: '04:12 · x' }] },
        { title: hostile, items: [{ label: '1:05:02 · y' }, { label: 'z' }] },
      ]),
    );
  });

  it('draws a pie Mermaid accepts', async () => {
    await parses(
      pie('Notes per site', [
        { label: 'react.dev', value: 16 },
        { label: hostile, value: 1 },
      ]),
    );
  });

  it('never lets a note close a label or add a statement', () => {
    const out = timeline([{ title: null, items: [{ label: hostile }] }]);
    const lines = out.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[2]).toMatch(/^ {2}n1\["[^"[\]%]*"\]$/);
  });
});
