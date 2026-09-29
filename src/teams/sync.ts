import type { ChangesResponse, TeamFolder, TeamNote } from '@hamesh/teams-contract';
import type { TeamsApi } from './api';
import { TeamsError } from './errors';
import type { CachedTeamNote } from './page-cache';
import { freshState, type CachedFolder, type SyncStore, type TeamSyncState } from './sync-store';

/**
 * Delta sync for a team's notes and folders.
 *
 * The server is asked one question — "what changed since this cursor?" — and
 * never which page anyone is on. Everything it answers is filed by page on this
 * device (see ./page-cache.ts), so the content script can draw a page's team
 * notes without a single request, and the server never learns a browsing URL.
 *
 * A cursor older than the server keeps deletions for comes back as
 * `cursor_expired`. There is no way to reconcile from there, so the team's cache
 * is dropped and pulled again from nothing — which is why every step below is
 * written to be safe to repeat.
 *
 * Runs only in the background service worker.
 */

/** Stops a server that always says `hasMore` from spinning here forever. */
const MAX_ROUNDS = 100;

export interface TeamSyncDeps {
  api: TeamsApi;
  store: SyncStore;
  /** The local page bucket for one page — `page-cache.ts`'s writer side. */
  readBucket: (pageKey: string) => Promise<CachedTeamNote[]>;
  writeBucket: (pageKey: string, notes: CachedTeamNote[]) => Promise<void>;
  /** `domain/page-key.ts`'s `generatePageKey`, injected so this stays testable. */
  pageKeyOf: (url: string) => string;
  now: () => number;
}

export interface SyncOutcome {
  /** How many rounds of `/changes` it took. */
  rounds: number;
  /** True when an expired cursor forced a pull from nothing. */
  resynced: boolean;
  /** The team's folders after this pull. */
  folders: CachedFolder[];
}

const isTombstone = (entry: unknown): entry is { id: string; deleted: true } =>
  !!entry && typeof entry === 'object' && (entry as { deleted?: unknown }).deleted === true;

function toCached(note: TeamNote, teamId: string): CachedTeamNote {
  return {
    id: note.id,
    teamId,
    originalUrl: note.originalUrl,
    pageTitle: note.pageTitle,
    content: note.content,
    anchor: note.anchor,
    folderId: note.folderId,
    authorId: note.authorId,
    version: note.version,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

const toCachedFolder = (folder: TeamFolder): CachedFolder => ({
  id: folder.id,
  parentId: folder.parentId,
  name: folder.name,
  createdAt: folder.createdAt,
  updatedAt: folder.updatedAt,
});

export function createTeamSync(deps: TeamSyncDeps) {
  /**
   * Buckets touched in one round, read once and written once. Every change is
   * an upsert or a delete keyed by note id, so applying the same round twice
   * leaves exactly the same result — which is what makes the crash window
   * below harmless.
   */
  class Buckets {
    private readonly loaded = new Map<string, CachedTeamNote[]>();

    private async bucket(pageKey: string): Promise<CachedTeamNote[]> {
      let notes = this.loaded.get(pageKey);
      if (!notes) {
        notes = await deps.readBucket(pageKey);
        this.loaded.set(pageKey, notes);
      }
      return notes;
    }

    async put(pageKey: string, note: CachedTeamNote): Promise<void> {
      const notes = await this.bucket(pageKey);
      const index = notes.findIndex((n) => n.id === note.id);
      if (index === -1) notes.push(note);
      else notes[index] = note;
    }

    async drop(pageKey: string, noteId: string): Promise<void> {
      const notes = await this.bucket(pageKey);
      const index = notes.findIndex((n) => n.id === noteId);
      if (index !== -1) notes.splice(index, 1);
    }

    async dropTeam(pageKey: string, teamId: string): Promise<void> {
      const notes = await this.bucket(pageKey);
      this.loaded.set(
        pageKey,
        notes.filter((n) => n.teamId !== teamId),
      );
    }

    flush(): Promise<void[]> {
      return Promise.all(
        [...this.loaded.entries()].map(([pageKey, notes]) => deps.writeBucket(pageKey, notes)),
      );
    }
  }

  async function apply(
    teamId: string,
    changes: ChangesResponse,
    state: TeamSyncState,
    buckets: Buckets,
  ): Promise<void> {
    for (const entry of changes.notes) {
      if (isTombstone(entry)) {
        const pageKey = state.pages[entry.id];
        if (pageKey) {
          await buckets.drop(pageKey, entry.id);
          delete state.pages[entry.id];
        }
        continue;
      }
      // The page a note belongs to is derived here, from the URL the server
      // stored — the same function the content script uses to ask for its own
      // page, so the two always agree.
      const pageKey = deps.pageKeyOf(entry.originalUrl);
      const previous = state.pages[entry.id];
      if (previous && previous !== pageKey) await buckets.drop(previous, entry.id);
      await buckets.put(pageKey, toCached(entry, teamId));
      state.pages[entry.id] = pageKey;
    }

    for (const entry of changes.folders) {
      if (isTombstone(entry)) {
        state.folders = state.folders.filter((f) => f.id !== entry.id);
        continue;
      }
      const folder = toCachedFolder(entry);
      const index = state.folders.findIndex((f) => f.id === folder.id);
      if (index === -1) state.folders.push(folder);
      else state.folders[index] = folder;
    }
  }

  /** Drops everything cached for one team, on this device only. */
  async function forgetTeam(teamId: string): Promise<void> {
    const state = await deps.store.get(teamId);
    const buckets = new Buckets();
    for (const pageKey of new Set(Object.values(state.pages))) {
      await buckets.dropTeam(pageKey, teamId);
    }
    await buckets.flush();
    await deps.store.remove(teamId);
  }

  async function pull(teamId: string, from: TeamSyncState): Promise<SyncOutcome> {
    const state: TeamSyncState = { ...from, pages: { ...from.pages }, folders: [...from.folders] };
    let rounds = 0;
    for (;;) {
      const changes = await deps.api.run('notes.changes', {
        teamId,
        ...(state.cursor ? { since: state.cursor } : {}),
      });
      rounds += 1;
      const buckets = new Buckets();
      await apply(teamId, changes, state, buckets);
      // Notes first, cursor second. If the worker dies in between, the next
      // pull repeats a round it has already applied — which changes nothing —
      // whereas saving the cursor first would skip those changes for good.
      await buckets.flush();
      state.cursor = changes.cursor;
      state.syncedAt = deps.now();
      await deps.store.set(teamId, state);
      if (!changes.hasMore || rounds >= MAX_ROUNDS) {
        return { rounds, resynced: false, folders: state.folders };
      }
    }
  }

  return {
    forgetTeam,

    /**
     * Brings one team's cache up to date. Returns what it did, and throws only
     * what the caller can act on (a `TeamsError` — offline, signed out, no
     * longer a member).
     */
    async syncTeam(teamId: string): Promise<SyncOutcome> {
      const state = await deps.store.get(teamId);
      try {
        return await pull(teamId, state);
      } catch (err) {
        if (!(err instanceof TeamsError) || err.code !== 'cursor_expired') throw err;
        // Too old to resume from. Nothing can be salvaged, so the team's cache
        // goes and the whole thing is pulled again.
        await forgetTeam(teamId);
        const outcome = await pull(teamId, freshState());
        return { ...outcome, resynced: true };
      }
    },

    /**
     * Forgets the cache of every team this account is no longer in — a team
     * left, deleted, or one this device simply never heard about again.
     */
    async reconcile(currentTeamIds: readonly string[]): Promise<string[]> {
      const current = new Set(currentTeamIds);
      const stale = (await deps.store.teamIds()).filter((id) => !current.has(id));
      for (const teamId of stale) await forgetTeam(teamId);
      return stale;
    },

    /**
     * Everything this device holds for one team: its notes, gathered from the
     * page buckets they are filed in, and its folders. What Hamesh's own Teams
     * page draws, so that page needs no request of its own either.
     */
    async snapshot(teamId: string): Promise<{
      notes: CachedTeamNote[];
      folders: CachedFolder[];
      syncedAt: number;
    }> {
      const state = await deps.store.get(teamId);
      const pageKeys = [...new Set(Object.values(state.pages))];
      const buckets = await Promise.all(pageKeys.map((pageKey) => deps.readBucket(pageKey)));
      const notes = buckets.flat().filter((note) => note.teamId === teamId);
      notes.sort((a, b) => b.updatedAt - a.updatedAt);
      return { notes, folders: state.folders, syncedAt: state.syncedAt };
    },
  };
}

export type TeamSync = ReturnType<typeof createTeamSync>;
