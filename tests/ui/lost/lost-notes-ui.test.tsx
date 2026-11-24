// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { getStrings } from '@/ui/i18n';
import { LostNotesPill } from '@/ui/lost/LostNotesPill';
import { LostNotesList, describeElement } from '@/ui/lost/LostNotesList';
import { ReattachBar } from '@/ui/lost/ReattachBar';
import type { Anchor, ElementAnchor, Note } from '@/domain/note';

const en = getStrings('en').lostNotes;
const ar = getStrings('ar').lostNotes;

const note = (id: string, anchor: Anchor, content: string): Note => ({
  id,
  schemaVersion: 1,
  pageKey: 'https://maktaba.site/bennabi',
  originalUrl: 'https://maktaba.site/bennabi',
  content,
  anchor,
  workspaceId: 'default',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const element: ElementAnchor = {
  primarySelector: '#gone',
  signals: { tagName: 'SECTION', textSnippet: 'The conditions of renaissance' },
  fallbackDocumentPosition: { x: 0, y: 0 },
};
const words: Anchor = {
  type: 'text',
  version: 1,
  exact: 'man, soil and time',
  context: { prefix: '', suffix: '' },
  textPosition: { start: 0, end: 18 },
};

afterEach(cleanup);

describe('lost-notes strings', () => {
  it('exist in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ar).sort());
  });

  it('count the way each language counts', () => {
    expect([1, 2].map(en.pill)).toEqual([
      "1 note couldn't find its place",
      "2 notes couldn't find their place",
    ]);
    expect([1, 2, 3, 11].map(ar.pill)).toEqual([
      'ملاحظة لم تجد مكانها',
      'ملاحظتان لم تجدا مكانهما',
      '3 ملاحظات لم تجد مكانها',
      '11 ملاحظة لم تجد مكانها',
    ]);
  });
});

describe('LostNotesPill', () => {
  it('says how many and opens the list', () => {
    const onToggle = vi.fn();
    render(<LostNotesPill count={2} open={false} strings={en} onToggle={onToggle} />);
    const pill = screen.getByRole('button', { name: "2 notes couldn't find their place" });
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(pill);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('is not drawn when no note is lost', () => {
    const { container } = render(
      <LostNotesPill count={0} open={false} strings={en} onToggle={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('LostNotesList', () => {
  const notes = [
    note('w', words, 'civilisation = man + soil + time\nmore'),
    note('e', element, 'the opening chapter'),
  ];

  it('shows what each note was on, its first line, and acts on that note', () => {
    const onPutBack = vi.fn();
    const onKeep = vi.fn();
    render(
      <LostNotesList
        notes={notes}
        strings={en}
        error={null}
        onPutBack={onPutBack}
        onKeep={onKeep}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Notes that lost their place' });
    const onWords = within(dialog).getByRole('listitem', {
      name: 'civilisation = man + soil + time',
    });
    expect(within(onWords).getByText('man, soil and time')).toBeInTheDocument();
    const onElement = within(dialog).getByRole('listitem', { name: 'the opening chapter' });
    expect(within(onElement).getByText('section · “The conditions of renaissance”')).toBeVisible();
    expect(within(onElement).getByText(/^On:/)).toBeInTheDocument();

    fireEvent.click(within(onElement).getByRole('button', { name: 'Put it back' }));
    expect(onPutBack).toHaveBeenCalledWith(notes[1]);
    fireEvent.click(within(onWords).getByRole('button', { name: 'Keep without a place' }));
    expect(onKeep).toHaveBeenCalledWith(notes[0]);
  });

  it('puts focus on the first action, and closes on Escape and on its close button', () => {
    const onClose = vi.fn();
    render(
      <LostNotesList
        notes={notes}
        strings={en}
        error={null}
        onPutBack={() => {}}
        onKeep={() => {}}
        onClose={onClose}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'Put it back' })[0]).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('says when the last action could not be saved', () => {
    render(
      <LostNotesList
        notes={notes}
        strings={en}
        error={en.failed}
        onPutBack={() => {}}
        onKeep={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Couldn't save. Try again.")).toBeInTheDocument();
  });

  it('describes an element by its tag alone when it showed no words', () => {
    expect(describeElement({ ...element, signals: { tagName: 'IMG' } })).toBe('img');
    expect(
      describeElement({ ...element, signals: { tagName: 'p', textSnippet: 'x'.repeat(90) } }),
    ).toHaveLength(`p · “${'x'.repeat(59)}…”`.length);
  });
});

describe('ReattachBar', () => {
  it('says what to do and backs out', () => {
    const onCancel = vi.fn();
    render(<ReattachBar text={ar.reattachText} cancelLabel={ar.cancel} onCancel={onCancel} />);
    expect(screen.getByRole('status')).toHaveTextContent('حدّد الكلمات التي تخصها هذه الملاحظة');
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
