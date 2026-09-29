/**
 * The extension's own key/value area in IndexedDB, and the only storage Teams
 * keeps outside `chrome.storage`.
 *
 * IndexedDB belongs to the extension's origin, which only the background
 * service worker and Hamesh's own pages can open — a content script runs inside
 * whatever web page it is on and cannot reach it. That is why the session token
 * lives here (see ./session-store.ts), and why the sync bookkeeping does too
 * (./sync-store.ts): a cursor is not a secret, but the map of which pages carry
 * team notes is more than a content script needs to draw one page.
 *
 * One database, one store, one upgrade path, whatever is kept in it.
 */

const STORE = 'kv';
const DB_NAME = 'hamesh-teams';
const DB_VERSION = 1;

export interface KvStore {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  /** Every key currently stored, for the callers that sweep a prefix. */
  keys(): Promise<string[]>;
}

export interface KvStoreOptions {
  dbName?: string;
  /** Injectable for tests, which run against `fake-indexeddb`. */
  indexedDB?: IDBFactory;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createKvStore(opts: KvStoreOptions = {}): KvStore {
  const dbName = opts.dbName ?? DB_NAME;
  let db: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    if (!db) {
      const factory = opts.indexedDB ?? indexedDB;
      const request = factory.open(dbName, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };
      db = promisify(request).catch((err) => {
        db = null; // let the next call try again
        throw err;
      });
    }
    return db;
  }

  async function run<T>(
    mode: IDBTransactionMode,
    op: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const tx = (await open()).transaction(STORE, mode);
    const result = promisify(op(tx.objectStore(STORE)));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  }

  return {
    get: (key) => run('readonly', (s) => s.get(key)),
    put: async (key, value) => {
      await run('readwrite', (s) => s.put(value, key));
    },
    del: async (key) => {
      await run('readwrite', (s) => s.delete(key));
    },
    keys: async () => {
      const keys = await run('readonly', (s) => s.getAllKeys());
      return keys.filter((key): key is string => typeof key === 'string');
    },
  };
}
