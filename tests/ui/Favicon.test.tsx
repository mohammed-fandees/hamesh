// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { id: 'test-extension-id' },
  },
}));

const REAL_BYTES = new Uint8Array([1, 2, 3, 4]).buffer;
const PLACEHOLDER_BYTES = new Uint8Array([9, 9]).buffer;

function mockFetch(realBufferFor: (url: string) => ArrayBuffer) {
  return vi.fn(async (url: string) => ({
    arrayBuffer: async () => realBufferFor(url),
  })) as unknown as typeof fetch;
}

async function importFavicon() {
  const mod = await import('@/ui/Favicon');
  return mod.Favicon;
}

describe('Favicon', () => {
  // `URL.createObjectURL`/`revokeObjectURL` are mutated in place (jsdom
  // doesn't implement them) rather than via `vi.stubGlobal('URL', ...)` —
  // stubbing would replace the whole `URL` binding, breaking every other use
  // of `new URL(...)` in the module under test. Saved/restored explicitly so
  // the mocks don't leak into other test files.
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.resetModules();
    cleanup();
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests the domain's favicon from Chrome's local favicon cache", async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch((url) => (url.includes('hamesh-favicon-probe') ? PLACEHOLDER_BYTES : REAL_BYTES)),
    );
    const Favicon = await importFavicon();
    const { container } = render(<Favicon domain="github.com" />);

    await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument());
    const calledUrls = (fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(
      calledUrls.some((u) => u.includes('chrome-extension://test-extension-id/_favicon/')),
    ).toBe(true);
    expect(calledUrls.some((u) => u.includes(encodeURIComponent('https://github.com')))).toBe(true);
  });

  it('renders a globe icon when Chrome returns its no-favicon placeholder', async () => {
    // Same bytes for every request — indistinguishable from "no favicon".
    vi.stubGlobal(
      'fetch',
      mockFetch(() => PLACEHOLDER_BYTES),
    );
    const Favicon = await importFavicon();
    const { container } = render(<Favicon domain="no-favicon-example.test" />);

    await waitFor(() => expect(container.querySelector('.hm-favicon--globe')).toBeInTheDocument());
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('renders the real favicon image when its bytes differ from the placeholder', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch((url) => (url.includes('hamesh-favicon-probe') ? PLACEHOLDER_BYTES : REAL_BYTES)),
    );
    const Favicon = await importFavicon();
    const { container } = render(<Favicon domain="example.com" />);

    await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument());
    expect(container.querySelector('.hm-favicon--globe')).not.toBeInTheDocument();
  });

  it('falls back to the globe icon when the fetch itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network error');
      }),
    );
    const Favicon = await importFavicon();
    const { container } = render(<Favicon domain="example.com" />);

    await waitFor(() => expect(container.querySelector('.hm-favicon--globe')).toBeInTheDocument());
  });
});
