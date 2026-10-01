import { useId, useMemo, useState } from 'react';
import { FOLDER_NAME_MAX, type Folder } from '@/domain/folder';
import { flattenFolderTree } from '@/domain/folder-grouping';
import { InlineError } from './kit/Feedback';
import { NameField } from './kit/NameField';
import { FolderIcon, PlusIcon, StarIcon } from './kit/icons';
import { FolderSelect } from './FolderSelect';
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
 * The folder list is the shared `FolderSelect`; naming a new one is the shared
 * `NameField`, right here, without leaving the note. With no folders at all
 * there is nothing to select, so the selector gives way to a one-line offer to
 * make one. A note never needs a folder: "No folder" is always there.
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
  const [createFailed, setCreateFailed] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const defaultsId = useId();
  const options = useMemo(() => flattenFolderTree(folders), [folders]);

  const isPageDefault = value !== null && value === pageDefaultId;
  const isGlobalDefault = value !== null && value === globalDefaultId;
  const isDefault = isPageDefault || isGlobalDefault;

  function closeCreate() {
    setCreating(false);
    setCreateFailed(false);
  }

  async function create(name: string) {
    try {
      const folderId = await onCreateFolder(name);
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
          <FolderIcon className="hm-folder-picker__glyph" />
          <NameField
            label={strings.newFolder}
            placeholder={strings.folderNamePlaceholder}
            maxLength={FOLDER_NAME_MAX}
            submitLabel={strings.create}
            cancelLabel={strings.cancel}
            onCancel={closeCreate}
            onSubmit={(name) => void create(name)}
          />
        </div>
        {createFailed && <InlineError>{strings.saveError}</InlineError>}
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="hm-folder-picker">
        <div className="hm-folder-picker__row">
          <FolderIcon className="hm-folder-picker__glyph" />
          <span className="hm-folder-picker__empty-text">{strings.composerNoFolders}</span>
          <button
            type="button"
            className="hm-link hm-link--accent"
            onClick={() => setCreating(true)}
          >
            <PlusIcon size={10} /> {strings.composerCreateFolder}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hm-folder-picker">
      <div className="hm-folder-picker__row">
        <FolderIcon className="hm-folder-picker__glyph" />
        <FolderSelect
          folders={options}
          value={value}
          label={strings.composerFolder}
          noneLabel={strings.noFolderOption}
          extra={{
            value: NEW_FOLDER_VALUE,
            label: strings.composerNewFolderOption,
            onSelect: () => {
              setDefaultsOpen(false);
              setCreating(true);
            },
          }}
          onChange={(next) => {
            setDefaultsOpen(false);
            onChange(next);
          }}
        />
        <button
          type="button"
          className="hm-icon-btn hm-folder-picker__star"
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
