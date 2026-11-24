// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNoteMutations } from '@/ui/hooks/useNoteMutations';
import type { NotesRepository } from '@/storage/notes-repository';
import type { ElementAnchor, Note } from '@/domain/note';

const anchor = (selector: string): ElementAnchor => ({
  primarySelector: selector,
  signals: { tagName: 'p' },
  fallbackDocumentPosition: { x: 0, y: 0 },
});

const note = (overrides: Partial<Note> = {}): Note => ({
  id: 'n1',
  schemaVersion: 1,
  pageKey: 'https://maktaba.site/bennabi',
  originalUrl: 'https://maktaba.site/bennabi',
  content: 'man, soil and time',
  anchor: anchor('#gone'),
  workspaceId: 'default',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

function setup(notes: Note[]) {
  let current = notes;
  const setAnchor = vi.fn(async (id: string, _page: string, next: ElementAnchor) => {
    const found = current.find((n) => n.id === id);
    return found ? { ...found, anchor: next } : null;
  });
  const repo = { setAnchor } as unknown as NotesRepository;
  const list = {
    current: () => current,
    commit: (next: Note[]) => {
      current = next;
    },
  };
  const { result } = renderHook(() => useNoteMutations(repo, list));
  return { result, setAnchor, list: () => current };
}

describe('useNoteMutations — reanchor', () => {
  it('writes the new place and hands the surface the updated note', async () => {
    const { result, setAnchor, list } = setup([note()]);
    await act(async () => {
      await result.current.reanchor('n1', anchor('#new'), { section: 'The idea' });
    });
    expect(setAnchor).toHaveBeenCalledWith('n1', note().pageKey, anchor('#new'), {
      section: 'The idea',
    });
    expect(list()[0].anchor).toEqual(anchor('#new'));
  });

  it("refuses a team's note without writing", async () => {
    const shared = note({
      team: { id: 't', name: 'Readers', version: 1, authorId: null, folderId: null },
    });
    const { result, setAnchor } = setup([shared]);
    let outcome: Note | null = shared;
    await act(async () => {
      outcome = await result.current.reanchor('n1', anchor('#new'));
    });
    expect(outcome).toBeNull();
    expect(setAnchor).not.toHaveBeenCalled();
  });
});
