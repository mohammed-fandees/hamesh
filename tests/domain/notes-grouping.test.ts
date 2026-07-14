import { describe, it, expect } from 'vitest';
import {
  groupNotesByDomain,
  getContinueWebsites,
  deriveMonogram,
  derivePageLabel,
} from '@/domain/notes-grouping';
import type { Note, ElementAnchor } from '@/domain/note';

function makeAnchor(): ElementAnchor {
  return {
    primarySelector: null,
    signals: { tagName: 'div' },
    fallbackDocumentPosition: { x: 0, y: 0 },
  };
}

let idCounter = 0;
function makeNote(overrides: Partial<Note> = {}): Note {
  idCounter += 1;
  return {
    id: `note-${idCounter}`,
    schemaVersion: 1,
    pageKey: 'https://example.com',
    originalUrl: 'https://example.com',
    content: 'hello',
    anchor: makeAnchor(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('groupNotesByDomain', () => {
  it('returns an empty array for no notes', () => {
    expect(groupNotesByDomain([])).toEqual([]);
  });

  it('groups notes by hostname', () => {
    const notes = [
      makeNote({ originalUrl: 'https://github.com/a' }),
      makeNote({ originalUrl: 'https://github.com/b' }),
      makeNote({ originalUrl: 'https://developer.mozilla.org/en-US/x' }),
    ];
    const groups = groupNotesByDomain(notes);
    expect(groups).toHaveLength(2);
    const github = groups.find((g) => g.domain === 'github.com');
    expect(github?.count).toBe(2);
  });

  it('strips a leading www. so it groups with the bare domain', () => {
    const notes = [
      makeNote({ originalUrl: 'https://www.github.com/a' }),
      makeNote({ originalUrl: 'https://github.com/b' }),
    ];
    const groups = groupNotesByDomain(notes);
    expect(groups).toHaveLength(1);
    expect(groups[0].domain).toBe('github.com');
    expect(groups[0].count).toBe(2);
  });

  it('sorts groups alphabetically by domain', () => {
    const notes = [
      makeNote({ originalUrl: 'https://stackoverflow.com/q' }),
      makeNote({ originalUrl: 'https://github.com/a' }),
      makeNote({ originalUrl: 'https://mdn.dev/x' }),
    ];
    const groups = groupNotesByDomain(notes);
    expect(groups.map((g) => g.domain)).toEqual(['github.com', 'mdn.dev', 'stackoverflow.com']);
  });

  it('computes lastActivity as the most recent updatedAt in the group', () => {
    const notes = [
      makeNote({ originalUrl: 'https://a.com', updatedAt: '2026-01-01T00:00:00.000Z' }),
      makeNote({ originalUrl: 'https://a.com', updatedAt: '2026-03-01T00:00:00.000Z' }),
      makeNote({ originalUrl: 'https://a.com', updatedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    const [group] = groupNotesByDomain(notes);
    expect(group.lastActivity).toBe('2026-03-01T00:00:00.000Z');
  });

  it('sets latestNotePreview to the content of the most recently updated note', () => {
    const notes = [
      makeNote({
        originalUrl: 'https://a.com',
        content: 'older note',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      makeNote({
        originalUrl: 'https://a.com',
        content: 'newest note',
        updatedAt: '2026-03-01T00:00:00.000Z',
      }),
    ];
    const [group] = groupNotesByDomain(notes);
    expect(group.latestNotePreview).toBe('newest note');
  });

  it('degrades gracefully for a malformed originalUrl instead of dropping the note', () => {
    const notes = [makeNote({ originalUrl: 'not-a-valid-url' })];
    const groups = groupNotesByDomain(notes);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(1);
  });
});

describe('getContinueWebsites', () => {
  it('returns an empty array when there are no notes', () => {
    expect(getContinueWebsites([])).toEqual([]);
  });

  it('sorts by most recent activity, most recent first', () => {
    const notes = [
      makeNote({ originalUrl: 'https://old.com', updatedAt: '2026-01-01T00:00:00.000Z' }),
      makeNote({ originalUrl: 'https://newest.com', updatedAt: '2026-03-01T00:00:00.000Z' }),
      makeNote({ originalUrl: 'https://mid.com', updatedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    const result = getContinueWebsites(notes);
    expect(result.map((r) => r.domain)).toEqual(['newest.com', 'mid.com', 'old.com']);
  });

  it('caps at the given limit (default 3)', () => {
    const notes = [
      makeNote({ originalUrl: 'https://a.com' }),
      makeNote({ originalUrl: 'https://b.com' }),
      makeNote({ originalUrl: 'https://c.com' }),
      makeNote({ originalUrl: 'https://d.com' }),
    ];
    expect(getContinueWebsites(notes)).toHaveLength(3);
    expect(getContinueWebsites(notes, 2)).toHaveLength(2);
  });

  it('carries the latest note preview through', () => {
    const notes = [makeNote({ originalUrl: 'https://a.com', content: 'resume this thought' })];
    const [result] = getContinueWebsites(notes);
    expect(result.latestNotePreview).toBe('resume this thought');
  });
});

describe('derivePageLabel', () => {
  it('prefers the captured page title when present', () => {
    const note = makeNote({ pageContext: { title: 'My Article' } });
    expect(derivePageLabel(note)).toBe('My Article');
  });

  it('falls back to the URL pathname when there is no title', () => {
    const note = makeNote({ originalUrl: 'https://example.com/docs/getting-started' });
    expect(derivePageLabel(note)).toBe('/docs/getting-started');
  });

  it('strips a trailing slash from the pathname fallback', () => {
    const note = makeNote({ originalUrl: 'https://example.com/docs/' });
    expect(derivePageLabel(note)).toBe('/docs');
  });

  it('falls back to the hostname when the pathname is just "/"', () => {
    const note = makeNote({ originalUrl: 'https://example.com/' });
    expect(derivePageLabel(note)).toBe('example.com');
  });

  it('falls back to the raw URL for a malformed originalUrl', () => {
    const note = makeNote({ originalUrl: 'not-a-valid-url' });
    expect(derivePageLabel(note)).toBe('not-a-valid-url');
  });

  it('ignores a whitespace-only title and falls back to the pathname', () => {
    const note = makeNote({
      originalUrl: 'https://example.com/x',
      pageContext: { title: '   ' },
    });
    expect(derivePageLabel(note)).toBe('/x');
  });
});

describe('deriveMonogram', () => {
  it('is deterministic for the same domain', () => {
    expect(deriveMonogram('github.com')).toEqual(deriveMonogram('github.com'));
  });

  it('uses the first alphanumeric character, uppercased, as the letter', () => {
    expect(deriveMonogram('github.com').letter).toBe('G');
  });

  it('produces a colorIndex within the palette size', () => {
    const { colorIndex } = deriveMonogram('some-very-unusual-domain.example');
    expect(colorIndex).toBeGreaterThanOrEqual(0);
    expect(colorIndex).toBeLessThan(5);
  });

  it('falls back to # when the domain has no alphanumeric characters', () => {
    expect(deriveMonogram('---').letter).toBe('#');
  });
});
