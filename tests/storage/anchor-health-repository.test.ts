import { describe, it, expect, beforeEach } from 'vitest';
import { installFakeStorage } from './fake-local-storage';
import { createAnchorHealthRepository } from '@/storage/anchor-health-repository';
import type { AnchorHealthMap } from '@/domain/anchor-health';

const KEY = 'local:hamesh:anchor-health';
const PAGE = 'https://lectures.edu/al-khwarizmi/algebra';
const T1 = new Date('2026-11-01T10:00:00.000Z');
const T2 = new Date('2026-11-02T10:00:00.000Z');

describe('AnchorHealthRepository', () => {
  let fake: ReturnType<typeof installFakeStorage>;
  let repo: ReturnType<typeof createAnchorHealthRepository>;

  beforeEach(() => {
    fake = installFakeStorage();
    repo = createAnchorHealthRepository();
  });

  it('reads an empty map when nothing was stored, and drops junk', async () => {
    expect(await repo.read()).toEqual({});
    fake.store.set(KEY, { a: { status: 'nope' } });
    expect(await repo.read()).toEqual({});
  });

  it('records two missed visits as lost', async () => {
    await repo.recordVisit(PAGE, new Map([['a', 'missed']]), T1);
    const after = await repo.recordVisit(PAGE, new Map([['a', 'missed']]), T2);
    expect(after.a).toEqual({
      status: 'lost',
      misses: 2,
      lastCheckedAt: T2.toISOString(),
      pageKey: PAGE,
    });
    expect(fake.store.get(KEY)).toEqual(after);
  });

  it('writes nothing for a visit that changes nothing', async () => {
    await repo.recordVisit(PAGE, new Map([['a', 'found']]), T1);
    expect(fake.api.setItem).not.toHaveBeenCalled();
  });

  it('keeps a note without a place, once', async () => {
    const kept = await repo.keepWithoutPlace('a', PAGE, T1);
    expect(kept.a.status).toBe('kept-without-place');
    await repo.keepWithoutPlace('a', PAGE, T2);
    expect(fake.api.setItem).toHaveBeenCalledTimes(1);
  });

  it('clears one note, and writes nothing for a note it never had', async () => {
    await repo.recordVisit(PAGE, new Map([['a', 'missed']]), T1);
    expect(await repo.clear('a')).toEqual({});
    await repo.clear('b');
    expect(fake.api.setItem).toHaveBeenCalledTimes(2);
  });

  it('prunes entries of notes that no longer exist', async () => {
    await repo.recordVisit(
      PAGE,
      new Map([
        ['a', 'missed'],
        ['b', 'missed'],
      ]),
      T1,
    );
    const pruned = await repo.prune(new Set(['b']));
    expect(Object.keys(pruned)).toEqual(['b']);
    await repo.prune(new Set(['b']));
    expect(fake.api.setItem).toHaveBeenCalledTimes(2);
  });

  it('tells a watcher the parsed map', async () => {
    const seen: AnchorHealthMap[] = [];
    const stop = repo.watch((map) => seen.push(map));
    await repo.recordVisit(PAGE, new Map([['a', 'missed']]), T1);
    stop();
    await repo.clear('a');
    expect(seen).toHaveLength(1);
    expect(seen[0].a.status).toBe('suspect');
  });
});

describe('AnchorHealthRepository — writes that overlap', () => {
  it('keeps both of two changes started together', async () => {
    installFakeStorage();
    const repo = createAnchorHealthRepository();
    await Promise.all([
      repo.recordVisit(PAGE, new Map([['a', 'missed']]), T1),
      repo.keepWithoutPlace('b', PAGE, T1),
    ]);
    const map = await repo.read();
    expect(map.a?.status).toBe('suspect');
    expect(map.b?.status).toBe('kept-without-place');
  });

  it('goes on after a change that failed', async () => {
    const fake = installFakeStorage();
    const repo = createAnchorHealthRepository();
    fake.api.setItem.mockRejectedValueOnce(new Error('quota'));
    await expect(repo.keepWithoutPlace('a', PAGE, T1)).rejects.toThrow('quota');
    expect((await repo.keepWithoutPlace('a', PAGE, T1)).a.status).toBe('kept-without-place');
  });
});
