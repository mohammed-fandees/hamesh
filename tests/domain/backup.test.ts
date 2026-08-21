import { describe, it, expect } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  backupFileName,
  buildBackup,
  groupNotesByPageKey,
  mergeFolders,
  mergeNotes,
  parseBackup,
  serializeBackup,
} from '@/domain/backup';
import type { Folder } from '@/domain/folder';
import type { Note } from '@/domain/note';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    schemaVersion: 1,
    pageKey: 'https://example.com/page',
    originalUrl: 'https://example.com/page',
    content: 'A note',
    anchor: {
      type: 'element',
      primarySelector: null,
      signals: { tagName: 'div' },
      fallbackDocumentPosition: { x: 0, y: 0 },
    },
    workspaceId: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: 'f1',
    name: 'Reading',
    parentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildBackup / serializeBackup', () => {
  it('wraps notes and folders in an identifiable, versioned envelope', () => {
    const backup = buildBackup({
      notes: [makeNote()],
      folders: [makeFolder()],
      appVersion: '1.2.3',
      now: new Date('2026-08-21T10:00:00.000Z'),
    });
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(backup.exportedAt).toBe('2026-08-21T10:00:00.000Z');
    expect(backup.appVersion).toBe('1.2.3');
    expect(backup.notes).toHaveLength(1);
    expect(backup.folders).toHaveLength(1);
  });

  it('round-trips through serialize and parse without losing a field', () => {
    const note = makeNote({ pinned: true, folderId: 'f1', pageContext: { title: 'Page' } });
    const backup = buildBackup({ notes: [note], folders: [makeFolder()], appVersion: '1.2.3' });

    const parsed = parseBackup(serializeBackup(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.notes[0]).toEqual(note);
    expect(parsed.backup.folders[0]).toEqual(makeFolder());
  });

  it('round-trips a contextual text note, anchor and all', () => {
    const note = makeNote({
      id: 'text-note',
      anchor: {
        type: 'text',
        version: 1,
        exact: 'Performance is extremely important',
        context: { prefix: 'intro: ', suffix: ' in large applications.' },
        textPosition: { start: 7, end: 41 },
        path: { startPath: [0, 1], startOffset: 4, endPath: [0, 1], endOffset: 38 },
      },
    });
    const parsed = parseBackup(
      serializeBackup(buildBackup({ notes: [note], folders: [], appVersion: '1.2.3' })),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.notes[0].anchor).toEqual(note.anchor);
  });
});

describe('backupFileName', () => {
  it('is dated, so a folder of backups sorts and reads sensibly', () => {
    expect(backupFileName(new Date('2026-08-21T22:00:00.000Z'))).toBe(
      'hamesh-backup-2026-08-21.json',
    );
  });
});

describe('parseBackup — refusing what it should', () => {
  it('refuses text that is not JSON', () => {
    expect(parseBackup('not json at all')).toEqual({ ok: false, reason: 'invalid-json' });
  });

  it('refuses JSON that is not a Hamesh backup', () => {
    expect(parseBackup('{"hello":"world"}')).toEqual({ ok: false, reason: 'not-a-backup' });
    expect(parseBackup('[]')).toEqual({ ok: false, reason: 'not-a-backup' });
    expect(parseBackup('null')).toEqual({ ok: false, reason: 'not-a-backup' });
  });

  it('refuses a backup written by a newer Hamesh', () => {
    const future = JSON.stringify({
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION + 1,
      notes: [makeNote()],
      folders: [],
    });
    // Better to refuse than to import while silently dropping fields this
    // build doesn't understand.
    expect(parseBackup(future)).toEqual({ ok: false, reason: 'unsupported-version' });
  });

  it('refuses a backup with nothing readable in it', () => {
    const empty = JSON.stringify({
      format: BACKUP_FORMAT,
      formatVersion: 1,
      notes: [],
      folders: [],
    });
    expect(parseBackup(empty)).toEqual({ ok: false, reason: 'no-content' });
  });

  it('refuses a file whose records are all malformed, rather than importing nothing', () => {
    const junk = JSON.stringify({
      format: BACKUP_FORMAT,
      formatVersion: 1,
      notes: [{ id: 'x' }, null, 'note', 42],
      folders: [{ name: 'no id' }],
    });
    expect(parseBackup(junk)).toEqual({ ok: false, reason: 'no-content' });
  });
});

describe('parseBackup — salvaging what it can', () => {
  it('keeps the readable records and drops the broken ones', () => {
    const mixed = JSON.stringify({
      format: BACKUP_FORMAT,
      formatVersion: 1,
      notes: [makeNote({ id: 'good' }), { id: 'broken' }, null],
      folders: [makeFolder({ id: 'good-folder' }), { id: 'broken-folder' }],
    });
    const parsed = parseBackup(mixed);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.notes.map((n) => n.id)).toEqual(['good']);
    expect(parsed.backup.folders.map((f) => f.id)).toEqual(['good-folder']);
  });

  it('tolerates a missing exportedAt/appVersion rather than refusing the file', () => {
    const minimal = JSON.stringify({
      format: BACKUP_FORMAT,
      formatVersion: 1,
      notes: [makeNote()],
    });
    const parsed = parseBackup(minimal);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.exportedAt).toBe('');
    expect(parsed.backup.folders).toEqual([]);
  });
});

describe('mergeNotes — the rule that import never deletes', () => {
  it('adds notes that are not here yet', () => {
    const result = mergeNotes([makeNote({ id: 'a' })], [makeNote({ id: 'b' })]);
    expect(result.items.map((n) => n.id).sort()).toEqual(['a', 'b']);
    expect(result).toMatchObject({ added: 1, updated: 0, skipped: 0 });
  });

  it('keeps notes that exist here but not in the file', () => {
    // The whole point: restoring an old backup must not wipe newer work.
    const result = mergeNotes(
      [makeNote({ id: 'local-only', content: 'Written after the backup' })],
      [makeNote({ id: 'in-backup' })],
    );
    expect(result.items.map((n) => n.id).sort()).toEqual(['in-backup', 'local-only']);
  });

  it('lets the more recently edited copy win when a note exists on both sides', () => {
    const local = makeNote({ id: 'same', content: 'local', updatedAt: '2026-05-01T00:00:00.000Z' });
    const newer = makeNote({
      id: 'same',
      content: 'from the backup',
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    const result = mergeNotes([local], [newer]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].content).toBe('from the backup');
    expect(result).toMatchObject({ added: 0, updated: 1, skipped: 0 });
  });

  it('does not let an older backup undo a newer edit', () => {
    const local = makeNote({
      id: 'same',
      content: 'edited today',
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    const stale = makeNote({ id: 'same', content: 'old', updatedAt: '2026-05-01T00:00:00.000Z' });
    const result = mergeNotes([local], [stale]);
    expect(result.items[0].content).toBe('edited today');
    expect(result).toMatchObject({ added: 0, updated: 0, skipped: 1 });
  });

  it('is idempotent — importing the same file twice changes nothing the second time', () => {
    const incoming = [makeNote({ id: 'a' }), makeNote({ id: 'b' })];
    const first = mergeNotes([], incoming);
    const second = mergeNotes(first.items, incoming);
    expect(second.items).toHaveLength(2);
    expect(second).toMatchObject({ added: 0, updated: 0, skipped: 2 });
  });

  it('merges an empty file into an empty library without inventing anything', () => {
    expect(mergeNotes([], [])).toMatchObject({ items: [], added: 0, updated: 0, skipped: 0 });
  });
});

describe('mergeFolders', () => {
  it('follows the same never-delete rule as notes', () => {
    const result = mergeFolders(
      [makeFolder({ id: 'local' })],
      [makeFolder({ id: 'restored', name: 'From backup' })],
    );
    expect(result.items.map((f) => f.id).sort()).toEqual(['local', 'restored']);
    expect(result).toMatchObject({ added: 1, updated: 0, skipped: 0 });
  });

  it('restores a renamed folder when the backup is the newer copy', () => {
    const local = makeFolder({ id: 'f1', name: 'Old', updatedAt: '2026-05-01T00:00:00.000Z' });
    const renamed = makeFolder({ id: 'f1', name: 'New', updatedAt: '2026-06-01T00:00:00.000Z' });
    expect(mergeFolders([local], [renamed]).items[0].name).toBe('New');
  });
});

describe('groupNotesByPageKey', () => {
  it('buckets notes the way storage keeps them', () => {
    const grouped = groupNotesByPageKey([
      makeNote({ id: 'a', pageKey: 'page-1' }),
      makeNote({ id: 'b', pageKey: 'page-2' }),
      makeNote({ id: 'c', pageKey: 'page-1' }),
    ]);
    expect([...grouped.keys()].sort()).toEqual(['page-1', 'page-2']);
    expect(grouped.get('page-1')?.map((n) => n.id)).toEqual(['a', 'c']);
    expect(grouped.get('page-2')?.map((n) => n.id)).toEqual(['b']);
  });
});
