import { describe, it, expect, beforeEach } from 'vitest';
import { installFakeStorage } from './fake-local-storage';
import { createAnchorHealthRepository } from '@/storage/anchor-health-repository';
import { createNotesRepository } from '@/storage/notes-repository';
import { isLost } from '@/domain/anchor-health';
import type { TextAnchor } from '@/domain/note';

const PAGE = 'https://maktaba.site/bennabi/conditions';

const words = (exact: string): TextAnchor => ({
  type: 'text',
  version: 1,
  exact,
  context: { prefix: '', suffix: '' },
  textPosition: { start: 0, end: exact.length },
});

describe('Lost notes — model and storage together', () => {
  beforeEach(() => {
    installFakeStorage();
  });

  it('flags a note after two missed visits, clears it when found, and puts it back intact', async () => {
    const notes = createNotesRepository();
    const health = createAnchorHealthRepository();
    const note = await notes.create({
      content: 'civilisation = man + soil + time',
      pageKey: PAGE,
      originalUrl: PAGE,
      anchor: words('the equation of civilisation'),
      folderId: 'reading',
    });
    await notes.setPinned(note.id, PAGE, true);
    const other = await notes.create({
      content: 'to be deleted',
      pageKey: PAGE,
      originalUrl: PAGE,
      anchor: words('a passing remark'),
    });

    const missed = new Map([
      [note.id, 'missed' as const],
      [other.id, 'missed' as const],
    ]);
    await health.recordVisit(PAGE, missed, new Date('2026-11-01T10:00:00Z'));
    expect(isLost((await health.read())[note.id])).toBe(false);
    await health.recordVisit(PAGE, missed, new Date('2026-11-02T10:00:00Z'));
    expect(isLost((await health.read())[note.id])).toBe(true);

    await notes.delete(other.id, PAGE);
    const all = await notes.getAll();
    const pruned = await health.prune(new Set(all.map((n) => n.id)));
    expect(Object.keys(pruned)).toEqual([note.id]);

    await notes.setAnchor(note.id, PAGE, words('civilisation, he wrote'), { section: 'Part one' });
    await health.clear(note.id);
    const [stored] = await notes.getForPage(PAGE);
    expect(stored).toMatchObject({ id: note.id, folderId: 'reading', pinned: true });
    expect(stored.anchor).toMatchObject({ exact: 'civilisation, he wrote' });
    expect(await health.read()).toEqual({});

    await health.recordVisit(PAGE, new Map([[note.id, 'missed']]), new Date('2026-11-03T10:00Z'));
    await health.recordVisit(PAGE, new Map([[note.id, 'found']]), new Date('2026-11-04T10:00Z'));
    expect(await health.read()).toEqual({});
  });
});
