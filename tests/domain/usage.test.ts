import { describe, expect, it } from 'vitest';
import {
  MAX_COUNT,
  announcementEvent,
  countInto,
  emptyLedger,
  foldersCreated,
  isUsageEvent,
  notesCreated,
  parseLedger,
  rollOver,
  todaysReport,
  utcDay,
  type UsageContext,
} from '@/domain/usage';
import { parsePreferences } from '@/domain/preferences';

const NOW = Date.UTC(2026, 10, 17, 9, 30);
const DAY = 86_400_000;
const CONTEXT: UsageContext = { version: '2.2.0', browser: 'chrome', lang: 'ar' };
const ID = '01K9ZZ0000000000000000TEAM';

describe('the closed list', () => {
  it('takes only names on the list, and announcements by a server id', () => {
    expect(isUsageEvent('note.created.text')).toBe(true);
    expect(isUsageEvent(announcementEvent('shown', ID))).toBe(true);
    expect(isUsageEvent('page.visited')).toBe(false);
    expect(isUsageEvent('announcement.shown.https://example.com')).toBe(false);
    expect(isUsageEvent(42)).toBe(false);
  });
});

describe('counting a day', () => {
  it('adds a use to today', () => {
    const once = countInto(emptyLedger(NOW), 'library.opened', NOW, CONTEXT);
    const twice = countInto(once, 'library.opened', NOW + 1000, CONTEXT);
    expect(twice).toEqual({ day: '2026-11-17', counts: { 'library.opened': 2 }, pending: null });
  });

  it('sets a finished day aside as a report, with what the device is', () => {
    const yesterday = countInto(emptyLedger(NOW - DAY), 'open.popup', NOW - DAY, CONTEXT);
    const today = countInto(yesterday, 'library.opened', NOW, CONTEXT);
    expect(today.pending).toEqual({ day: '2026-11-16', ...CONTEXT, counts: { 'open.popup': 1 } });
    expect(today.counts).toEqual({ 'library.opened': 1 });
  });

  it('sends nothing for a day Hamesh was not used', () => {
    expect(rollOver(emptyLedger(NOW - DAY), NOW, CONTEXT).pending).toBeNull();
  });

  it('drops a report that waited more than three days', () => {
    const old = countInto(emptyLedger(NOW - 5 * DAY), 'open.popup', NOW - 5 * DAY, CONTEXT);
    const kept = rollOver(old, NOW - 4 * DAY, CONTEXT);
    expect(kept.pending?.day).toBe(utcDay(NOW - 5 * DAY));
    expect(rollOver(kept, NOW, CONTEXT).pending).toBeNull();
  });

  it('stops at a count no person reaches', () => {
    let ledger = parseLedger({ day: '2026-11-17', counts: { 'open.popup': MAX_COUNT } }, NOW);
    ledger = countInto(ledger, 'open.popup', NOW, CONTEXT);
    expect(ledger.counts['open.popup']).toBe(MAX_COUNT);
  });

  it('shows the report for today as it stands, and an empty one after midnight', () => {
    const ledger = countInto(emptyLedger(NOW), 'folder.created', NOW, CONTEXT);
    expect(todaysReport(ledger, NOW, CONTEXT)).toEqual({
      day: '2026-11-17',
      ...CONTEXT,
      counts: { 'folder.created': 1 },
    });
    expect(todaysReport(ledger, NOW + DAY, CONTEXT).counts).toEqual({});
  });

  it('reads a stored ledger defensively, keeping only names on the list', () => {
    expect(parseLedger('nonsense', NOW)).toEqual(emptyLedger(NOW));
    expect(
      parseLedger({ day: '2026-11-17', counts: { 'open.popup': 2, 'url.visited': 3, x: 'y' } }, NOW)
        .counts,
    ).toEqual({ 'open.popup': 2 });
  });
});

describe('notes and folders made', () => {
  const at = (ms: number) => new Date(ms).toISOString();
  const note = (id: string, type: string | null, createdAt = at(NOW - 5000)) => ({
    id,
    createdAt,
    anchor: type ? { type } : null,
  });

  it('counts each new note by its kind', () => {
    const before = [note('a', 'element')];
    const after = [...before, note('b', 'text'), note('c', 'video'), note('d', 'element')];
    expect(notesCreated(before, after, NOW)).toEqual([
      'note.created.text',
      'note.created.video',
      'note.created.element',
    ]);
  });

  it('does not count old notes coming back from a backup, or an edit', () => {
    const restored = [note('a', 'text', at(NOW - 30 * DAY))];
    expect(notesCreated(undefined, restored, NOW)).toEqual([]);
    expect(notesCreated([note('a', 'text')], [note('a', 'text')], NOW)).toEqual([]);
  });

  it('counts a new folder, and not a restored one', () => {
    const folder = (id: string, createdAt: string) => ({ id, createdAt });
    expect(foldersCreated([], [folder('f', at(NOW - 1000))], NOW)).toBe(1);
    expect(foldersCreated([], [folder('g', at(NOW - 9 * DAY))], NOW)).toBe(0);
  });
});

describe('the preference', () => {
  it('is unasked until the reader answers, and only on when they say so', () => {
    expect(parsePreferences({}).usage).toEqual({ sharing: 'unasked' });
    expect(parsePreferences({ usage: { sharing: 'on' } }).usage).toEqual({ sharing: 'on' });
    expect(parsePreferences({ usage: { sharing: 'yes' } }).usage).toEqual({ sharing: 'unasked' });
  });
});
