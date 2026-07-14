import { describe, it, expect } from 'vitest';
import { createNote, updateNoteContent, validateNoteContent, validateNote } from '@/domain/note';
import type { ElementAnchor } from '@/domain/note';

function makeAnchor(overrides?: Partial<ElementAnchor>): ElementAnchor {
  return {
    primarySelector: null,
    signals: {
      tagName: 'div',
    },
    fallbackDocumentPosition: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('createNote', () => {
  it('returns correct shape', () => {
    const anchor = makeAnchor();
    const note = createNote({
      content: 'hello',
      pageKey: 'https://example.com',
      originalUrl: 'https://example.com',
      anchor,
    });

    expect(note).toHaveProperty('id');
    expect(note).toHaveProperty('schemaVersion', 1);
    expect(note).toHaveProperty('pageKey', 'https://example.com');
    expect(note).toHaveProperty('originalUrl', 'https://example.com');
    expect(note).toHaveProperty('content', 'hello');
    expect(note).toHaveProperty('anchor', anchor);
    expect(note).toHaveProperty('createdAt');
    expect(note).toHaveProperty('updatedAt');
  });

  it('generates unique IDs for successive calls', () => {
    const anchor = makeAnchor();
    const a = createNote({ content: 'a', pageKey: 'p', originalUrl: 'u', anchor });
    const b = createNote({ content: 'b', pageKey: 'p', originalUrl: 'u', anchor });
    expect(a.id).not.toBe(b.id);
  });

  it('carries an optional pageContext through unchanged', () => {
    const anchor = makeAnchor();
    const note = createNote({
      content: 'x',
      pageKey: 'p',
      originalUrl: 'u',
      anchor,
      pageContext: { title: 'Example Page' },
    });
    expect(note.pageContext).toEqual({ title: 'Example Page' });
  });

  it('leaves pageContext undefined when not provided (backward compatible)', () => {
    const anchor = makeAnchor();
    const note = createNote({ content: 'x', pageKey: 'p', originalUrl: 'u', anchor });
    expect(note.pageContext).toBeUndefined();
  });

  it('sets createdAt and updatedAt to ISO strings', () => {
    const anchor = makeAnchor();
    const before = Date.now();
    const note = createNote({ content: 'x', pageKey: 'p', originalUrl: 'u', anchor });
    const after = Date.now();

    const created = new Date(note.createdAt).getTime();
    const updated = new Date(note.updatedAt).getTime();

    expect(created).toBeGreaterThanOrEqual(before);
    expect(created).toBeLessThanOrEqual(after);
    expect(updated).toBe(created);
  });
});

describe('updateNoteContent', () => {
  it('updates content and updatedAt', () => {
    const anchor = makeAnchor();
    const note = createNote({ content: 'original', pageKey: 'p', originalUrl: 'u', anchor });
    const before = Date.now();

    const updated = updateNoteContent(note, { content: 'updated' });

    expect(updated.content).toBe('updated');
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(updated.id).toBe(note.id);
  });
});

describe('validateNoteContent', () => {
  it('returns null for valid content', () => {
    expect(validateNoteContent('hello')).toBeNull();
  });

  it('returns error for empty string', () => {
    const err = validateNoteContent('');
    expect(err).not.toBeNull();
    expect(err!.field).toBe('content');
  });

  it('returns error for whitespace-only string', () => {
    const err = validateNoteContent('   ');
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/empty/i);
  });

  it('returns error for non-string input', () => {
    const err = validateNoteContent(null as unknown as string);
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/string/i);
  });

  it('returns error for content exceeding 10000 characters', () => {
    const long = 'x'.repeat(10001);
    const err = validateNoteContent(long);
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/10000/i);
  });

  it('accepts content of exactly 10000 characters', () => {
    const long = 'x'.repeat(10000);
    expect(validateNoteContent(long)).toBeNull();
  });
});

describe('validateNote', () => {
  it('returns no errors for a valid note', () => {
    const anchor = makeAnchor();
    const note = createNote({ content: 'hello', pageKey: 'p', originalUrl: 'u', anchor });
    const errors = validateNote(note);
    expect(errors).toHaveLength(0);
  });

  it('returns error for missing id', () => {
    const anchor = makeAnchor();
    const note = createNote({ content: 'hello', pageKey: 'p', originalUrl: 'u', anchor });
    const errors = validateNote({ ...note, id: '' });
    expect(errors.some((e) => e.field === 'id')).toBe(true);
  });

  it('returns error for missing pageKey', () => {
    const anchor = makeAnchor();
    const note = createNote({ content: 'hello', pageKey: 'p', originalUrl: 'u', anchor });
    const errors = validateNote({ ...note, pageKey: '' });
    expect(errors.some((e) => e.field === 'pageKey')).toBe(true);
  });

  it('returns error for missing originalUrl', () => {
    const anchor = makeAnchor();
    const note = createNote({ content: 'hello', pageKey: 'p', originalUrl: 'u', anchor });
    const errors = validateNote({ ...note, originalUrl: '' });
    expect(errors.some((e) => e.field === 'originalUrl')).toBe(true);
  });

  it('returns error for missing anchor signals', () => {
    const anchor = makeAnchor();
    const note = createNote({ content: 'hello', pageKey: 'p', originalUrl: 'u', anchor });
    const errors = validateNote({ ...note, anchor: null as unknown as ElementAnchor });
    expect(errors.some((e) => e.field === 'anchor')).toBe(true);
  });

  it('returns error for empty content', () => {
    const anchor = makeAnchor();
    const note = createNote({ content: '', pageKey: 'p', originalUrl: 'u', anchor });
    const errors = validateNote(note);
    expect(errors.some((e) => e.field === 'content')).toBe(true);
  });

  it('collects multiple errors', () => {
    const note = {
      id: '',
      schemaVersion: 1 as const,
      pageKey: '',
      originalUrl: '',
      content: '',
      anchor: null as unknown as ElementAnchor,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    const errors = validateNote(note);
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});
