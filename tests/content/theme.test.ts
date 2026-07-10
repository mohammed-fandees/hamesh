// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { parseColorLuminance, detectHostTheme } from '@/content/theme';

describe('parseColorLuminance', () => {
  it('returns low luminance for dark backgrounds', () => {
    const lum = parseColorLuminance('rgb(22, 20, 15)');
    expect(lum).not.toBeNull();
    expect(lum!).toBeLessThan(0.4);
  });

  it('returns high luminance for light backgrounds', () => {
    const lum = parseColorLuminance('rgb(247, 243, 236)');
    expect(lum).not.toBeNull();
    expect(lum!).toBeGreaterThan(0.4);
  });

  it('treats fully transparent colors as "no background"', () => {
    expect(parseColorLuminance('rgba(0, 0, 0, 0)')).toBeNull();
  });

  it('returns null for non-rgb values (e.g. named/keyword)', () => {
    expect(parseColorLuminance('transparent')).toBeNull();
  });
});

function stubPrefersDark(matches: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('dark') && matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

describe('detectHostTheme', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
  });

  it('reads an opaque background directly on <body>', () => {
    document.body.style.backgroundColor = 'rgb(22, 20, 15)';
    expect(detectHostTheme()).toBe('dark');

    document.body.style.backgroundColor = 'rgb(247, 243, 236)';
    expect(detectHostTheme()).toBe('light');
  });

  it('walks up to <html> when <body> is transparent', () => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'rgb(22, 20, 15)';
    expect(detectHostTheme()).toBe('dark');
  });

  it('finds a background nested in a single-child app-shell chain (body/html transparent)', () => {
    document.body.innerHTML = '<div id="root"><div class="shell"><main>content</main></div></div>';
    (document.getElementById('root') as HTMLElement).style.backgroundColor = 'rgb(22, 20, 15)';
    expect(detectHostTheme()).toBe('dark');
  });

  it('does not wander past the first branching point into unrelated content', () => {
    // body itself branches (two children) — the down-walk should not dive
    // into either child looking for a background; must fall through to the
    // OS preference / default instead of guessing.
    document.body.innerHTML = '<header>a</header><main>b</main>';
    (document.querySelector('main') as HTMLElement).style.backgroundColor = 'rgb(22, 20, 15)';
    stubPrefersDark(false);
    expect(detectHostTheme()).toBe('light');
  });

  it('falls back to the OS preference when no background is found anywhere', () => {
    stubPrefersDark(true);
    expect(detectHostTheme()).toBe('dark');

    stubPrefersDark(false);
    expect(detectHostTheme()).toBe('light');
  });

  it('defaults to light if matchMedia is unavailable', () => {
    // @ts-expect-error simulating an environment without matchMedia
    window.matchMedia = undefined;
    expect(detectHostTheme()).toBe('light');
  });

  it('a dark page shell with a light content card still reads as dark (page chrome wins, by design)', () => {
    document.body.style.backgroundColor = 'rgb(22, 20, 15)';
    document.body.innerHTML = '<main style="background-color: rgb(247, 243, 236)">card</main>';
    document.body.style.backgroundColor = 'rgb(22, 20, 15)';
    expect(detectHostTheme()).toBe('dark');
  });
});
