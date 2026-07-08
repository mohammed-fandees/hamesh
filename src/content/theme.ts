/**
 * Detects whether the host page is visually light or dark so Hamesh can pick
 * the matching theme. Hamesh never derives its *colors* from the page — only
 * this light/dark decision — so its surfaces stay legible on any background.
 */
export type HostTheme = 'light' | 'dark';

export function parseColorLuminance(color: string): number | null {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
  const [r, g, b, a] = parts;
  if (a !== undefined && a === 0) return null; // fully transparent — keep looking
  // Relative luminance (sRGB approximation)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function detectHostTheme(): HostTheme {
  try {
    let el: Element | null = document.body;
    while (el) {
      const bg = getComputedStyle(el).backgroundColor;
      const lum = parseColorLuminance(bg);
      if (lum !== null) {
        return lum < 0.4 ? 'dark' : 'light';
      }
      el = el.parentElement;
    }
    // No opaque background found; fall back to the OS preference.
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    /* defensive: never break the host page over theming */
  }
  return 'light';
}
