// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFloating, type AnchorRect } from '@/content/useFloating';

function makeRect(overrides: Partial<AnchorRect> = {}): AnchorRect {
  return { left: 100, top: 200, width: 150, height: 30, ...overrides };
}

describe('useFloating', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
    Object.defineProperty(window, 'scrollX', { value: 0, writable: true, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  });

  it('returns cardRef, style, and reposition', () => {
    const { result } = renderHook(() => useFloating(() => makeRect()));
    expect(result.current.cardRef).toBeDefined();
    expect(result.current.style).toBeDefined();
    expect(typeof result.current.reposition).toBe('function');
  });

  it('initially positions offscreen with hidden visibility', () => {
    const { result } = renderHook(() => useFloating(() => makeRect()));
    expect(result.current.style.position).toBe('fixed');
    expect(result.current.style.visibility).toBe('hidden');
  });

  it('does nothing when getAnchorRect returns null', () => {
    const { result } = renderHook(() => useFloating(() => null));
    result.current.reposition();
    expect(result.current.style.visibility).toBe('hidden');
  });

  it('does nothing when cardRef is null', () => {
    const { result } = renderHook(() => useFloating(() => makeRect()));
    result.current.reposition();
    expect(result.current.style.visibility).toBe('hidden');
  });
});
