import { useId, useMemo, useState } from 'react';
import type { Folder } from '@/domain/folder';
import { validateFolderName } from '@/domain/folder';
import { buildFolderTree, flattenFolderTreeForMenu } from '@/domain/folder-grouping';
import { FolderGlyph } from './FolderGlyph';
import { StarIcon } from './StarIcon';
import type { Strings } from './i18n';

/** The `<select>` value of the trailing "New folder…" option. Not a folder
 *  id — `crypto.randomUUID()` never produces it. */
const NEW_FOLDER_VALUE = '__hm-new-folder__';

/** Everything the picker needs from whoever owns folders and defaults —
 *  `HameshApp`, in practice. Kept apart from `value`/`onChange` so the
 *  composer can pass this straight through while owning the selection. */
export interface FolderPickerSource {
  folders: Folder[];
  /** The page's own default, as stored — may name a folder that no longer
   *  exists, which simply never matches anything in `folders`. */
  pageDefaultId: string | null;
  globalDefaultId: string | null;
  onSetPageDefault: (folderId: string | null) => void;
  onSetGlobalDefault: (folderId: string | null) => void;
  /** Creates a top-level folder and resolves to its id. */
  onCreateFolder: (name: string) => Promise<string>;
}

interface FolderPickerProps extends FolderPickerSource {
  strings: Strings;
  value: string | null;
  onChange: (folderId: string | null) => void;
}

/**
 * The composer's folder selector: which folder the note being written will
 * be filed into, and — through the star beside it — whether that folder is
 * the default for this page, for every page, or both.
 *
 * A native `<select>` rather than a custom listbox: it's inside a floating
 * card on someone else's page, where the browser's own popup is the one
 * dropdown that can never be clipped by the card or covered by the page,
 * and it's fully keyboard- and screen-reader-operable for free. Nesting is
 * shown by indentation, the same flat walk `NoteActionsMenu`'s "Move to
 * folder" list uses.
 *
 * With no folders at all there is nothing to select, so the selector is
 * replaced by a one-line empty state offering to create one on the spot.
 * The note never needs a folder: "No folder" is always available, and an
 * empty state is only an offer.
 */
export function FolderPicker({
  strings,
  folders,
  value,
  onChange,
  pageDefaultId,
  globalDefaultId,
  onSetPageDefault,
  onSetGlobalDefault,
  onCreateFolder,
}: FolderPickerProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createFailed, setCreateFailed] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const defaultsId = useId();

  const options = useMemo(
    () => flattenFolderTreeForMenu(buildFolderTree(folders, []).tree),
    [folders],
  );

  const isPageDefault = value !== null && value === pageDefaultId;
  const isGlobalDefault = value !== null && value === globalDefaultId;
  const isDefault = isPageDefault || isGlobalDefault;
  const canCreate = validateFolderName(newName) === null;

  function closeCreate() {
    setCreating(false);
    setNewName('');
    setCreateFailed(false);
  }

  async function submitCreate() {
    if (!canCreate) return;
    try {
      const folderId = await onCreateFolder(newName.trim());
      closeCreate();
      onChange(folderId);
    } catch {
      setCreateFailed(true);
    }
  }

  if (creating) {
    return (
      <div className="hm-folder-picker">
        <div className="hm-folder-picker__row">
          <FolderGlyph className="hm-folder-picker__glyph" />
          <input
            type="text"
            className="hm-folder-picker__input"
            dir="auto"
            autoFocus
            value={newName}
            placeholder={strings.folderNamePlaceholder}
            aria-label={strings.newFolder}
            onChange={(e) => {
              setNewName(e.target.value);
              if (createFailed) setCreateFailed(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                void submitCreate();
              } else if (e.key === 'Escape') {
                // Backs out of naming a folder only — the note being written
                // stays open, the same one-level-at-a-time Escape
                // `NoteActionsMenu` uses.
                e.preventDefault();
                e.stopPropagation();
                closeCreate();
              }
            }}
          />
          <button
            type="button"
            className="hm-link"
            disabled={!canCreate}
            onClick={() => void submitCreate()}
          >
            {strings.composerCreateFolderSubmit}
          </button>
          <button
            type="button"
            className="hm-folder-picker__icon-btn"
            aria-label={strings.cancel}
            onClick={closeCreate}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path
                d="M2 2 L8 8 M8 2 L2 8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {createFailed && (
          <p className="hm-error" role="alert">
            {strings.saveError}
          </p>
        )}
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="hm-folder-picker">
        <div className="hm-folder-picker__row hm-folder-picker__empty">
          <FolderGlyph className="hm-folder-picker__glyph" />
          <span className="hm-folder-picker__empty-text">{strings.composerNoFolders}</span>
          <button type="button" className="hm-link" onClick={() => setCreating(true)}>
            + {strings.composerCreateFolder}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hm-folder-picker">
      <div className="hm-folder-picker__row">
        <FolderGlyph className="hm-folder-picker__glyph" />
        <select
          className="hm-folder-picker__select"
          aria-label={strings.composerFolder}
          value={value ?? ''}
          onChange={(e) => {
            setDefaultsOpen(false);
            if (e.target.value === NEW_FOLDER_VALUE) {
              setCreating(true);
              return;
            }
            onChange(e.target.value || null);
          }}
        >
          <option value="">{strings.noFolderOption}</option>
          {options.map(({ folder, depth }) => (
            <option key={folder.id} value={folder.id}>
              {'   '.repeat(depth) + folder.name}
            </option>
          ))}
          <option value={NEW_FOLDER_VALUE}>{strings.composerNewFolderOption}</option>
        </select>
        <button
          type="button"
          className="hm-folder-picker__icon-btn hm-folder-picker__star"
          aria-label={strings.defaultFolderMenu}
          aria-expanded={defaultsOpen}
          aria-controls={defaultsOpen ? defaultsId : undefined}
          data-default={isDefault}
          // "No folder" can't be anyone's default — there is nothing to star.
          disabled={value === null}
          onClick={() => setDefaultsOpen((open) => !open)}
        >
          <StarIcon filled={isDefault} />
        </button>
      </div>
      {defaultsOpen && value !== null ? (
        <div
          id={defaultsId}
          className="hm-folder-picker__defaults"
          role="group"
          aria-label={strings.defaultFolderMenu}
        >
          <label className="hm-folder-picker__default">
            <input
              type="checkbox"
              checked={isPageDefault}
              onChange={(e) => onSetPageDefault(e.target.checked ? value : null)}
            />
            {strings.defaultFolderForPage}
          </label>
          <label className="hm-folder-picker__default">
            <input
              type="checkbox"
              checked={isGlobalDefault}
              onChange={(e) => onSetGlobalDefault(e.target.checked ? value : null)}
            />
            {strings.defaultFolderForAllPages}
          </label>
        </div>
      ) : (
        isDefault && (
          <p className="hm-folder-picker__caption">
            {strings.defaultFolderCaption(isPageDefault, isGlobalDefault)}
          </p>
        )
      )}
    </div>
  );
}
