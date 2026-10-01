import { CopyIcon, OpenElsewhereIcon, TrashIcon } from './kit/icons';
import { Menu, MenuItem } from './kit/Menu';
import type { Strings } from './i18n';
import { copyText } from '@/utils/clipboard';
import css from './note-menu.css?inline';

interface NoteMenuProps {
  strings: Strings;
  /** What "Copy" puts on the clipboard: the note's words. */
  text: string;
  /** Opens the note where it lives in Hamesh — the Library, or its team. */
  onOpenInHamesh: () => void;
  /** Asks to delete it; absent where this reader may not. The caller asks
   *  "delete this?" before anything goes. */
  onDelete?: () => void;
}

/**
 * The one menu a note has wherever it is opened — its popup on a page, a
 * shared one's popup, and the side panel: open it in Hamesh, copy it, delete it.
 */
export function NoteMenu({ strings, text, onOpenInHamesh, onDelete }: NoteMenuProps) {
  return (
    <>
      <style>{css}</style>
      <Menu label={strings.noteActions}>
        {(close) => (
          <>
            <MenuItem
              icon={<OpenElsewhereIcon />}
              onSelect={() => {
                close();
                onOpenInHamesh();
              }}
            >
              {strings.openInHamesh}
            </MenuItem>
            <MenuItem
              icon={<CopyIcon />}
              onSelect={() => {
                close();
                void copyText(text);
              }}
            >
              {strings.copyNote}
            </MenuItem>
            {onDelete && (
              <MenuItem
                tone="danger"
                icon={<TrashIcon size={13} />}
                onSelect={() => {
                  close();
                  onDelete();
                }}
              >
                {strings.delete}
              </MenuItem>
            )}
          </>
        )}
      </Menu>
    </>
  );
}
