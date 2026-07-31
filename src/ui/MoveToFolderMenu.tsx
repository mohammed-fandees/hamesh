import { useEffect, useRef, useState } from 'react';
import type { Folder } from '@/domain/folder';
import type { Note } from '@/domain/note';
import type { Strings } from './i18n';

interface MoveToFolderMenuProps {
  note: Note;
  /** Flat, depth-indented folder list — see `flattenFolderTreeForMenu`. */
  folders: { folder: Folder; depth: number }[];
  strings: Strings;
  onMove: (noteId: string, folderId: string | undefined) => void;
  /** Creates a new top-level folder and resolves to its id — deeper nesting
   *  is created from an existing folder node's own "+" in `FolderTree`, not
   *  from here. */
  onCreateFolder: (name: string) => Promise<string>;
}

/**
 * The "⋮ Move to…" trigger + dropdown attached to a note row in folder
 * mode. A plain `position: absolute` popover (not the content-script's
 * `useFloating` system, which anchors to live page/video elements in a
 * Shadow DOM — the wrong tool for a static-page menu here), closed on
 * outside-click or Escape.
 */
export function MoveToFolderMenu({
  note,
  folders,
  strings,
  onMove,
  onCreateFolder,
}: MoveToFolderMenuProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setCreating(false);
    setNewName('');
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function handleCreateAndMove() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const folderId = await onCreateFolder(trimmed);
    onMove(note.id, folderId);
    close();
  }

  return (
    <div className="hm-folder-menu" ref={rootRef}>
      <button
        type="button"
        className="hm-icon-btn hm-folder-menu__trigger"
        aria-label={strings.moveToFolder}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="2.4" r="1.15" fill="currentColor" />
          <circle cx="7" cy="7" r="1.15" fill="currentColor" />
          <circle cx="7" cy="11.6" r="1.15" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div className="hm-folder-menu__panel" role="menu" aria-label={strings.moveToFolder}>
          {creating ? (
            <div className="hm-folder-menu__create">
              <input
                type="text"
                className="hm-folder-menu__input"
                autoFocus
                value={newName}
                placeholder={strings.folderNamePlaceholder}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreateAndMove();
                }}
              />
              <button
                type="button"
                className="hm-link"
                disabled={!newName.trim()}
                onClick={() => void handleCreateAndMove()}
              >
                {strings.save}
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className="hm-folder-menu__item"
                onClick={() => {
                  onMove(note.id, undefined);
                  close();
                }}
              >
                {strings.noFolderOption}
              </button>
              {folders.map(({ folder, depth }) => (
                <button
                  key={folder.id}
                  type="button"
                  role="menuitem"
                  className="hm-folder-menu__item"
                  style={{ paddingInlineStart: 12 + depth * 14 }}
                  onClick={() => {
                    onMove(note.id, folder.id);
                    close();
                  }}
                >
                  {folder.name}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                className="hm-folder-menu__item hm-folder-menu__item--new"
                onClick={() => setCreating(true)}
              >
                + {strings.newFolder}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
