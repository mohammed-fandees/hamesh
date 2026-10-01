import { useState } from 'react';
import { FOLDER_NAME_MAX } from '@/domain/folder';
import { InlineConfirm } from './kit/InlineConfirm';
import { Menu, MenuDivider, MenuItem } from './kit/Menu';
import { NameField } from './kit/NameField';
import { PencilIcon, PlusIcon, TrashIcon } from './kit/icons';
import type { Strings } from './i18n';

type View = 'menu' | 'renaming' | 'addingChild' | 'confirmingDelete';

/** The words the menu says — the same for a personal folder and a team's. */
type FolderMenuStrings = Pick<
  Strings,
  | 'folderActions'
  | 'addSubfolder'
  | 'renameFolder'
  | 'deleteFolder'
  | 'newFolder'
  | 'folderNamePlaceholder'
  | 'save'
  | 'create'
  | 'cancel'
  | 'keepIt'
>;

interface FolderMenuProps {
  name: string;
  strings: FolderMenuStrings;
  /** What deleting this folder does to its notes, as a question. Personal and
   *  team folders answer it differently, so the owner says it. */
  deleteQuestion: string;
  /** True while this folder is being changed. */
  working?: boolean;
  onRename: (name: string) => Promise<unknown> | void;
  onDelete: () => Promise<unknown> | void;
  /** Offered where folders nest from the Library's tree. */
  onAddChild?: (name: string) => Promise<unknown> | void;
}

/**
 * The "⋮" on a folder — in the Library's folder view and on a team's folder
 * tiles alike: a folder inside it, a new name, or deleting it.
 *
 * Naming happens in the menu itself, through the one name field every folder
 * name goes through, so a folder's name is trimmed and held to its limit
 * wherever it is changed. Deleting asks first, in the same panel; the notes in
 * a deleted folder are never deleted with it.
 */
export function FolderMenu({
  name,
  strings,
  deleteQuestion,
  working,
  onRename,
  onDelete,
  onAddChild,
}: FolderMenuProps) {
  const [view, setView] = useState<View>('menu');
  return (
    <Menu
      label={strings.folderActions(name)}
      form={view !== 'menu'}
      layoutKey={view}
      onClose={() => setView('menu')}
    >
      {(close) => {
        const back = () => setView('menu');
        const then = (work: Promise<unknown> | void) => void Promise.resolve(work).then(close);
        switch (view) {
          case 'renaming':
          case 'addingChild':
            return (
              <div className="hm-menu__form">
                <NameField
                  label={view === 'renaming' ? strings.renameFolder : strings.newFolder}
                  initial={view === 'renaming' ? name : ''}
                  placeholder={strings.folderNamePlaceholder}
                  maxLength={FOLDER_NAME_MAX}
                  submitLabel={view === 'renaming' ? strings.save : strings.create}
                  cancelLabel={strings.cancel}
                  busy={working}
                  onCancel={back}
                  onSubmit={(next) =>
                    then(view === 'renaming' ? onRename(next) : onAddChild?.(next))
                  }
                />
              </div>
            );
          case 'confirmingDelete':
            return (
              <div className="hm-menu__form">
                <InlineConfirm
                  question={deleteQuestion}
                  confirmLabel={strings.deleteFolder}
                  cancelLabel={strings.keepIt}
                  working={working}
                  onCancel={back}
                  onConfirm={() => then(onDelete())}
                />
              </div>
            );
          case 'menu':
            return (
              <>
                {onAddChild && (
                  <MenuItem icon={<PlusIcon />} onSelect={() => setView('addingChild')}>
                    {strings.addSubfolder}
                  </MenuItem>
                )}
                <MenuItem icon={<PencilIcon />} onSelect={() => setView('renaming')}>
                  {strings.renameFolder}
                </MenuItem>
                <MenuDivider />
                <MenuItem
                  tone="danger"
                  icon={<TrashIcon />}
                  onSelect={() => setView('confirmingDelete')}
                >
                  {strings.deleteFolder}
                </MenuItem>
              </>
            );
        }
      }}
    </Menu>
  );
}
