import { browser } from 'wxt/browser';
import { foldersCreated, isUsageEvent, notesCreated, type UsageEvent } from '@/domain/usage';
import { createPreferencesRepository } from '@/storage/preferences-repository';
import { clearLedger, readLedger, writeLedger } from './ledger';
import { hasSharingPermission } from './permission';
import { createUsageWorker } from './worker';

const NOTES_PREFIX = 'hamesh:notes:';
const FOLDERS_KEY = 'hamesh:folders';
const PREFERENCES_KEY = 'hamesh:preferences';

/** How often a finished day is looked for. A report goes once a day at most. */
const USAGE_ALARM = 'hamesh-usage';
const CHECK_EVERY_MINUTES = 60;

const SHORTCUTS: Record<string, UsageEvent> = {
  'activate-hamesh': 'open.shortcut.h',
  'activate-hamesh-video': 'open.shortcut.v',
  'activate-hamesh-text': 'open.shortcut.t',
};

/** The worker's counter, for what happens in the background itself. */
let counter: ((event: UsageEvent) => void) | null = null;

/**
 * One use of `event`, from code running in the background, where `countUse`'s
 * message would not arrive: the worker does not hear its own messages.
 */
export function countInBackground(event: UsageEvent): void {
  counter?.(event);
}

/**
 * Usage counts in the background service worker, the one place that writes
 * them. Pages and the content script only say what happened (`countUse`); new
 * notes and folders are read from storage, so the page a note was left on never
 * takes part.
 *
 * Nothing is counted, kept or sent unless the reader turned sharing on.
 */
export function registerUsage(apiOrigin: string): void {
  const preferences = createPreferencesRepository();

  const sharing = async () =>
    (await preferences.get()).usage.sharing === 'on' && (await hasSharingPermission());

  const worker = createUsageWorker({
    apiOrigin,
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    sharing,
    read: readLedger,
    write: writeLedger,
    clear: clearLedger,
    async context() {
      const prefs = await preferences.get();
      const ui = prefs.language ?? browser.i18n?.getUILanguage?.() ?? '';
      return {
        version: browser.runtime.getManifest().version,
        browser: import.meta.env.FIREFOX ? 'firefox' : 'chrome',
        lang: ui.toLowerCase().startsWith('ar') ? 'ar' : 'en',
      };
    },
  });

  counter = (event) => void worker.count(event);

  browser.runtime.onMessage.addListener((message: unknown, sender): undefined => {
    if (!message || typeof message !== 'object') return undefined;
    const { type, event } = message as { type?: unknown; event?: unknown };
    if (type !== 'USAGE_COUNT' || sender.id !== browser.runtime.id) return undefined;
    if (isUsageEvent(event)) void worker.count(event);
    return undefined;
  });

  browser.commands?.onCommand.addListener((command) => {
    const event = SHORTCUTS[command];
    if (event) void worker.count(event);
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const now = Date.now();
    for (const [key, change] of Object.entries(changes)) {
      if (key.startsWith(NOTES_PREFIX)) {
        for (const event of notesCreated(change.oldValue, change.newValue, now)) {
          void worker.count(event);
        }
      } else if (key === FOLDERS_KEY) {
        const made = foldersCreated(change.oldValue, change.newValue, now);
        for (let i = 0; i < made; i++) void worker.count('folder.created');
      } else if (key === PREFERENCES_KEY) {
        const after = (change.newValue as { usage?: { sharing?: unknown } } | undefined)?.usage;
        // Turned off, from anywhere: what was kept here goes at once.
        if (after?.sharing !== 'on') void worker.forget();
      }
    }
  });

  // Firefox lets the reader take its permission back from its own add-on page.
  // Hamesh then stops as if the switch had been turned off.
  if (import.meta.env.FIREFOX) {
    browser.permissions?.onRemoved.addListener(() => {
      void (async () => {
        if (await hasSharingPermission()) return;
        if ((await preferences.get()).usage.sharing !== 'on') return;
        await preferences.setUsage({ sharing: 'off' });
      })();
    });
  }

  browser.alarms?.create(USAGE_ALARM, { periodInMinutes: CHECK_EVERY_MINUTES });
  browser.alarms?.onAlarm.addListener((alarm) => {
    if (alarm.name === USAGE_ALARM) void worker.flush();
  });
  void worker.flush();
}
