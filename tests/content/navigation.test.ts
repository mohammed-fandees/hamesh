// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onNavigationChange, cleanup } from '@/content/navigation';

describe('onNavigationChange', () => {
  afterEach(() => {
    cleanup();
  });

  it('calls the callback when location.href changes via poll', async () => {
    const cb = vi.fn();
    onNavigationChange(cb);
    const origHref = window.location.href;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: origHref + '?changed=1' },
      writable: true,
      configurable: true,
    });
    await new Promise((r) => setTimeout(r, 600));
    expect(cb).toHaveBeenCalled();
  });

  it('calls the callback on popstate when href differs', () => {
    const cb = vi.fn();
    onNavigationChange(cb);
    // Simulate href change
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: 'http://localhost/#new' },
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event('popstate'));
    expect(cb).toHaveBeenCalled();
  });

  it('calls the callback on hashchange when href differs', () => {
    const cb = vi.fn();
    onNavigationChange(cb);
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: 'http://localhost/#hash' },
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event('hashchange'));
    expect(cb).toHaveBeenCalled();
  });

  it('does NOT call the callback on popstate when href unchanged', () => {
    const cb = vi.fn();
    onNavigationChange(cb);
    window.dispatchEvent(new Event('popstate'));
    expect(cb).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe function that stops delivery', () => {
    const cb = vi.fn();
    const unsub = onNavigationChange(cb);
    unsub();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: 'http://localhost/#after-unsub' },
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event('popstate'));
    expect(cb).not.toHaveBeenCalled();
  });

  it('supports multiple callbacks', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    onNavigationChange(cb1);
    onNavigationChange(cb2);
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: 'http://localhost/#multi' },
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event('popstate'));
    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  it('does not call removed callback but still calls remaining ones', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = onNavigationChange(cb1);
    onNavigationChange(cb2);
    unsub1();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: 'http://localhost/#partial' },
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event('popstate'));
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  it('does not duplicate callbacks when subscribing the same function', () => {
    const cb = vi.fn();
    onNavigationChange(cb);
    onNavigationChange(cb);
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: 'http://localhost/#dedup' },
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event('popstate'));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('handles callback that throws without breaking other callbacks', () => {
    const badCb = vi.fn(() => {
      throw new Error('boom');
    });
    const goodCb = vi.fn();
    onNavigationChange(badCb);
    onNavigationChange(goodCb);
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: 'http://localhost/#throw' },
      writable: true,
      configurable: true,
    });
    expect(() => window.dispatchEvent(new Event('popstate'))).not.toThrow();
    expect(goodCb).toHaveBeenCalled();
  });
});

describe('cleanup', () => {
  it('removes all callbacks and stops events', () => {
    const cb = vi.fn();
    onNavigationChange(cb);
    cleanup();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: 'http://localhost/#cleanup' },
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event('popstate'));
    expect(cb).not.toHaveBeenCalled();
  });

  it('is safe to call multiple times', () => {
    cleanup();
    cleanup();
  });
});
