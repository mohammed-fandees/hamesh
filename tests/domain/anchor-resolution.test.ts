import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResolutionQuality, resolveVideoAnchor } from '@/domain/anchor-resolution';
import type { VideoResolutionSource } from '@/domain/anchor-resolution';
import type { Note, ElementAnchor, VideoAnchor } from '@/domain/note';

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

  function makeAnchor(overrides?: Partial<ElementAnchor>): ElementAnchor {
    return {
      primarySelector: null,
      signals: { tagName: 'div' },
      fallbackDocumentPosition: { x: 100, y: 200 },
      ...overrides,
    };
  }

  function makeMockNote(overrides?: Partial<Note>): Note {
    return {
      id: 'n1',
      schemaVersion: 1,
      pageKey: 'p',
      originalUrl: 'u',
      content: 'test',
      anchor: makeAnchor(),
      workspaceId: 'default',
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

    const note = makeMockNote({ anchor: makeAnchor({ primarySelector: '#my-id' }) });
    const result = resolveAnchor(note);
    expect(result.quality).toBe(ResolutionQuality.Exact);
    expect(result.element).toBe(el);
  });

  it('falls back to Unresolved when primarySelector throws', async () => {
    mockDoc.querySelector.mockImplementation(() => {
      throw new Error('bad selector');
    });

    const note = makeMockNote({ anchor: makeAnchor({ primarySelector: ':bad' }) });
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

    const anchor = makeAnchor({
      primarySelector: null,
      signals: { tagName: 'div', dataAttributes: { 'data-foo': 'bar' } },
    });

    const result = resolveAnchor(makeMockNote({ anchor }));
    expect(result.quality).toBe(ResolutionQuality.Probable);
    expect(result.element).toBe(el);
  });

  it('returns Unresolved for a video anchor without touching document', async () => {
    const videoAnchor: VideoAnchor = {
      type: 'video',
      platform: 'youtube',
      videoId: 'abc123',
      timestamp: 12,
    };
    const result = resolveAnchor(makeMockNote({ anchor: videoAnchor }));
    expect(result.quality).toBe(ResolutionQuality.Unresolved);
    expect(result.element).toBeNull();
  });
});

describe('resolveVideoAnchor', () => {
  function makeVideoNote(overrides?: Partial<VideoAnchor>): Note {
    const anchor: VideoAnchor = {
      type: 'video',
      platform: 'youtube',
      videoId: 'abc123',
      timestamp: 42,
      ...overrides,
    };
    return {
      id: 'n1',
      schemaVersion: 1,
      pageKey: 'p',
      originalUrl: 'u',
      content: 'test',
      anchor,
      workspaceId: 'default',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
  }

  function makeAdapter(overrides?: Partial<VideoResolutionSource>): VideoResolutionSource {
    return {
      id: 'youtube',
      getActiveVideo: () => null,
      getVideoId: () => null,
      ...overrides,
    };
  }

  it('returns Unresolved when the note has an element anchor', () => {
    const elementNote = {
      ...makeVideoNote(),
      anchor: {
        primarySelector: null,
        signals: { tagName: 'div' },
        fallbackDocumentPosition: { x: 0, y: 0 },
      },
    } as Note;
    const result = resolveVideoAnchor(elementNote, [makeAdapter()]);
    expect(result.quality).toBe(ResolutionQuality.Unresolved);
  });

  it('returns Unresolved when no adapter matches the anchor platform', () => {
    const result = resolveVideoAnchor(makeVideoNote(), [makeAdapter({ id: 'html5' })]);
    expect(result.quality).toBe(ResolutionQuality.Unresolved);
  });

  it('returns Unresolved when the matching adapter has no active video', () => {
    const result = resolveVideoAnchor(makeVideoNote(), [
      makeAdapter({ id: 'youtube', getActiveVideo: () => null }),
    ]);
    expect(result.quality).toBe(ResolutionQuality.Unresolved);
  });

  it('returns Unresolved when the active video id does not match', () => {
    const video = {} as HTMLVideoElement;
    const result = resolveVideoAnchor(makeVideoNote({ videoId: 'abc123' }), [
      makeAdapter({ id: 'youtube', getActiveVideo: () => video, getVideoId: () => 'different' }),
    ]);
    expect(result.quality).toBe(ResolutionQuality.Unresolved);
    expect(result.element).toBeNull();
  });

  it('returns Exact with the video element when the active video id matches', () => {
    const video = {} as HTMLVideoElement;
    const result = resolveVideoAnchor(makeVideoNote({ videoId: 'abc123' }), [
      makeAdapter({ id: 'youtube', getActiveVideo: () => video, getVideoId: () => 'abc123' }),
    ]);
    expect(result.quality).toBe(ResolutionQuality.Exact);
    expect(result.element).toBe(video);
  });

  it('only trusts the adapter whose id matches anchor.platform', () => {
    const video = {} as HTMLVideoElement;
    const result = resolveVideoAnchor(makeVideoNote({ platform: 'youtube', videoId: 'abc123' }), [
      makeAdapter({ id: 'html5', getActiveVideo: () => video, getVideoId: () => 'abc123' }),
    ]);
    expect(result.quality).toBe(ResolutionQuality.Unresolved);
  });
});
