import type { ElementAnchor } from './note';

export interface AnchorCandidate {
  element: Element;
  signals: ElementAnchor['signals'];
  selector: string | null;
}

export function collectAnchorSignals(element: Element): ElementAnchor['signals'] {
  const signals: ElementAnchor['signals'] = {
    tagName: element.tagName.toLowerCase(),
  };

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) signals.ariaLabel = ariaLabel;

  const testId =
    element.getAttribute('data-testid') ??
    element.getAttribute('data-test-id') ??
    element.getAttribute('data-test') ??
    undefined;
  if (testId) signals.testId = testId;

  const id = element.getAttribute('id');
  if (id) signals.id = id;

  const text = element.textContent?.trim().slice(0, 200);
  if (text) signals.textSnippet = text;

  const className = element.getAttribute('class');
  if (className) signals.classNames = className;

  const href = element.getAttribute('href');
  if (href) signals.href = href;

  const src = element.getAttribute('src');
  if (src) signals.src = src;

  const alt = element.getAttribute('alt');
  if (alt) signals.alt = alt;

  const role = element.getAttribute('role');
  if (role) signals.role = role;

  const dataAttrs: Record<string, string> = {};
  for (const attr of element.attributes) {
    if (attr.name.startsWith('data-')) {
      const skip = ['data-testid', 'data-test-id', 'data-test'];
      if (!skip.includes(attr.name)) {
        dataAttrs[attr.name] = attr.value;
      }
    }
  }
  if (Object.keys(dataAttrs).length > 0) {
    signals.dataAttributes = dataAttrs;
  }

  return signals;
}

export function generateCssSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase();
    const id = current.getAttribute('id');
    if (id) {
      parts.unshift(`#${CSS.escape(id)}`);
      break;
    }
    let index = 1;
    let sibling: Element | null = current.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === current!.tagName) index++;
      sibling = sibling.previousElementSibling;
    }
    const nth =
      index > 1 ||
      (current.nextElementSibling !== null &&
        current.nextElementSibling.tagName === current.tagName)
        ? `:nth-of-type(${index})`
        : '';
    parts.unshift(`${tag}${nth}`);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

export function buildElementAnchor(element: Element): ElementAnchor {
  const signals = collectAnchorSignals(element);
  const selector = generateCssSelector(element);
  const rect = element.getBoundingClientRect();

  return {
    primarySelector: selector,
    signals,
    fallbackDocumentPosition: {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
    },
  };
}
