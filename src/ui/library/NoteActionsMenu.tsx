import { useState } from 'react';
import { FOLDER_NAME_MAX } from '@/domain/folder';
import { mayMutateNote, type Note } from '@/domain/note';
import { InlineConfirm } from '../kit/InlineConfirm';
import { Menu, MenuDivider, MenuItem, MenuLabel } from '../kit/Menu';
import { NameField } from '../kit/NameField';
import { PencilIcon, PinIcon, PlusIcon, TrashIcon } from '../kit/icons';
import { NoteEditor } from '../NoteEditor';
import type { Strings } from '../i18n';
import type { NoteActions } from './NoteActions';
import { useShareAction } from './NoteShareSlot';

/** Which part of the menu is showing. A single panel swaps what it holds —
 *  items, a name to type, the note's words, a question — rather than stacking
 *  popovers, and Escape steps back one of these at a time. */
type View = 'menu' | 'creatingFolder' | 'editing' | 'confirmingDelete';

interface NoteActionsMenuProps {
  note: Note;
  strings: Strings;
  actions: NoteActions;
  /** Offer "Move to folder" — in the folder view, where filing is the point. The
   *  site groups and Pinned stay a shorter, flatter list. */
  movable?: boolean;
}

/**
 * The "⋮" on a note in the Library: pin, edit, move to a folder, share, delete —
 * all without leaving the Library.
 *
 * A note that lives in a team is not this device's to pin, edit, file or delete
 * (`mayMutateNote`): the menu offers what can be done with one from here —
 * open it where it lives — and the team's own page does the rest.
 */
export function NoteActionsMenu({ note, strings, actions, movable = false }: NoteActionsMenuProps) {
  const shareAction = useShareAction();
  const own = mayMutateNote(note);
  const [view, setView] = useState<View>('menu');

  return (
    <Menu
      label={strings.noteActions}
      form={view !== 'menu'}
      layoutKey={view}
      onClose={() => setView('menu')}
      className="hm-note-row__menu"
    >
      {(close) => {
        const back = () => setView('menu');
        switch (view) {
          case 'creatingFolder':
            return (
              <div className="hm-menu__form">
                <NameField
                  label={strings.newFolder}
                  placeholder={strings.folderNamePlaceholder}
                  maxLength={FOLDER_NAME_MAX}
                  submitLabel={strings.create}
                  cancelLabel={strings.cancel}
                  onCancel={back}
                  onSubmit={async (name) => {
                    const folderId = await actions.createFolder(name);
                    actions.move(note.id, folderId);
                    close();
                  }}
                />
              </div>
            );
          case 'editing':
            return (
              <div className="hm-menu__form">
                <NoteEditor
                  strings={strings}
                  initial={note.content}
                  label={strings.edit}
                  saveLabel={strings.saveChanges}
                  saving={actions.busy(note.id)}
                  error={actions.failed(note.id) ? strings.saveError : null}
                  onCancel={back}
                  onSave={async (content) => {
                    // Only a save that worked closes the menu; a refusal stays
                    // on screen, beside the words, to be read.
                    if (await actions.edit(note.id, content)) close();
                  }}
                />
              </div>
            );
          case 'confirmingDelete':
            return (
              <div className="hm-menu__form">
                <InlineConfirm
                  question={strings.deleteConfirm}
                  confirmLabel={strings.delete}
                  cancelLabel={strings.keepIt}
                  working={actions.busy(note.id)}
                  onCancel={back}
                  onConfirm={async () => {
                    await actions.remove(note.id);
                    close();
                  }}
                />
              </div>
            );
          case 'menu':
            return (
              <>
                {own && (
                  <>
                    <MenuItem
                      icon={<PinIcon filled={!!note.pinned} size={12} />}
                      onSelect={() => {
                        actions.togglePin(note.id);
                        close();
                      }}
                    >
                      {note.pinned ? strings.unpinNote : strings.pinNote}
                    </MenuItem>
                    <MenuItem icon={<PencilIcon />} onSelect={() => setView('editing')}>
                      {strings.edit}
                    </MenuItem>
                  </>
                )}

                {/* Filled by the Notes Library only in a build with Teams. */}
                {shareAction?.(note, close)}

                {own && movable && (
                  <>
                    <MenuDivider />
                    <MenuLabel>{strings.moveToFolder}</MenuLabel>
                    <MenuItem
                      checked={!note.folderId}
                      onSelect={() => {
                        actions.move(note.id, undefined);
                        close();
                      }}
                    >
                      {strings.noFolderOption}
                    </MenuItem>
                    {actions.folders.map(({ folder, depth }) => (
                      <MenuItem
                        key={folder.id}
                        depth={depth}
                        checked={folder.id === note.folderId}
                        onSelect={() => {
                          actions.move(note.id, folder.id);
                          close();
                        }}
                      >
                        {folder.name}
                      </MenuItem>
                    ))}
                    <MenuItem
                      tone="accent"
                      icon={<PlusIcon />}
                      onSelect={() => setView('creatingFolder')}
                    >
                      {strings.newFolder}
                    </MenuItem>
                  </>
                )}

                {own && (
                  <>
                    <MenuDivider />
                    <MenuItem
                      tone="danger"
                      icon={<TrashIcon />}
                      onSelect={() => setView('confirmingDelete')}
                    >
                      {strings.delete}
                    </MenuItem>
                  </>
                )}
              </>
            );
        }
      }}
    </Menu>
  );
}
