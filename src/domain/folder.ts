/**
 * A user-defined folder for organizing notes across sites. Stored flat (with
 * `parentId`) rather than as a nested object — the nested tree is a derived
 * view, built by `folder-grouping.ts`, the same way `notes-grouping.ts`
 * derives grouped view-data from a flat `Note[]`. Folders are a single
 * global object in storage (see `storage/folders-repository.ts`), not
 * per-page like notes — a folder tree isn't tied to any one page.
 */
export interface Folder {
  id: string;
  name: string;
  /** `null` for a top-level folder. */
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateFolderInput = {
  name: string;
  parentId?: string | null;
};

export interface FolderValidationError {
  field: 'name';
  message: string;
}

const MAX_NAME_LENGTH = 100;

export function validateFolderName(name: string): FolderValidationError | null {
  if (typeof name !== 'string') {
    return { field: 'name', message: 'Name must be a string' };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { field: 'name', message: 'Name cannot be empty' };
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { field: 'name', message: `Name cannot exceed ${MAX_NAME_LENGTH} characters` };
  }
  return null;
}

export function createFolder(input: CreateFolderInput): Folder {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    parentId: input.parentId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function renameFolder(folder: Folder, name: string): Folder {
  return { ...folder, name: name.trim(), updatedAt: new Date().toISOString() };
}

/** Defensively parses stored folders — a non-array, or any entry missing a
 *  string `id`/`name` or a `parentId` that isn't `string | null`, is dropped
 *  rather than throwing. Same drop-malformed-entries philosophy as
 *  `notes-repository.ts`'s `parseStoredNotes`. */
export function parseFolderState(data: unknown): Folder[] {
  if (!Array.isArray(data)) return [];
  const folders: Folder[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || typeof record.name !== 'string') continue;
    if (record.parentId !== null && typeof record.parentId !== 'string') continue;
    if (typeof record.createdAt !== 'string' || typeof record.updatedAt !== 'string') continue;
    folders.push({
      id: record.id,
      name: record.name,
      parentId: record.parentId as string | null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
  return folders;
}
