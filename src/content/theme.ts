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

function backgroundLuminance(el: Element): number | null {
  return parseColorLuminance(getComputedStyle(el).backgroundColor);
}

export function detectHostTheme(): HostTheme {
  try {
    // 1) Walk up from <body> — the common case: an opaque background set on
    //    body or html.
    let lum: number | null = null;
    for (let el: Element | null = document.body; el; el = el.parentElement) {
      lum = backgroundLuminance(el);
      if (lum !== null) break;
    }

    // 2) Nested app shells (React/Vue/etc. root divs) often leave body/html
    //    transparent and put the real background a few levels down. Walk
    //    down through single-child chains from <body> — the common
    //    body > #root > .app-shell > ... shape — sampling each for a
    //    background. Deterministic (no viewport/scroll dependency, unlike
    //    a hit-test at some arbitrary point) and bounded, so it stays cheap
    //    and doesn't wander into unrelated branching content.
    if (lum === null) {
      let el: Element | null = document.body;
      for (let depth = 0; el && el.children.length === 1 && depth < 12; depth++) {
        el = el.children[0];
        lum = backgroundLuminance(el);
        if (lum !== null) break;
      }
    }

    if (lum !== null) return lum < 0.4 ? 'dark' : 'light';

    // No opaque background found anywhere in the chain; fall back to the OS
    // preference. (Note: this intentionally reflects the *page's* overall
    // chrome, not a specific content card — a dark page shell with a white
    // reading card still reads as "dark" here, same as before this change.)
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    /* defensive: never break the host page over theming */
  }
  return 'light';
}
