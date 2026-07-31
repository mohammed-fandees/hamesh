import { describe, it, expect } from 'vitest';
import { createFolder, renameFolder, validateFolderName, parseFolderState } from '@/domain/folder';

describe('createFolder', () => {
  it('returns correct shape for a top-level folder', () => {
    const folder = createFolder({ name: 'Work' });
    expect(folder).toHaveProperty('id');
    expect(folder.name).toBe('Work');
    expect(folder.parentId).toBeNull();
    expect(folder).toHaveProperty('createdAt');
    expect(folder).toHaveProperty('updatedAt');
  });

  it('accepts an explicit parentId for nesting', () => {
    const folder = createFolder({ name: 'Research', parentId: 'parent-1' });
    expect(folder.parentId).toBe('parent-1');
  });

  it('trims the name', () => {
    const folder = createFolder({ name: '  Work  ' });
    expect(folder.name).toBe('Work');
  });

  it('generates unique IDs for successive calls', () => {
    const a = createFolder({ name: 'A' });
    const b = createFolder({ name: 'B' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('renameFolder', () => {
  it('updates the name and bumps updatedAt', () => {
    const folder = createFolder({ name: 'Old name' });
    const before = Date.now();
    const renamed = renameFolder(folder, 'New name');

    expect(renamed.name).toBe('New name');
    expect(renamed.id).toBe(folder.id);
    expect(new Date(renamed.updatedAt).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('trims the new name', () => {
    const folder = createFolder({ name: 'Work' });
    const renamed = renameFolder(folder, '  Personal  ');
    expect(renamed.name).toBe('Personal');
  });
});

describe('validateFolderName', () => {
  it('returns null for a valid name', () => {
    expect(validateFolderName('Work')).toBeNull();
  });

  it('returns an error for an empty string', () => {
    const err = validateFolderName('');
    expect(err).not.toBeNull();
    expect(err!.field).toBe('name');
  });

  it('returns an error for a whitespace-only string', () => {
    const err = validateFolderName('   ');
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/empty/i);
  });

  it('returns an error for a non-string value', () => {
    const err = validateFolderName(null as unknown as string);
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/string/i);
  });

  it('returns an error for a name exceeding 100 characters', () => {
    const err = validateFolderName('x'.repeat(101));
    expect(err).not.toBeNull();
    expect(err!.message).toMatch(/100/);
  });

  it('accepts a name of exactly 100 characters', () => {
    expect(validateFolderName('x'.repeat(100))).toBeNull();
  });
});

describe('parseFolderState', () => {
  it('returns an empty array for non-array input', () => {
    expect(parseFolderState(null)).toEqual([]);
    expect(parseFolderState(undefined)).toEqual([]);
    expect(parseFolderState({})).toEqual([]);
    expect(parseFolderState('not an array')).toEqual([]);
  });

  it('returns an empty array for an empty array', () => {
    expect(parseFolderState([])).toEqual([]);
  });

  it('keeps well-formed entries', () => {
    const stored = [
      { id: 'f1', name: 'Work', parentId: null, createdAt: 'a', updatedAt: 'b' },
      { id: 'f2', name: 'Research', parentId: 'f1', createdAt: 'a', updatedAt: 'b' },
    ];
    expect(parseFolderState(stored)).toEqual(stored);
  });

  it('drops entries missing a string id or name', () => {
    const stored = [
      { id: 'f1', name: 'Work', parentId: null, createdAt: 'a', updatedAt: 'b' },
      { id: 123, name: 'Bad id', parentId: null, createdAt: 'a', updatedAt: 'b' },
      { id: 'f2', name: 42, parentId: null, createdAt: 'a', updatedAt: 'b' },
    ];
    const result = parseFolderState(stored);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f1');
  });

  it('drops entries whose parentId is neither a string nor null', () => {
    const stored = [
      { id: 'f1', name: 'Work', parentId: undefined, createdAt: 'a', updatedAt: 'b' },
      { id: 'f2', name: 'Personal', parentId: 42, createdAt: 'a', updatedAt: 'b' },
    ];
    expect(parseFolderState(stored)).toEqual([]);
  });

  it('drops entirely malformed entries without throwing', () => {
    const stored = [
      null,
      'garbage',
      42,
      { id: 'f1', name: 'Work', parentId: null, createdAt: 'a', updatedAt: 'b' },
    ];
    const result = parseFolderState(stored);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f1');
  });
});
