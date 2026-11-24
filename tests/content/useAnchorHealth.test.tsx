// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { installFakeStorage } from '../storage/fake-local-storage';
import { createAnchorHealthRepository } from '@/storage/anchor-health-repository';
import { useAnchorHealth } from '@/content/useAnchorHealth';
import type { VisitOutcome } from '@/domain/anchor-health';

const A = 'https://maktaba.site/a';
const B = 'https://maktaba.site/b';

describe('useAnchorHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    installFakeStorage();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('records one verdict per page, and starts a new visit when the page changes', async () => {
    const repo = createAnchorHealthRepository();
    const record = vi.spyOn(repo, 'recordVisit');
    const evaluate = vi.fn(() => new Map<string, VisitOutcome>([['n1', 'missed']]));
    const { rerender, result } = renderHook(({ page }) => useAnchorHealth(repo, page, evaluate), {
      initialProps: { page: A },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    rerender({ page: B });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toBe(B);
    expect(result.current.loaded).toBe(true);
    expect(result.current.health.n1).toMatchObject({ status: 'suspect', pageKey: B });
  });

  it('records nothing when the page has no note to check', async () => {
    const repo = createAnchorHealthRepository();
    const record = vi.spyOn(repo, 'recordVisit');
    renderHook(() => useAnchorHealth(repo, A, () => new Map()));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(record).not.toHaveBeenCalled();
  });

  it('keeps a note without a place, and clears it', async () => {
    const repo = createAnchorHealthRepository();
    const { result } = renderHook(() => useAnchorHealth(repo, A, () => new Map()));
    await act(async () => {
      expect(await result.current.keep('n1', A)).toBe(true);
    });
    expect(result.current.health.n1.status).toBe('kept-without-place');
    await act(async () => {
      expect(await result.current.clear('n1')).toBe(true);
    });
    expect(result.current.health).toEqual({});
  });

  it('says a failed write failed', async () => {
    const repo = createAnchorHealthRepository();
    vi.spyOn(repo, 'keepWithoutPlace').mockRejectedValue(new Error('quota'));
    const { result } = renderHook(() => useAnchorHealth(repo, A, () => new Map()));
    await act(async () => {
      expect(await result.current.keep('n1', A)).toBe(false);
    });
  });
});
