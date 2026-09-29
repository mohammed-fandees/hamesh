/**
 * Where the Teams session token lives on this device.
 *
 * Not in `chrome.storage.local`: content scripts can read that area (Hamesh's
 * own content script keeps personal notes there), and a content script runs
 * inside whatever web page it's on. IndexedDB belongs to the extension's own
 * origin, which only the background service worker and Hamesh's own pages
 * can open, and it survives a browser restart (unlike `storage.session`).
 *
 * Only the background service worker imports this module. The token never
 * leaves it: pages get the account's status, never the credential.
 */
export interface StoredSession {
  token: string;
  /** Server-issued expiry (ms). A hint: the server still decides on every call. */
  expiresAt: number;
}

export interface SessionStore {
  /** The session, or null when there is none or it has expired. */
  get(): Promise<StoredSession | null>;
  set(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

const STORE = 'kv';
const KEY = 'session';

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.token === 'string' &&
    v.token.length > 0 &&
    v.token.length <= 512 &&
    typeof v.expiresAt === 'number' &&
    Number.isFinite(v.expiresAt)
  );
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createIdbSessionStore(
  opts: { dbName?: string; now?: () => number; indexedDB?: IDBFactory } = {},
): SessionStore {
  const dbName = opts.dbName ?? 'hamesh-teams';
  const now = opts.now ?? Date.now;
  let db: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    if (!db) {
      const factory = opts.indexedDB ?? indexedDB;
      const request = factory.open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
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

  const store: SessionStore = {
    async get() {
      const value = await run('readonly', (s) => s.get(KEY));
      if (!isStoredSession(value)) {
        if (value !== undefined) await store.clear();
        return null;
      }
      if (value.expiresAt <= now()) {
        await store.clear();
        return null;
      }
      return { token: value.token, expiresAt: value.expiresAt };
    },
    async set(session) {
      if (!isStoredSession(session)) throw new Error('refusing to store a malformed session');
      await run('readwrite', (s) =>
        s.put({ token: session.token, expiresAt: session.expiresAt }, KEY),
      );
    },
    async clear() {
      await run('readwrite', (s) => s.delete(KEY));
    },
  };
  return store;
}
