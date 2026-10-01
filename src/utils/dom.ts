const INELIGIBLE_TAGS = new Set([
  'body',
  'html',
  'script',
  'style',
  'link',
  'meta',
  'noscript',
  'template',
  'slot',
  'svg',
  'g',
  'path',
  'circle',
  'line',
  'rect',
  'polygon',
  'polyline',
  'text',
  'tspan',
  'defs',
  'use',
  'clipPath',
  'mask',
  'linearGradient',
  'radialGradient',
  'stop',
]);

export function isEligibleElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (INELIGIBLE_TAGS.has(tag)) return false;
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  return true;
}

export function getDeepestEligibleElement(element: Element): Element {
  let current: Element | null = element;
  while (current && !isEligibleElement(current)) {
    current = current.parentElement;
  }
  return current ?? document.body;
}

export function getElementPosition(element: Element): {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * How long a restored note's "here it is" flash lasts, on an element (the
 * `.hm-restore-highlight` ring) or on text (its highlight). The one number:
 * the ring's CSS animation reads it from `--hm-flash`, set from here, and the
 * flash is cleared by the same value — so the two can never drift apart.
 */
export const RESTORE_FLASH_MS = 1400;

/** Brings an element into view (its middle, unless told otherwise) — smoothly, unless the reader
 *  asked for less motion. The one way Hamesh scrolls a web page. */
export function revealElement(element: Element, block: ScrollLogicalPosition = 'center'): void {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block });
}

/** The element under a point on the page, or `null` — never a throw, which
 *  some pages' own overrides of `elementFromPoint` have done. */
export function elementAtPoint(x: number, y: number): Element | null {
  try {
    return document.elementFromPoint(x, y);
  } catch {
    return null;
  }
}
