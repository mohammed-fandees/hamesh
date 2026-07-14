import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResolutionQuality } from '@/domain/anchor-resolution';
import type { Note, ElementAnchor } from '@/domain/note';

describe('ResolutionQuality enum', () => {
  it('has expected values', () => {
    expect(ResolutionQuality.Exact).toBe('exact');
    expect(ResolutionQuality.Probable).toBe('probable');
    expect(ResolutionQuality.Fallback).toBe('fallback');
    expect(ResolutionQuality.Unresolved).toBe('unresolved');
  });
});

describe('resolveAnchor', () => {
  let resolveAnchor: typeof import('@/domain/anchor-resolution').resolveAnchor;
  let mockDoc: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    mockDoc = {
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      getElementById: vi.fn(),
      elementFromPoint: vi.fn(() => null),
    };

    vi.resetModules();
    (globalThis as unknown as { document: unknown }).document = mockDoc;
    (globalThis as unknown as { CSS: unknown }).CSS = { escape: (s: string) => s };
    (globalThis as unknown as { window: unknown }).window = { scrollX: 0, scrollY: 0 };

    const mod = await import('@/domain/anchor-resolution');
    resolveAnchor = mod.resolveAnchor;
  });

  function makeMockNote(overrides?: Partial<Note>): Note {
    const anchor: ElementAnchor = {
      primarySelector: null,
      signals: { tagName: 'div' },
      fallbackDocumentPosition: { x: 100, y: 200 },
    };
    return {
      id: 'n1',
      schemaVersion: 1,
      pageKey: 'p',
      originalUrl: 'u',
      content: 'test',
      anchor,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  it('returns Unresolved when no element is found', async () => {
    const result = resolveAnchor(makeMockNote());
    expect(result.quality).toBe(ResolutionQuality.Unresolved);
    expect(result.element).toBeNull();
  });

  it('returns Exact when primarySelector matches', async () => {
    const el = {} as Element;
    mockDoc.querySelector.mockReturnValue(el);

    const note = makeMockNote({ anchor: { ...makeMockNote().anchor, primarySelector: '#my-id' } });
    const result = resolveAnchor(note);
    expect(result.quality).toBe(ResolutionQuality.Exact);
    expect(result.element).toBe(el);
  });

  it('falls back to Unresolved when primarySelector throws', async () => {
    mockDoc.querySelector.mockImplementation(() => {
      throw new Error('bad selector');
    });

    const note = makeMockNote({ anchor: { ...makeMockNote().anchor, primarySelector: ':bad' } });
    const result = resolveAnchor(note);
    expect(result.quality).toBe(ResolutionQuality.Unresolved);
  });

  it('falls back to Unresolved when elementFromPoint throws (unlike every other query path here, it had no guard until this test)', async () => {
    mockDoc.elementFromPoint.mockImplementation(() => {
      throw new Error('not implemented');
    });

    const result = resolveAnchor(makeMockNote());
    expect(result.quality).toBe(ResolutionQuality.Unresolved);
    expect(result.element).toBeNull();
  });

  it('returns Fallback when elementFromPoint finds an element', async () => {
    const el = {} as Element;
    mockDoc.elementFromPoint.mockReturnValue(el);

    const result = resolveAnchor(makeMockNote());
    expect(result.quality).toBe(ResolutionQuality.Fallback);
    expect(result.element).toBe(el);
  });

  it('returns Probable when findByDataAttributes finds single match', async () => {
    const el = {} as Element;
    mockDoc.querySelector.mockReturnValue(null);
    mockDoc.querySelectorAll.mockReturnValue([el] as unknown as NodeListOf<Element>);

    const anchor = makeMockNote().anchor;
    anchor.signals.dataAttributes = { 'data-foo': 'bar' };
    anchor.primarySelector = null;

    const result = resolveAnchor(makeMockNote({ anchor }));
    expect(result.quality).toBe(ResolutionQuality.Probable);
    expect(result.element).toBe(el);
  });
});
