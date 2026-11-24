/**
 * Usage counts: how many times this device used each feature today, kept on
 * the device and sent once a day — only when the reader turned "Share usage
 * counts" on (docs/privacy, Settings → Help improve Hamesh).
 *
 * A count is all there is: no time of day, no address, no page, no note, no
 * device id. The list of what can be counted is closed; the server keeps its
 * own copy of it and drops a name it does not know.
 */

export const USAGE_EVENTS = [
  'note.created.element',
  'note.created.text',
  'note.created.video',
  'open.popup',
  'open.shortcut.h',
  'open.shortcut.v',
  'open.shortcut.t',
  'library.opened',
  'folder.created',
  'backup.exported',
  'backup.imported',
  'settings.opened',
  'guide.opened',
  'whats_new.opened',
  'teams.note_shared',
  'teams.panel_opened',
  // A Markdown export finished (downloaded or copied): which tool it was for,
  // how much of the library it took, and each layout its pages were drawn in.
  'export.obsidian',
  'export.notion',
  'export.copied',
  'export.scope.page',
  'export.scope.folder',
  'export.scope.all',
  'export.layout.notes',
  'export.layout.glossary',
  'export.layout.timeline',
  'export.layout.checklist',
  // A note that lost its place on its page was put back (on words or an element), or kept
  // without a place.
  'lost.reattached.text',
  'lost.reattached.element',
  'lost.kept',
] as const;

export type FeatureEvent = (typeof USAGE_EVENTS)[number];

/**
 * The shape the server keeps a feature name in (hamesh-api, src/usage/report.ts):
 * two to four lowercase words joined by dots. The server holds no list of its
 * own, so a name added above is counted without a server change, as long as
 * it fits this shape. The list above stays closed: it, not the server, is what
 * decides what can be counted.
 */
export const FEATURE_NAME = /^[a-z][a-z_]{1,23}(?:\.[a-z][a-z0-9_]{0,23}){1,3}$/;

/** What a reader did with one of Hamesh's announcements, by its server id. */
export type AnnouncementEvent = `announcement.${'shown' | 'opened' | 'closed'}.${string}`;

export type UsageEvent = FeatureEvent | AnnouncementEvent;

const FEATURES = new Set<string>(USAGE_EVENTS);
/** Announcement ids are the server's ULIDs. */
const ANNOUNCEMENT = /^announcement\.(shown|opened|closed)\.[0-9A-HJKMNP-TV-Z]{26}$/;

export function isUsageEvent(value: unknown): value is UsageEvent {
  return typeof value === 'string' && (FEATURES.has(value) || ANNOUNCEMENT.test(value));
}

export function announcementEvent(
  action: 'shown' | 'opened' | 'closed',
  id: string,
): AnnouncementEvent {
  return `announcement.${action}.${id}`;
}

/** No person does one thing more often than this in a day; the server agrees. */
export const MAX_COUNT = 1000;
/** A report that could not be sent waits this long, then is dropped. */
const PENDING_DAYS = 3;
const DAY_MS = 86_400_000;

/** UTC, the day the server files a report under. */
export function utcDay(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

export interface UsageReport {
  day: string;
  version: string;
  browser: 'chrome' | 'firefox';
  lang: 'en' | 'ar';
  counts: Record<string, number>;
}

/** What the report says besides the counts. */
export interface UsageContext {
  version: string;
  browser: 'chrome' | 'firefox';
  lang: 'en' | 'ar';
}

/**
 * This device's counts: today's, still growing, and at most one finished day
 * that has not reached the server yet.
 */
export interface UsageLedger {
  day: string;
  counts: Record<string, number>;
  pending: UsageReport | null;
}

export function emptyLedger(now: number): UsageLedger {
  return { day: utcDay(now), counts: {}, pending: null };
}

function parseCounts(value: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return counts;
  for (const [event, n] of Object.entries(value)) {
    if (isUsageEvent(event) && Number.isInteger(n) && (n as number) > 0) {
      counts[event] = Math.min(n as number, MAX_COUNT);
    }
  }
  return counts;
}

function parseReport(value: unknown): UsageReport | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  if (typeof r.day !== 'string' || typeof r.version !== 'string') return null;
  if (r.browser !== 'chrome' && r.browser !== 'firefox') return null;
  if (r.lang !== 'en' && r.lang !== 'ar') return null;
  const counts = parseCounts(r.counts);
  if (Object.keys(counts).length === 0) return null;
  return { day: r.day, version: r.version, browser: r.browser, lang: r.lang, counts };
}

/** Reads a stored ledger defensively; anything unreadable starts today afresh. */
export function parseLedger(value: unknown, now: number): UsageLedger {
  if (!value || typeof value !== 'object') return emptyLedger(now);
  const r = value as Record<string, unknown>;
  if (typeof r.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) return emptyLedger(now);
  return { day: r.day, counts: parseCounts(r.counts), pending: parseReport(r.pending) };
}

/**
 * Moves a finished day into `pending`, and drops a pending report too old for
 * the server to take. A day with nothing counted sends nothing.
 */
export function rollOver(ledger: UsageLedger, now: number, context: UsageContext): UsageLedger {
  const today = utcDay(now);
  let { pending } = ledger;
  if (pending && pending.day < utcDay(now - PENDING_DAYS * DAY_MS)) pending = null;
  if (ledger.day === today) return { ...ledger, pending };
  const finished = Object.keys(ledger.counts).length > 0;
  return {
    day: today,
    counts: {},
    pending: finished ? { day: ledger.day, ...context, counts: ledger.counts } : pending,
  };
}

/** One more use of `event`, on today's line. */
export function countInto(
  ledger: UsageLedger,
  event: UsageEvent,
  now: number,
  context: UsageContext,
): UsageLedger {
  const next = rollOver(ledger, now, context);
  const n = next.counts[event] ?? 0;
  return { ...next, counts: { ...next.counts, [event]: Math.min(n + 1, MAX_COUNT) } };
}

/** Today's report as it stands — what "See what's shared" shows. */
export function todaysReport(ledger: UsageLedger, now: number, context: UsageContext): UsageReport {
  const today = utcDay(now);
  return { day: today, ...context, counts: ledger.day === today ? ledger.counts : {} };
}

interface StoredRecord {
  id: string;
  createdAt?: unknown;
  anchor?: { type?: unknown } | null;
}

/** A record counts as made just now if it was created this recently; a restored
 *  backup brings back old notes and folders, which are not new ones. */
const JUST_MADE_MS = 60_000;

/** The records in `after` that `before` did not have and that were just made. */
function justMade(before: unknown, after: unknown, now: number): StoredRecord[] {
  const records = (value: unknown): StoredRecord[] =>
    Array.isArray(value)
      ? value.filter(
          (item): item is StoredRecord =>
            !!item && typeof item === 'object' && typeof (item as StoredRecord).id === 'string',
        )
      : [];
  const known = new Set(records(before).map((record) => record.id));
  return records(after).filter((record) => {
    if (known.has(record.id)) return false;
    const created = typeof record.createdAt === 'string' ? Date.parse(record.createdAt) : NaN;
    return Number.isFinite(created) && now - created <= JUST_MADE_MS;
  });
}

/**
 * The notes that appeared in one page's list between two writes, as events by
 * kind. Read from storage rather than from the page, so nothing the page says
 * is trusted and nothing in the page needs to know about counting.
 */
export function notesCreated(before: unknown, after: unknown, now: number): FeatureEvent[] {
  return justMade(before, after, now).map((note) => {
    const kind = note.anchor?.type;
    if (kind === 'text') return 'note.created.text';
    if (kind === 'video') return 'note.created.video';
    return 'note.created.element';
  });
}

/** How many folders were just made between two writes of the folder list. */
export function foldersCreated(before: unknown, after: unknown, now: number): number {
  return justMade(before, after, now).length;
}
