import type { Folder } from './folder';
import type { Note } from './note';

/**
 * Local backup — taking your notes out of the browser, and putting them
 * back.
 *
 * Two rules shape everything here:
 *
 * 1. **Import never deletes.** A backup file is something people reach for
 *    when they are already anxious about their data; a restore that could
 *    remove notes is worse than no restore at all. Importing only ever adds
 *    what's missing and refreshes what's older — anything on this machine
 *    that isn't in the file is left exactly as it is.
 * 2. **A file is guilty until proven innocent.** It arrives from a disk, not
 *    from Hamesh, so every field is re-validated before a single note is
 *    written. A file that isn't a Hamesh backup is refused by name, not
 *    half-imported.
 */

/** Identifies the file as ours before anything reads its contents. */
export const BACKUP_FORMAT = 'hamesh-backup';

/** Bumped only if the envelope below changes shape incompatibly. Note and
 *  folder records carry their own `schemaVersion`/shape checks. */
export const BACKUP_FORMAT_VERSION = 1;

export interface HameshBackup {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  /** When the backup was taken (ISO). Shown to the user before importing. */
  exportedAt: string;
  /** The Hamesh version that wrote it — diagnostic only; a backup from a
   *  newer version still imports, since every record is validated anyway. */
  appVersion: string;
  notes: Note[];
  folders: Folder[];
}

export type BackupParseFailure =
  'invalid-json' | 'not-a-backup' | 'unsupported-version' | 'no-content';

export type BackupParseResult =
  { ok: true; backup: HameshBackup } | { ok: false; reason: BackupParseFailure };

/** The shape a stored note must have to be worth importing. Deliberately
 *  the same minimum `notes-repository`'s own `parseStoredNotes` insists on
 *  (an id and a page key), plus the fields the UI would crash without. */
function isImportableNote(value: unknown): value is Note {
  if (!value || typeof value !== 'object') return false;
  const note = value as Partial<Note>;
  return (
    typeof note.id === 'string' &&
    note.id.length > 0 &&
    typeof note.pageKey === 'string' &&
    note.pageKey.length > 0 &&
    typeof note.originalUrl === 'string' &&
    typeof note.content === 'string' &&
    !!note.anchor &&
    typeof note.anchor === 'object' &&
    typeof note.createdAt === 'string' &&
    typeof note.updatedAt === 'string'
  );
}

function isImportableFolder(value: unknown): value is Folder {
  if (!value || typeof value !== 'object') return false;
  const folder = value as Partial<Folder>;
  return (
    typeof folder.id === 'string' &&
    folder.id.length > 0 &&
    typeof folder.name === 'string' &&
    (folder.parentId === null || typeof folder.parentId === 'string') &&
    typeof folder.createdAt === 'string' &&
    typeof folder.updatedAt === 'string'
  );
}

export interface BuildBackupInput {
  notes: Note[];
  folders: Folder[];
  appVersion: string;
  /** Injected so the filename and contents are deterministic in tests. */
  now?: Date;
}

export function buildBackup(input: BuildBackupInput): HameshBackup {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    appVersion: input.appVersion,
    notes: input.notes,
    folders: input.folders,
  };
}

/** `hamesh-backup-2026-08-21.json` — sorted sensibly in a downloads folder,
 *  and obvious a year later. */
export function backupFileName(now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 10);
  return `hamesh-backup-${iso}.json`;
}

export function serializeBackup(backup: HameshBackup): string {
  // Indented: a backup is a file someone may well open in an editor to
  // check it really contains their notes before trusting it.
  return JSON.stringify(backup, null, 2);
}

/**
 * Reads a file's text into a backup, or explains why it can't. Malformed
 * individual records are dropped rather than failing the whole import — a
 * partially readable backup should still give back everything readable —
 * but a file with no readable content at all is refused, so "imported 0
 * notes" can never look like success.
 */
export function parseBackup(text: string): BackupParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'not-a-backup' };
  }

  const record = raw as Record<string, unknown>;
  if (record.format !== BACKUP_FORMAT) return { ok: false, reason: 'not-a-backup' };

  const formatVersion =
    typeof record.formatVersion === 'number' ? record.formatVersion : Number.NaN;
  if (!Number.isFinite(formatVersion) || formatVersion < 1) {
    return { ok: false, reason: 'not-a-backup' };
  }
  if (formatVersion > BACKUP_FORMAT_VERSION) {
    // Written by a newer Hamesh than this one. Refusing beats silently
    // dropping fields this build doesn't know about yet.
    return { ok: false, reason: 'unsupported-version' };
  }

  const notes = Array.isArray(record.notes) ? record.notes.filter(isImportableNote) : [];
  const folders = Array.isArray(record.folders) ? record.folders.filter(isImportableFolder) : [];
  if (notes.length === 0 && folders.length === 0) {
    return { ok: false, reason: 'no-content' };
  }

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      formatVersion,
      exportedAt: typeof record.exportedAt === 'string' ? record.exportedAt : '',
      appVersion: typeof record.appVersion === 'string' ? record.appVersion : '',
      notes,
      folders,
    },
  };
}

export interface MergeOutcome<T> {
  items: T[];
  /** Present in the file but not on this machine. */
  added: number;
  /** Present in both, and the file's copy was the more recently edited. */
  updated: number;
  /** Present in both, with this machine's copy left alone. */
  skipped: number;
}

/**
 * Merges incoming records into existing ones by id.
 *
 * Nothing is ever removed. When a record exists on both sides the more
 * recently edited copy wins, which is what makes this usable as a real
 * restore (an older backup can't undo newer edits) *and* as a sync between
 * two machines, without ever needing a destructive "replace everything"
 * mode.
 */
function mergeById<T extends { id: string; updatedAt: string }>(
  existing: T[],
  incoming: T[],
): MergeOutcome<T> {
  const byId = new Map(existing.map((item) => [item.id, item]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of incoming) {
    const current = byId.get(item.id);
    if (!current) {
      byId.set(item.id, item);
      added++;
    } else if (item.updatedAt > current.updatedAt) {
      byId.set(item.id, item);
      updated++;
    } else {
      skipped++;
    }
  }

  return { items: [...byId.values()], added, updated, skipped };
}

export function mergeNotes(existing: Note[], incoming: Note[]): MergeOutcome<Note> {
  return mergeById(existing, incoming);
}

export function mergeFolders(existing: Folder[], incoming: Folder[]): MergeOutcome<Folder> {
  return mergeById(existing, incoming);
}

/** Groups notes into the per-page buckets storage actually keeps them in. */
export function groupNotesByPageKey(notes: Note[]): Map<string, Note[]> {
  const byPage = new Map<string, Note[]>();
  for (const note of notes) {
    const bucket = byPage.get(note.pageKey);
    if (bucket) bucket.push(note);
    else byPage.set(note.pageKey, [note]);
  }
  return byPage;
}
