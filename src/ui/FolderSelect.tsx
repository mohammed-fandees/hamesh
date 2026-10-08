import type { FolderLike } from '@/domain/folder';
import type { FlatFolder } from '@/domain/folder-grouping';
import { Select, type SelectOption } from './kit/Select';

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
 * Choosing a folder — for a note being written, and for a team's note being
 * filed. A folder inside a folder sits one step further in. Folders are
 * personal ones or a team's alike: both are shaped the same here.
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
  const options: SelectOption[] = [
    { value: '', label: noneLabel },
    ...folders.map(({ folder, depth }) => ({ value: folder.id, label: folder.name, depth })),
    ...(extra
      ? [{ value: extra.value, label: extra.label, separated: true, tone: 'accent' as const }]
      : []),
  ];
  return (
    <Select
      options={options}
      value={value ?? ''}
      label={label}
      {...(className ? { className } : {})}
      {...(disabled ? { disabled } : {})}
      onChange={(next) => {
        if (extra && next === extra.value) {
          extra.onSelect();
          return;
        }
        onChange(next || null);
      }}
    />
  );
}
