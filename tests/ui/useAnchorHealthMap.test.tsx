// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { installFakeStorage } from '../storage/fake-local-storage';
import { createAnchorHealthRepository } from '@/storage/anchor-health-repository';
import { useAnchorHealthMap } from '@/ui/hooks/useAnchorHealthMap';
import type { Note } from '@/domain/note';

const KEY = 'local:hamesh:anchor-health';
const entry = { status: 'lost', misses: 2, lastCheckedAt: '2026-11-01', pageKey: 'p' };
const noteWith = (id: string) => ({ id }) as Note;

describe('useAnchorHealthMap', () => {
  let fake: ReturnType<typeof installFakeStorage>;
  beforeEach(() => {
    fake = installFakeStorage();
    fake.store.set(KEY, { a: entry, gone: entry });
  });

  it('reads the map and follows changes', async () => {
    const repo = createAnchorHealthRepository();
    const { result } = renderHook(() => useAnchorHealthMap(repo, null));
    await waitFor(() => expect(Object.keys(result.current).sort()).toEqual(['a', 'gone']));
    await act(async () => {
      await repo.clear('a');
    });
    expect(Object.keys(result.current)).toEqual(['gone']);
  });

  it('drops entries of notes that no longer exist once the notes are in', async () => {
    const repo = createAnchorHealthRepository();
    renderHook(() => useAnchorHealthMap(repo, [noteWith('a')]));
    await waitFor(() => expect(Object.keys(fake.store.get(KEY) as object)).toEqual(['a']));
  });

  it('prunes nothing from an empty list, which may be a read that failed', async () => {
    const repo = createAnchorHealthRepository();
    const { result } = renderHook(() => useAnchorHealthMap(repo, []));
    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(2));
    expect(fake.api.setItem).not.toHaveBeenCalled();
  });
});
