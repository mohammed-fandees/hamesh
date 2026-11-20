import { describe, it, expect } from 'vitest';
import { inferLayout, isTermPair, isExportLayout } from '@/domain/export/layout';
import { textNote, videoNote, elementNote } from './fixtures';

describe('inferLayout', () => {
  it('sees a vocabulary folder as a glossary', () => {
    const notes = [
      textNote({ exact: 'scholar', content: 'عالِم' }),
      textNote({ exact: 'imitation', content: 'تقليد' }),
      textNote({ exact: 'house of wisdom', content: 'بيت الحكمة' }),
      textNote({ exact: 'treaty', content: 'معاهدة - اتفاق - عهد' }),
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
        exact: 'civilization is creation;',
        content:
          'This is the core claim of the book in useEffect: it should only return a cleanup.',
      }),
      textNote({
        exact: 'The author states the argument one extra time in this chapter',
        content: 'Every Effect runs twice in development',
      }),
      textNote({ exact: 'dependence', content: 'مُتماسك' }),
    ];
    expect(inferLayout(notes)).toBe('notes');
  });

  it('needs three pairs before it calls something a glossary', () => {
    expect(inferLayout([textNote({ exact: 'scholar', content: 'عالِم' })])).toBe('notes');
  });

  it('never guesses a checklist, and handles nothing', () => {
    expect(inferLayout([elementNote({ content: 'Fix the button label' })])).toBe('notes');
    expect(inferLayout([])).toBe('notes');
  });
});

describe('isTermPair', () => {
  it('needs a short quote and a short one-line meaning', () => {
    expect(isTermPair(textNote({ exact: 'In some chapters', content: 'في بعض الفصول' }))).toBe(
      true,
    );
    expect(isTermPair(textNote({ exact: 'creation', content: 'one\ntwo' }))).toBe(false);
    expect(isTermPair(videoNote({ timestamp: 1 }))).toBe(false);
  });
});

describe('isExportLayout', () => {
  it('knows the four layouts only', () => {
    expect(isExportLayout('glossary')).toBe(true);
    expect(isExportLayout('cards')).toBe(false);
  });
});
