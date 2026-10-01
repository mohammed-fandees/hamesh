/** A key in the extension's local storage area. */
export type LocalKey = `local:${string}`;

/**
 * An array of records kept under one storage key — read defensively, changed by
 * id, written back whole.
 *
 * The read-modify-write every repository needs, written once. Notes keep one of
 * these per page and folders keep one for everything; both go through this, so
 * "find it, change it, write it back, say whether it was there" cannot come out
 * differently in two places.
 */
export interface StoredList<T extends { id: string }> {
  read(key: LocalKey): Promise<T[]>;
  write(key: LocalKey, items: T[]): Promise<void>;
  append(key: LocalKey, item: T): Promise<void>;
  /** Replaces the record with `change(record)`; `null` when there is none. */
  update(key: LocalKey, id: string, change: (item: T) => T): Promise<T | null>;
  /** Drops every record `which` selects; how many went. Writes nothing when none did. */
  removeWhere(key: LocalKey, which: (item: T) => boolean): Promise<number>;
}

export function createStoredList<T extends { id: string }>(
  parse: (data: unknown) => T[],
): StoredList<T> {
  const read = async (key: LocalKey) => parse(await storage.getItem<unknown>(key));
  const write = (key: LocalKey, items: T[]) => storage.setItem(key, items);

  return {
    read,
    write,

    async append(key, item) {
      const items = await read(key);
      items.push(item);
      await write(key, items);
    },

    async update(key, id, change) {
      const items = await read(key);
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) return null;
      const next = change(items[index]);
      items[index] = next;
      await write(key, items);
      return next;
    },

    async removeWhere(key, which) {
      const items = await read(key);
      const kept = items.filter((item) => !which(item));
      const removed = items.length - kept.length;
      if (removed > 0) await write(key, kept);
      return removed;
    },
  };
}
