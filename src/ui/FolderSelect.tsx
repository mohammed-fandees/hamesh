import type { FolderLike } from '@/domain/folder';
import type { FlatFolder } from '@/domain/folder-grouping';

/** One step of nesting inside a native `<select>`, which draws no indentation
 *  of its own: three no-break spaces, which — unlike ordinary spaces — are not
 *  collapsed, so a folder inside a folder really does sit further in. */
const INDENT = '\u00A0\u00A0\u00A0';

export function folderOptionLabel(name: string, depth: number): string {
  return INDENT.repeat(depth) + name;
}

interface FolderSelectProps<T extends FolderLike> {
  /** Every folder, parents before children (`flattenFolderTree`). */
  folders: readonly FlatFolder<T>[];
  /** The chosen folder, or `null` for none. */
  value: string | null;
  onChange: (folderId: string | null) => void;
  label: string;
  /** What "no folder" is called. */
  noneLabel: string;
  /** One more choice after the folders — "New folder…" in the composer. */
  extra?: { value: string; label: string; onSelect: () => void };
  className?: string;
  disabled?: boolean;
}

/**
 * Choosing a folder from a native `<select>` — for a note being written, and
 * for a team's note being filed. The browser's own list is the one that can
 * never be clipped by a card or covered by a web page, and it is fully
 * keyboard- and screen-reader-operable for free. Folders are personal ones or a
 * team's alike: both are shaped the same here.
 */
export function FolderSelect<T extends FolderLike>({
  folders,
  value,
  onChange,
  label,
  noneLabel,
  extra,
  className,
  disabled,
}: FolderSelectProps<T>) {
  return (
    <select
      className={className ? `hm-input ${className}` : 'hm-input'}
      aria-label={label}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => {
        if (extra && e.target.value === extra.value) {
          extra.onSelect();
          return;
        }
        onChange(e.target.value || null);
      }}
    >
      <option value="">{noneLabel}</option>
      {folders.map(({ folder, depth }) => (
        <option key={folder.id} value={folder.id}>
          {folderOptionLabel(folder.name, depth)}
        </option>
      ))}
      {extra && <option value={extra.value}>{extra.label}</option>}
    </select>
  );
}
