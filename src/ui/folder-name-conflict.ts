import { FOLDER_NAME_MAX } from '@/domain/folder';
import { nameTaken, nextFreeName } from '@/domain/unique-name';
import type { Strings } from './i18n';
import type { NameConflict } from './kit/NameField';

type Words = Pick<Strings, 'folderNameTaken' | 'folderNameUse'>;

/**
 * What a name field says about a folder name already used beside it. Only
 * folders in the same place count: two folders of one name in different places
 * can still be told apart.
 */
export function folderNameConflict(strings: Words, taken: readonly string[]) {
  return (name: string): NameConflict | null => {
    if (!nameTaken(name, taken)) return null;
    const suggestion = nextFreeName(name, taken, FOLDER_NAME_MAX);
    return {
      message: strings.folderNameTaken(name),
      suggestion,
      useLabel: strings.folderNameUse(suggestion),
    };
  };
}
