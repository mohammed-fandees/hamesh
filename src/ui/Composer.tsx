import { useState, type ReactNode } from 'react';
import { AttachedText } from './AttachedText';
import { FolderPicker, type FolderPickerSource } from './FolderPicker';
import { MarginMark } from './kit/MarginMark';
import { NoteEditor } from './NoteEditor';
import type { Strings } from './i18n';

export interface ComposerProps {
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
  /**
   * "Where it goes" — this device or a team — supplied by the content script
   * only in builds that have Teams, for a reader in a team. While it says a
   * team, this device's folders are not the question and the button says so.
   */
  destination?: { node: ReactNode; toTeam: boolean; saveLabel: string };
  saving?: boolean;
  error?: string | null;
  /** `folderId` is `undefined` for an unfiled note. */
  onSave: (content: string, folderId: string | undefined) => void;
  onCancel: () => void;
}

/**
 * The note composer — a small card attached to the selected element (or the
 * selected text) by a short connector stub: the note editor every writing
 * surface uses, with the folder it will be filed into under the words.
 */
export function Composer({
  strings,
  attachedText,
  folderPicker,
  destination,
  saving = false,
  error,
  onSave,
  onCancel,
}: ComposerProps) {
  const toTeam = destination?.toTeam ?? false;
  // `undefined` until the user picks a folder themselves. Until then the
  // selector follows the resolved default — which can still arrive after
  // the composer opens (folders and preferences load asynchronously) — and
  // after that it never moves under them.
  const [chosenFolderId, setChosenFolderId] = useState<string | null | undefined>(undefined);
  const requested =
    chosenFolderId === undefined ? (folderPicker?.initialFolderId ?? null) : chosenFolderId;
  // A folder deleted elsewhere while this note is being written is no
  // longer somewhere it can go.
  const folderId =
    requested && folderPicker?.folders.some((f) => f.id === requested) ? requested : null;

  return (
    <div className="hm-card" role="dialog" aria-label={strings.note} aria-modal="false">
      <span className="hm-connector" aria-hidden="true" />
      <div className="hm-card-label hm-overline">
        <MarginMark size={11} strokeWidth={4} />
        {strings.note}
      </div>
      {attachedText && <AttachedText label={strings.attachedText} text={attachedText} />}
      <NoteEditor
        strings={strings}
        label={strings.note}
        placeholder={strings.writePlaceholder}
        saveLabel={toTeam && destination ? destination.saveLabel : strings.save}
        saving={saving}
        error={error}
        onSave={(content) => onSave(content, folderId ?? undefined)}
        onCancel={onCancel}
      >
        {destination?.node}
        {folderPicker && !toTeam && (
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
      </NoteEditor>
    </div>
  );
}
