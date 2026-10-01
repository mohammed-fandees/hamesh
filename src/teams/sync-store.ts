import { parseFolderRecord } from '@/domain/folder';
import { createKvStore, type KvStore, type KvStoreOptions } from './idb';

/**
 * What the background worker remembers between pulls, per team: where the delta
 * stream got to, which page each cached note was filed under, and the team's
 * folders.
 *
 * Kept in the extension's own IndexedDB rather than beside the cached notes in
 * `chrome.storage.local` (see ./page-cache.ts). A cursor is not a secret, but
 * the note-to-page map is the shape of the whole team's noting across every
 * site, and a content script — which runs inside a web page — has no business
 * with more than the one page it is drawing.
 */

/** A team folder as the server described it. Structurally the contract's `TeamFolder`. */
export interface CachedFolder {
  id: string;
  parentId: string | null;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface TeamSyncState {
  /** Where to resume; null means "pull a full snapshot". */
  cursor: string | null;
  /** noteId → the page bucket that note was filed under. */
  pages: Record<string, string>;
  folders: CachedFolder[];
  /** When the last complete pull finished, or 0. */
  syncedAt: number;
}

export const freshState = (): TeamSyncState => ({
  cursor: null,
  pages: {},
  folders: [],
  syncedAt: 0,
});

export interface SyncStore {
  get(teamId: string): Promise<TeamSyncState>;
  set(teamId: string, state: TeamSyncState): Promise<void>;
  remove(teamId: string): Promise<void>;
  /** Every team this device holds a cache for. */
  teamIds(): Promise<string[]>;
}

const PREFIX = 'sync:';

const parseFolder = (value: unknown): CachedFolder | null => parseFolderRecord(value, 'number');

/**
 * Anything that does not parse is treated as no state at all, which costs one
 * full resync and never a wrong answer.
 */
export function parseSyncState(value: unknown): TeamSyncState {
  if (!value || typeof value !== 'object') return freshState();
  const raw = value as Record<string, unknown>;
  const pages: Record<string, string> = {};
  if (raw.pages && typeof raw.pages === 'object') {
    for (const [noteId, pageKey] of Object.entries(raw.pages as Record<string, unknown>)) {
      if (typeof pageKey === 'string') pages[noteId] = pageKey;
    }
  }
  const folders: CachedFolder[] = [];
  if (Array.isArray(raw.folders)) {
    for (const item of raw.folders) {
      const folder = parseFolder(item);
      if (folder) folders.push(folder);
    }
  }
  return {
    cursor: typeof raw.cursor === 'string' ? raw.cursor : null,
    pages,
    folders,
    syncedAt: typeof raw.syncedAt === 'number' ? raw.syncedAt : 0,
  };
}

export function createSyncStore(opts: KvStoreOptions | { kv: KvStore } = {}): SyncStore {
  const kv = 'kv' in opts ? opts.kv : createKvStore(opts);
  return {
    async get(teamId) {
      return parseSyncState(await kv.get(`${PREFIX}${teamId}`));
    },
    set(teamId, state) {
      return kv.put(`${PREFIX}${teamId}`, state);
    },
    remove(teamId) {
      return kv.del(`${PREFIX}${teamId}`);
    },
    async teamIds() {
      return (await kv.keys())
        .filter((key) => key.startsWith(PREFIX))
        .map((key) => key.slice(PREFIX.length));
    },
  };
}
