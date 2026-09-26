import { useCallback, useState } from 'react';
import { AttachedText } from './AttachedText';
import { FolderPicker, type FolderPickerSource } from './FolderPicker';
import { MarginMark } from './MarginMark';
import type { Strings } from './i18n';

interface ComposerProps {
  strings: Strings;
  /** For a contextual text note: the exact page text this note will be
   *  attached to, shown above the textarea so what's about to be anchored
   *  is never a guess. Absent when composing an ordinary element note. */
  attachedText?: string;
  /** Folders to file the note into, plus the page/global defaults the
   *  selector's star manages. Omitted, the composer has no folder selector
   *  and every note it saves is unfiled. */
  folderPicker?: FolderPickerSource & {
    /** Where the selector starts — the resolved default for this page (see
     *  `resolveDefaultFolderId`), or `null` for "No folder". */
    initialFolderId: string | null;
  };
  saving?: boolean;
  error?: string | null;
  /** `folderId` is `undefined` for an unfiled note. */
  onSave: (content: string, folderId: string | undefined) => void;
  onCancel: () => void;
}

/**
 * The note composer — a small card attached to the selected element (or the
 * selected text) by a short connector stub. Handles empty/typing/validation/
 * saving/error states.
 */
export function Composer({
  strings,
  attachedText,
  folderPicker,
  saving = false,
  error,
  onSave,
  onCancel,
}: ComposerProps) {
  const [content, setContent] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  // `undefined` until the user picks a folder themselves. Until then the
  // selector follows the resolved default — which can still arrive after
  // the composer opens (folders and preferences load asynchronously) — and
  // after that it never moves under them.
  const [chosenFolderId, setChosenFolderId] = useState<string | null | undefined>(undefined);
  const requestedFolderId =
    chosenFolderId === undefined ? (folderPicker?.initialFolderId ?? null) : chosenFolderId;
  // A folder deleted elsewhere while this note is being written is no
  // longer somewhere it can go.
  const folderId =
    requestedFolderId && folderPicker?.folders.some((f) => f.id === requestedFolderId)
      ? requestedFolderId
      : null;

  const handleSave = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) {
      setValidationError(strings.emptyError);
      return;
    }
    setValidationError(null);
    onSave(trimmed, folderId ?? undefined);
  }, [content, folderId, onSave, strings.emptyError]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave, onCancel],
  );

  const displayError = validationError ?? error ?? null;
  const canSave = content.trim().length > 0 && !saving;

  return (
    <div
      className="hm-card"
      role="dialog"
      aria-label={strings.note}
      aria-modal="false"
      onKeyDown={handleKeyDown}
    >
      <span className="hm-connector" aria-hidden="true" />
      <div className="hm-card-label">
        <MarginMark size={11} strokeWidth={4} />
        {strings.note}
      </div>
      {attachedText && <AttachedText label={strings.attachedText} text={attachedText} />}
      <textarea
        className="hm-textarea"
        dir="auto"
        autoFocus
        placeholder={strings.writePlaceholder}
        value={content}
        aria-label={strings.note}
        aria-invalid={displayError ? true : undefined}
        aria-describedby={displayError ? 'hm-composer-error' : undefined}
        onChange={(e) => {
          setContent(e.target.value);
          if (validationError) setValidationError(null);
        }}
      />
      {folderPicker && (
        <FolderPicker
          strings={strings}
          folders={folderPicker.folders}
          value={folderId}
          onChange={setChosenFolderId}
          pageDefaultId={folderPicker.pageDefaultId}
          globalDefaultId={folderPicker.globalDefaultId}
          onSetPageDefault={folderPicker.onSetPageDefault}
          onSetGlobalDefault={folderPicker.onSetGlobalDefault}
          onCreateFolder={folderPicker.onCreateFolder}
        />
      )}
      {displayError && (
        <p id="hm-composer-error" className="hm-error" role="alert">
          {displayError}
        </p>
      )}
      <div className="hm-row">
        <button type="button" className="hm-btn hm-btn-ghost" onClick={onCancel}>
          {strings.cancel}
        </button>
        <button
          type="button"
          className="hm-btn hm-btn-primary"
          onClick={handleSave}
          disabled={!canSave}
        >
          {saving ? strings.saving : strings.save}
        </button>
      </div>
    </div>
  );
}
