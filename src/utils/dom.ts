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

export function scrollToElement(element: Element): void {
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
