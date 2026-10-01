/**
 * A user-defined folder for organizing notes across sites. Stored flat (with
 * `parentId`) rather than as a nested object — the nested tree is a derived
 * view, built by `folder-grouping.ts`, the same way `notes-grouping.ts`
 * derives grouped view-data from a flat `Note[]`. Folders are a single
 * global object in storage (see `storage/folders-repository.ts`), not
 * per-page like notes — a folder tree isn't tied to any one page.
 */
export interface Folder extends FolderLike {
  createdAt: string;
  updatedAt: string;
}

/**
 * The part of a folder a tree is built from. A personal folder (`Folder`, ISO
 * timestamps, stored on this device) and a team's folder (`CachedFolder`, epoch
 * timestamps, the server's) are different things that happen to be shaped the
 * same here — so the tree (`folder-grouping.ts`) and the parser below work on
 * either, and neither keeps a copy of its own.
 */
export interface FolderLike {
  id: string;
  name: string;
  /** `null` for a top-level folder. */
  parentId: string | null;
}

export type CreateFolderInput = {
  name: string;
  parentId?: string | null;
};

export interface FolderValidationError {
  field: 'name';
  message: string;
}

/** The longest a folder's name may be — the same for a team's folders, whose
 *  server applies the same rule. */
export const FOLDER_NAME_MAX = 100;

/**
 * What is wrong with a name, if anything: nothing left after trimming, or more
 * than `maxLength` once trimmed. The one naming rule in Hamesh — a folder's
 * (here or in a team, whose server applies the same) and a team's own — with
 * only the limit differing.
 */
export function nameProblem(name: string, maxLength: number): 'empty' | 'too-long' | null {
  if (typeof name !== 'string') return 'empty';
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'empty';
  return trimmed.length > maxLength ? 'too-long' : null;
}

export function validateFolderName(name: string): FolderValidationError | null {
  if (typeof name !== 'string') {
    return { field: 'name', message: 'Name must be a string' };
  }
  switch (nameProblem(name, FOLDER_NAME_MAX)) {
    case 'empty':
      return { field: 'name', message: 'Name cannot be empty' };
    case 'too-long':
      return { field: 'name', message: `Name cannot exceed ${FOLDER_NAME_MAX} characters` };
    default:
      return null;
  }
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

type Stamp<K extends 'string' | 'number'> = K extends 'string' ? string : number;

/**
 * One folder record read defensively, or `null` — the single place that says
 * what a folder must carry: a non-empty string `id`, a string `name`, a
 * `parentId` that is a string or `null`, and both timestamps in the stated
 * form (ISO strings on this device, epoch numbers from the server). Every
 * reader of stored, imported or cached folders goes through this, so they
 * cannot drift into three strictness levels again.
 */
export function parseFolderRecord<K extends 'string' | 'number'>(
  value: unknown,
  timestamps: K,
): (FolderLike & { createdAt: Stamp<K>; updatedAt: Stamp<K> }) | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.length === 0) return null;
  if (typeof record.name !== 'string') return null;
  if (record.parentId !== null && typeof record.parentId !== 'string') return null;
  if (typeof record.createdAt !== timestamps || typeof record.updatedAt !== timestamps) return null;
  return {
    id: record.id,
    name: record.name,
    parentId: record.parentId,
    createdAt: record.createdAt as Stamp<K>,
    updatedAt: record.updatedAt as Stamp<K>,
  };
}

/** Defensively parses stored folders — a non-array, or any entry
 *  `parseFolderRecord` refuses, is dropped rather than throwing. Same
 *  drop-malformed-entries philosophy as `notes-repository.ts`. */
export function parseFolderState(data: unknown): Folder[] {
  if (!Array.isArray(data)) return [];
  return data.map((item) => parseFolderRecord(item, 'string')).filter((f) => f !== null);
}
