import type { ElementAnchor, Note } from './note';

export enum ResolutionQuality {
  Exact = 'exact',
  Probable = 'probable',
  Fallback = 'fallback',
  Unresolved = 'unresolved',
}

export interface ResolutionResult {
  quality: ResolutionQuality;
  element: Element | null;
  note: Note;
}

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim()
    .toLowerCase()
    .slice(0, 100);
}

function querySelectorSafe(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

function querySelectorAllSafe(selector: string): NodeListOf<Element> {
  try {
    return document.querySelectorAll(selector);
  } catch {
    return document.querySelectorAll(':invalid');
  }
}

function findUniqueBySignals(
  anchor: ElementAnchor,
  tagElements: NodeListOf<Element>,
): Element | null {
  const signals = anchor.signals;

  if (signals.testId) {
    for (const el of tagElements) {
      const elTestId =
        el.getAttribute('data-testid') ??
        el.getAttribute('data-test-id') ??
        el.getAttribute('data-test');
      if (elTestId === signals.testId) return el;
    }
  }

  if (signals.id) {
    const byId = document.getElementById(signals.id);
    if (byId && byId.tagName.toLowerCase() === signals.tagName) return byId;
  }

  if (signals.ariaLabel) {
    const candidates: Element[] = [];
    for (const el of tagElements) {
      if (el.getAttribute('aria-label') === signals.ariaLabel) {
        candidates.push(el);
      }
    }
    if (candidates.length === 1) return candidates[0];
  }

  if (signals.href) {
    const candidates: Element[] = [];
    for (const el of tagElements) {
      if (el.getAttribute('href') === signals.href) {
        candidates.push(el);
      }
    }
    if (candidates.length === 1) return candidates[0];
  }

  if (signals.src) {
    const candidates: Element[] = [];
    for (const el of tagElements) {
      if (el.getAttribute('src') === signals.src) {
        candidates.push(el);
      }
    }
    if (candidates.length === 1) return candidates[0];
  }

  if (signals.textSnippet) {
    const normalizedTarget = normalizeText(signals.textSnippet);
    const candidates: Element[] = [];
    for (const el of tagElements) {
      const elText = el.textContent || '';
      if (normalizeText(elText) === normalizedTarget) {
        candidates.push(el);
      }
    }
    if (candidates.length === 1) return candidates[0];
  }

  if (signals.role) {
    const candidates: Element[] = [];
    for (const el of tagElements) {
      if (el.getAttribute('role') === signals.role) {
        candidates.push(el);
      }
    }
    if (candidates.length === 1) return candidates[0];
  }

  return null;
}

function findByDataAttributes(anchor: ElementAnchor): Element | null {
  const dataAttrs = anchor.signals.dataAttributes;
  if (!dataAttrs) return null;

  const entries = Object.entries(dataAttrs);
  if (entries.length === 0) return null;

  let selector = anchor.signals.tagName;
  for (const [key, value] of entries) {
    const safeKey = CSS.escape(key);
    const safeValue = CSS.escape(value);
    selector += `[${safeKey}="${safeValue}"]`;
  }

  const els = querySelectorAllSafe(selector);
  if (els.length === 1) return els[0];
  return null;
}

export function resolveAnchor(note: Note): ResolutionResult {
  const anchor = note.anchor;

  if (anchor.primarySelector) {
    const bySelector = querySelectorSafe(anchor.primarySelector);
    if (bySelector) {
      return { quality: ResolutionQuality.Exact, element: bySelector, note };
    }
  }

  const byDataAttrs = findByDataAttributes(anchor);
  if (byDataAttrs) {
    return { quality: ResolutionQuality.Probable, element: byDataAttrs, note };
  }

  if (anchor.signals.tagName) {
    const tagElements = querySelectorAllSafe(anchor.signals.tagName);
    if (tagElements.length > 0) {
      const unique = findUniqueBySignals(anchor, tagElements);
      if (unique) {
        return { quality: ResolutionQuality.Probable, element: unique, note };
      }

      if (anchor.signals.classNames) {
        const classNames = anchor.signals.classNames.split(/\s+/).filter(Boolean);
        if (classNames.length > 0) {
          const selector = classNames.map((c) => `.${CSS.escape(c)}`).join('');
          const byClass = querySelectorAllSafe(selector);
          if (byClass.length === 1) {
            return { quality: ResolutionQuality.Probable, element: byClass[0], note };
          }
        }
      }
    }
  }

  const pos = anchor.fallbackDocumentPosition;
  const el = document.elementFromPoint(pos.x - window.scrollX, pos.y - window.scrollY);
  if (el) {
    return { quality: ResolutionQuality.Fallback, element: el, note };
  }

  return { quality: ResolutionQuality.Unresolved, element: null, note };
}
