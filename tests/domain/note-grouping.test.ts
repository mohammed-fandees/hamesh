import { describe, it, expect } from 'vitest';
import { groupNotesByWebsite, getWebsiteKey } from '@/domain/note-grouping';
import type { Note, ElementAnchor } from '@/domain/note';

function makeAnchor(): ElementAnchor {
  return {
    primarySelector: null,
    signals: { tagName: 'div' },
    fallbackDocumentPosition: { x: 0, y: 0 },
  };
}

function makeNote(overrides: Partial<Note> & { pageKey: string; originalUrl: string }): Note {
  return {
    id: overrides.id ?? 'n1',
    schemaVersion: 1,
    content: overrides.content ?? 'test',
    anchor: overrides.anchor ?? makeAnchor(),
    createdAt: overrides.createdAt ?? '2024-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getWebsiteKey', () => {
  it('returns origin from valid originalUrl', () => {
    expect(getWebsiteKey({ originalUrl: 'https://example.com/page', pageKey: 'p' })).toBe(
      'https://example.com',
    );
  });

  it('falls back to pageKey origin if originalUrl is invalid', () => {
    expect(getWebsiteKey({ originalUrl: 'not-a-url', pageKey: 'https://foo.com/path' })).toBe(
      'https://foo.com',
    );
  });

  it('returns raw pageKey if neither URL parses', () => {
    expect(getWebsiteKey({ originalUrl: 'bad', pageKey: 'also-bad' })).toBe('also-bad');
  });

  it('handles URL with port', () => {
    expect(getWebsiteKey({ originalUrl: 'https://example.com:8080/page', pageKey: 'p' })).toBe(
      'https://example.com:8080',
    );
  });
});

describe('groupNotesByWebsite', () => {
  it('returns empty array for empty input', () => {
    expect(groupNotesByWebsite([])).toEqual([]);
  });

  it('groups a single note into one website with one page', () => {
    const notes = [
      makeNote({ pageKey: 'https://example.com/page', originalUrl: 'https://example.com/page' }),
    ];
    const groups = groupNotesByWebsite(notes);
    expect(groups).toHaveLength(1);
    expect(groups[0].websiteLabel).toBe('example.com');
    expect(groups[0].pages).toHaveLength(1);
    expect(groups[0].noteCount).toBe(1);
  });

  it('groups notes from same website different pages under one website', () => {
    const notes = [
      makeNote({ id: '1', pageKey: 'https://example.com/a', originalUrl: 'https://example.com/a' }),
      makeNote({ id: '2', pageKey: 'https://example.com/b', originalUrl: 'https://example.com/b' }),
    ];
    const groups = groupNotesByWebsite(notes);
    expect(groups).toHaveLength(1);
    expect(groups[0].pages).toHaveLength(2);
    expect(groups[0].noteCount).toBe(2);
  });

  it('groups notes from different websites into separate groups', () => {
    const notes = [
      makeNote({ id: '1', pageKey: 'https://a.com/page', originalUrl: 'https://a.com/page' }),
      makeNote({ id: '2', pageKey: 'https://b.com/page', originalUrl: 'https://b.com/page' }),
    ];
    const groups = groupNotesByWebsite(notes);
    expect(groups).toHaveLength(2);
  });

  it('tracks noteCount at website and page level', () => {
    const notes = [
      makeNote({ id: '1', pageKey: 'https://example.com/a', originalUrl: 'https://example.com/a' }),
      makeNote({ id: '2', pageKey: 'https://example.com/a', originalUrl: 'https://example.com/a' }),
      makeNote({ id: '3', pageKey: 'https://example.com/b', originalUrl: 'https://example.com/b' }),
    ];
    const groups = groupNotesByWebsite(notes);
    expect(groups[0].noteCount).toBe(3);
    expect(groups[0].pages[0].noteCount).toBe(2);
    expect(groups[0].pages[1].noteCount).toBe(1);
  });

  it('tracks latestUpdatedAt at website and page level', () => {
    const notes = [
      makeNote({
        id: '1',
        pageKey: 'https://example.com/a',
        originalUrl: 'https://example.com/a',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }),
      makeNote({
        id: '2',
        pageKey: 'https://example.com/a',
        originalUrl: 'https://example.com/a',
        updatedAt: '2024-06-01T00:00:00.000Z',
      }),
    ];
    const groups = groupNotesByWebsite(notes);
    expect(groups[0].latestUpdatedAt).toBe('2024-06-01T00:00:00.000Z');
    expect(groups[0].pages[0].latestUpdatedAt).toBe('2024-06-01T00:00:00.000Z');
  });

  it('sorts websites by latestUpdatedAt descending', () => {
    const notes = [
      makeNote({
        id: '1',
        pageKey: 'https://old.com/page',
        originalUrl: 'https://old.com/page',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }),
      makeNote({
        id: '2',
        pageKey: 'https://new.com/page',
        originalUrl: 'https://new.com/page',
        updatedAt: '2024-06-01T00:00:00.000Z',
      }),
    ];
    const groups = groupNotesByWebsite(notes);
    expect(groups[0].websiteLabel).toBe('new.com');
    expect(groups[1].websiteLabel).toBe('old.com');
  });

  it('sorts notes within a page by updatedAt descending', () => {
    const notes = [
      makeNote({
        id: '1',
        pageKey: 'https://example.com/page',
        originalUrl: 'https://example.com/page',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }),
      makeNote({
        id: '2',
        pageKey: 'https://example.com/page',
        originalUrl: 'https://example.com/page',
        updatedAt: '2024-06-01T00:00:00.000Z',
      }),
    ];
    const groups = groupNotesByWebsite(notes);
    expect(groups[0].pages[0].notes[0].id).toBe('2');
    expect(groups[0].pages[0].notes[1].id).toBe('1');
  });

  it('tie-breaks by label comparison alphabetically', () => {
    const notes = [
      makeNote({
        id: '1',
        pageKey: 'https://z.com/page',
        originalUrl: 'https://z.com/page',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }),
      makeNote({
        id: '2',
        pageKey: 'https://a.com/page',
        originalUrl: 'https://a.com/page',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }),
    ];
    const groups = groupNotesByWebsite(notes);
    expect(groups[0].websiteLabel).toBe('a.com');
    expect(groups[1].websiteLabel).toBe('z.com');
  });

  it('formats pageLabel stripping trailing slashes', () => {
    const notes = [
      makeNote({ pageKey: 'https://example.com/docs/', originalUrl: 'https://example.com/docs/' }),
    ];
    const groups = groupNotesByWebsite(notes);
    expect(groups[0].pages[0].pageLabel).toBe('example.com/docs');
  });

  it('shows host only for root path', () => {
    const notes = [
      makeNote({ pageKey: 'https://example.com/', originalUrl: 'https://example.com/' }),
    ];
    const groups = groupNotesByWebsite(notes);
    expect(groups[0].pages[0].pageLabel).toBe('example.com');
  });
});
