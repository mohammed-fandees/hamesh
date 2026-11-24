// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { anchorOutcomes } from '@/content/anchor-outcomes';
import type { Anchor, Note } from '@/domain/note';

const note = (id: string, anchor: Anchor, extra: Partial<Note> = {}): Note => ({
  id,
  schemaVersion: 1,
  pageKey: 'https://maktaba.site/bennabi',
  originalUrl: 'https://maktaba.site/bennabi',
  content: 'x',
  anchor,
  workspaceId: 'default',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

const element = (selector: string, x = 5, y = 5): Anchor => ({
  primarySelector: selector,
  signals: { tagName: 'section' },
  fallbackDocumentPosition: { x, y },
});

const words = (exact: string): Anchor => ({
  type: 'text',
  version: 1,
  exact,
  context: { prefix: '', suffix: '' },
  textPosition: { start: 0, end: exact.length },
});

describe('anchorOutcomes', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<section id="here"><p>Civilisation is man, soil and time, joined by an idea.</p></section>';
  });

  it('finds an element by its own signals and misses one that only falls back to x/y', () => {
    document.elementFromPoint = () => document.querySelector('p');
    const outcomes = anchorOutcomes(
      [note('found', element('#here')), note('guess', element('#gone'))],
      true,
    );
    expect(outcomes).toEqual(
      new Map([
        ['found', 'found'],
        ['guess', 'missed'],
      ]),
    );
  });

  it('finds words that are on the page and misses words that are not', () => {
    const outcomes = anchorOutcomes(
      [note('here', words('man, soil and time')), note('gone', words('the colonisability'))],
      true,
    );
    expect(outcomes.get('here')).toBe('found');
    expect(outcomes.get('gone')).toBe('missed');
  });

  it('does not check words while text notes are off, nor videos, nor team notes', () => {
    const outcomes = anchorOutcomes(
      [
        note('words', words('the colonisability')),
        note('video', { type: 'video', platform: 'youtube', videoId: 'abc', timestamp: 3 }),
        note('team', element('#gone'), {
          team: { id: 't', name: 'Readers', version: 1, authorId: null, folderId: null },
        }),
      ],
      false,
    );
    expect(outcomes.size).toBe(0);
  });
});
