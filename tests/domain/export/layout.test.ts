import { describe, it, expect } from 'vitest';
import { inferLayout, isTermPair, isExportLayout } from '@/domain/export/layout';
import { textNote, videoNote, elementNote } from './fixtures';

describe('inferLayout', () => {
  it('sees a vocabulary folder as a glossary', () => {
    const notes = [
      textNote({ exact: 'comfy', content: 'مُريح' }),
      textNote({ exact: 'intend', content: 'ينوي' }),
      textNote({ exact: 'escape hatch', content: 'فتحة الهروب' }),
      textNote({ exact: 'convention', content: 'مؤتمر - اتفاقية - مُعاهدة' }),
    ];
    expect(inferLayout(notes)).toBe('glossary');
  });

  it('sees video moments as a timeline', () => {
    expect(inferLayout([videoNote({ timestamp: 10 }), videoNote({ timestamp: 20 })])).toBe(
      'timeline',
    );
  });

  it('keeps long thoughts as notes', () => {
    const notes = [
      textNote({
        exact: 'connection.disconnect();',
        content: 'This is the default api contract in useEffect: it should only return a cleanup.',
      }),
      textNote({
        exact: 'React starts and stops your Effect one extra time in development',
        content: 'Every Effect runs twice in development',
      }),
      textNote({ exact: 'cohesive', content: 'مُتماسك' }),
    ];
    expect(inferLayout(notes)).toBe('notes');
  });

  it('needs three pairs before it calls something a glossary', () => {
    expect(inferLayout([textNote({ exact: 'comfy', content: 'مُريح' })])).toBe('notes');
  });

  it('never guesses a checklist, and handles nothing', () => {
    expect(inferLayout([elementNote({ content: 'Fix the button label' })])).toBe('notes');
    expect(inferLayout([])).toBe('notes');
  });
});

describe('isTermPair', () => {
  it('needs a short quote and a short one-line meaning', () => {
    expect(isTermPair(textNote({ exact: 'In rare cases', content: 'في حالات نادرة' }))).toBe(true);
    expect(isTermPair(textNote({ exact: 'mutable', content: 'one\ntwo' }))).toBe(false);
    expect(isTermPair(videoNote({ timestamp: 1 }))).toBe(false);
  });
});

describe('isExportLayout', () => {
  it('knows the four layouts only', () => {
    expect(isExportLayout('glossary')).toBe(true);
    expect(isExportLayout('cards')).toBe(false);
  });
});
