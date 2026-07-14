// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { id: 'test-extension-id' },
  },
}));

async function importFavicon() {
  const mod = await import('@/ui/Favicon');
  return mod.Favicon;
}

describe('Favicon', () => {
  beforeEach(() => {
    vi.resetModules();
    cleanup();
  });

  it("requests the domain's favicon from Chrome's local favicon cache", async () => {
    const Favicon = await importFavicon();
    const { container } = render(<Favicon domain="github.com" />);

    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.src).toContain('chrome-extension://test-extension-id/_favicon/');
    expect(img.src).toContain(encodeURIComponent('https://github.com'));
  });

  it('falls back to a deterministic monogram when the image fails to load', async () => {
    const Favicon = await importFavicon();
    const { container } = render(<Favicon domain="github.com" />);

    const img = container.querySelector('img')!;
    fireEvent.error(img);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('renders the same monogram letter/color for the same domain across instances', async () => {
    const Favicon = await importFavicon();
    const first = render(<Favicon domain="example.com" />);
    fireEvent.error(first.container.querySelector('img')!);
    const firstClass = first.container.querySelector('.hm-favicon--fallback')!.className;

    const second = render(<Favicon domain="example.com" />);
    fireEvent.error(second.container.querySelector('img')!);
    const secondClass = second.container.querySelector('.hm-favicon--fallback')!.className;

    expect(firstClass).toBe(secondClass);
  });
});
