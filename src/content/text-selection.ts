import { MAX_EXACT_LENGTH, normalizeText } from '@/domain/text-anchor';
import type { AnchorRect } from '@/content/useFloating';

/**
 * Everything about *reading* a user's text selection, kept deliberately free
 * of any note logic — `HameshApp` decides what to do with a capture; this
 * module only decides whether there is one and what it covers.
 */
export interface TextSelectionCapture {
  /** A cloned, live range. Cloned because the browser's own selection is
   *  thrown away the moment focus moves (clicking the Hamesh action is
   *  exactly that moment) — this keeps the user's actual text, not
   *  whatever the selection has become by the time they act. */
  range: Range;
  /** Normalized selected text — what the composer shows as "attached text". */
  text: string;
  /** Where the selection ends on screen, for placing the action chip. */
  rect: AnchorRect;
}

function toRect(domRect: DOMRect): AnchorRect {
  return { left: domRect.left, top: domRect.top, width: domRect.width, height: domRect.height };
}

/** Stand-in when a range has no geometry to report. Callers that place UI
 *  from a capture re-measure the live range themselves anyway (the page can
 *  scroll between capture and use), so this is only ever a starting point. */
const EMPTY_RECT: AnchorRect = { left: 0, top: 0, width: 0, height: 0 };

/** Editable regions are out of scope: their content is owned (and rewritten)
 *  by the page or the user, so an anchor into one is a promise Hamesh can't
 *  keep. `getSelection()` doesn't expose input/textarea internals at all, so
 *  this really only has to catch contenteditable. */
function isEditableContext(node: Node | null): boolean {
  let el: Element | null = node instanceof Element ? node : (node?.parentElement ?? null);
  while (el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el instanceof HTMLElement && el.isContentEditable) return true;
    el = el.parentElement;
  }
  return false;
}

function isInsideHameshUi(node: Node | null, host: Element | null): boolean {
  if (!node) return true;
  if (host && (host === node || host.contains(node))) return true;
  let el: Element | null = node instanceof Element ? node : (node?.parentElement ?? null);
  while (el) {
    if (el.tagName.toLowerCase().startsWith('hamesh-')) return true;
    el = el.parentElement;
  }
  return false;
}

/**
 * Whether a range is something Hamesh will anchor a note to. Intentionally
 * strict — a rejected selection means the action chip simply never appears,
 * which is far better than offering a note that could never be restored.
 */
export function isAnchorableRange(
  range: Range | null,
  host: Element | null = null,
): range is Range {
  if (!range || range.collapsed) return false;
  const text = normalizeText(range.toString());
  if (!text || text.length > MAX_EXACT_LENGTH) return false;
  if (!range.commonAncestorContainer.isConnected) return false;
  if (!document.body.contains(range.commonAncestorContainer)) return false;
  if (isInsideHameshUi(range.commonAncestorContainer, host)) return false;
  if (isEditableContext(range.startContainer) || isEditableContext(range.endContainer))
    return false;
  return true;
}

/**
 * Reads the document's current selection into a capture, or `null` if there
 * isn't an anchorable one. Both entry points into contextual notes — the
 * selection action chip and the keyboard shortcut — go through this single
 * function, so "what counts as a valid selection" is defined exactly once.
 */
export function captureTextSelection(host: Element | null = null): TextSelectionCapture | null {
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0) return null;

  const live = selection.getRangeAt(0);
  if (!isAnchorableRange(live, host)) return null;

  const range = live.cloneRange();
  const rects = rangeRects(range).filter((r) => r.width > 0 || r.height > 0);
  const last = rects[rects.length - 1] ?? null;

  return {
    range,
    text: normalizeText(range.toString()),
    rect: last ? toRect(last) : EMPTY_RECT,
  };
}

/** Every client rect of a range — one per line it covers. Guarded because a
 *  range's geometry is the one part of this that a non-browser environment
 *  (a DOM implementation without layout) genuinely cannot provide; callers
 *  degrade to "no on-screen presence" rather than throwing. */
function rangeRects(range: Range): DOMRect[] {
  try {
    return typeof range.getClientRects === 'function' ? Array.from(range.getClientRects()) : [];
  } catch {
    return [];
  }
}

/** Client rects for a resolved range, viewport-clipped to the ones actually
 *  worth hit-testing. Used for hover/click detection over highlighted text —
 *  the highlight itself is painted by the Custom Highlight API and so has no
 *  DOM node of its own to hover. */
export function visibleRangeRects(range: Range): DOMRect[] {
  const rects = rangeRects(range);
  if (rects.length === 0) return [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return rects.filter(
    (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw,
  );
}

/** Whether a viewport point falls inside any of `rects`, with a small
 *  tolerance so the highlight stays easy to hit on a line of small text. */
export function rectsContainPoint(rects: DOMRect[], x: number, y: number, pad = 2): boolean {
  return rects.some(
    (r) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad,
  );
}
