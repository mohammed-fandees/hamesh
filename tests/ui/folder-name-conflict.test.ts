import { describe, expect, it } from 'vitest';
import { folderNameConflict } from '@/ui/folder-name-conflict';
import { getStrings } from '@/ui/i18n';

const strings = getStrings('en');

describe('a folder name already used beside it', () => {
  it('is warned about, with the next free name offered', () => {
    expect(folderNameConflict(strings, ['Essays', 'Essays (2)'])('essays')).toEqual({
      message: strings.folderNameTaken('essays'),
      suggestion: 'essays (3)',
      useLabel: strings.folderNameUse('essays (3)'),
    });
  });

  it('says nothing about a name that is free', () => {
    expect(folderNameConflict(strings, ['Essays'])('Papers')).toBeNull();
  });
});
