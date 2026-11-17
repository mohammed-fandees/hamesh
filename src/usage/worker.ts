import {
  countInto,
  rollOver,
  type UsageContext,
  type UsageEvent,
  type UsageLedger,
} from '@/domain/usage';

export interface UsageWorkerDeps {
  apiOrigin: string;
  fetch: typeof fetch;
  now: () => number;
  /** What every report says besides its counts: version, browser, language. */
  context: () => Promise<UsageContext>;
  /** True only while the reader has sharing on (and, on Firefox, allowed it). */
  sharing: () => Promise<boolean>;
  read: (now: number) => Promise<UsageLedger>;
  write: (ledger: UsageLedger) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * The browser fires a shortcut twice when both its command and the page's own
 * key listener catch it (background.ts, content.ts); one press is one use.
 */
const SAME_PRESS_MS = 1500;

/**
 * Counting and sending, one step at a time: every change to the ledger waits
 * for the one before it, so two counts arriving together are both kept.
 */
export function createUsageWorker(deps: UsageWorkerDeps) {
  let queue: Promise<unknown> = Promise.resolve();
  const lastPress = new Map<string, number>();

  function serially<T>(step: () => Promise<T>): Promise<T> {
    const run = queue.then(step, step);
    queue = run.catch(() => {});
    return run;
  }

  async function send(ledger: UsageLedger): Promise<UsageLedger> {
    if (!ledger.pending) return ledger;
    try {
      // Plain text needs no preflight, and the answer is not needed: a report
      // the server turns down is not one to send again. Nothing that could
      // identify the reader goes with it.
      await deps.fetch(`${deps.apiOrigin}/v1/usage`, {
        method: 'POST',
        mode: 'no-cors',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify(ledger.pending),
      });
      return { ...ledger, pending: null };
    } catch {
      // Offline: it waits for the next try, and is dropped if it waits too long.
      return ledger;
    }
  }

  return {
    count(event: UsageEvent): Promise<void> {
      return serially(async () => {
        const now = deps.now();
        if (event.startsWith('open.shortcut.')) {
          if (now - (lastPress.get(event) ?? -Infinity) < SAME_PRESS_MS) return;
          lastPress.set(event, now);
        }
        if (!(await deps.sharing())) return;
        const ledger = await deps.read(now);
        await deps.write(countInto(ledger, event, now, await deps.context()));
      });
    },

    /** Closes a finished day and sends it, if there is one to send. */
    flush(): Promise<void> {
      return serially(async () => {
        if (!(await deps.sharing())) return;
        const now = deps.now();
        const before = await deps.read(now);
        const after = await send(rollOver(before, now, await deps.context()));
        // A worker wakes often; most wakes change nothing and write nothing.
        if (JSON.stringify(after) !== JSON.stringify(before)) await deps.write(after);
      });
    },

    /** Forgets every count, after whatever was already on its way. */
    forget(): Promise<void> {
      return serially(() => deps.clear());
    },
  };
}

export type UsageWorker = ReturnType<typeof createUsageWorker>;
