import type { TextAnchor } from './note';
import { generateCssSelector } from './anchor';

/** Bumped only when the stored `TextAnchor` shape changes in a way old
 *  anchors can't be read as — see `TextAnchor.version`. */
export const TEXT_ANCHOR_VERSION = 1;

/** How much text either side of the selection is kept to tell repeated
 *  occurrences apart. Long enough to disambiguate real prose, short enough
 *  that it stays cheap to store on every note. */
export const CONTEXT_LENGTH = 32;

/** Upper bound on a single contextual selection. Beyond this the anchor
 *  stops being a "note attached to a phrase" and starts being a copy of the
 *  page kept in `chrome.storage.local`; the selection action simply doesn't
 *  offer itself (see `content/text-selection.ts`). */
export const MAX_EXACT_LENGTH = 5000;

/** Subtrees whose text is never part of a user-visible page selection.
 *  Mirrors the spirit of `utils/dom.ts`'s ineligible tags, plus form fields
 *  — Hamesh deliberately does not anchor into inputs/textareas. */
const SKIPPED_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'textarea',
  'input',
  'select',
  'option',
  'svg',
  'canvas',
  'iframe',
  'object',
  'video',
  'audio',
  'head',
  'title',
]);

/** Elements that don't start a new visual line, so text either side of them
 *  runs together with no separator ("<b>Hel</b>lo" is one word). Everything
 *  else counts as a block boundary and contributes a single space.
 *  Tag-based on purpose: `getComputedStyle` per text node is far too
 *  expensive for a whole-page index, and what matters most here is
 *  producing the exact same string at capture time and at restore time. */
const INLINE_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'big',
  'cite',
  'code',
  'data',
  'del',
  'dfn',
  'em',
  'font',
  'i',
  'ins',
  'kbd',
  'label',
  'mark',
  'nobr',
  'q',
  'rt',
  'ruby',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'tt',
  'u',
  'var',
  'wbr',
]);

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v';
}

/** Hamesh's own shadow host (and anything it ever marks as its own) is not
 *  part of the page's text. Its contents live in a shadow root a TreeWalker
 *  wouldn't descend into anyway; this is the belt to those braces. */
function isHameshElement(el: Element): boolean {
  return el.tagName.toLowerCase().startsWith('hamesh-') || el.hasAttribute('data-hamesh');
}

/** The nearest ancestor that starts a new visual line — see `INLINE_TAGS`. */
function blockContainerOf(node: Node): Element | null {
  let current: Element | null = node.parentElement;
  while (current && INLINE_TAGS.has(current.tagName.toLowerCase())) {
    current = current.parentElement;
  }
  return current;
}

/**
 * Emits `raw`'s whitespace-normalized characters paired with the offset each
 * came from. One shared definition of "normalized" for the whole feature:
 * the index builder accumulates these, and mapping a normalized offset back
 * to a DOM position replays them for a single node. Runs of whitespace
 * collapse to one space, and a leading run is dropped entirely when whatever
 * precedes this node already ended in one.
 */
function* normalizedChars(
  raw: string,
  precededBySpace: boolean,
): Generator<{ ch: string; rawIndex: number }> {
  let prevWasSpace = precededBySpace;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (isSpace(ch)) {
      if (prevWasSpace) continue;
      prevWasSpace = true;
      yield { ch: ' ', rawIndex: i };
    } else {
      prevWasSpace = false;
      yield { ch, rawIndex: i };
    }
  }
}

export interface TextIndexSegment {
  node: Text;
  /** Half-open span this node occupies in `TextIndex.text`. */
  start: number;
  end: number;
  /** What `normalizedChars` was seeded with for this node — needed to
   *  replay the exact same normalization when mapping back. */
  precededBySpace: boolean;
}

/**
 * One whitespace-normalized string for a subtree, plus the mapping back to
 * the text nodes it came from. Built at most once per resolution pass and
 * shared by every note in that pass (see `resolveTextAnchors`) — never
 * cached across passes, so there is no stale-index failure mode to reason
 * about.
 */
export interface TextIndex {
  text: string;
  segments: TextIndexSegment[];
  root: Node;
}

export function buildTextIndex(root: Node = document.body): TextIndex {
  const segments: TextIndexSegment[] = [];
  let text = '';

  if (!root) return { text, segments, root };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node: Node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tag = el.tagName.toLowerCase();
        if (SKIPPED_TAGS.has(tag) || isHameshElement(el)) return NodeFilter.FILTER_REJECT;
        // `<br>` is emitted so it can act as a line boundary; every other
        // element is stepped through to reach its text.
        return tag === 'br' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let pendingBoundary = false;
  let lastBlock: Element | null = null;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      pendingBoundary = true; // a <br>
      continue;
    }

    const textNode = node as Text;
    const raw = textNode.data;
    if (!raw) continue;

    const block = blockContainerOf(textNode);
    if (lastBlock !== null && block !== lastBlock) pendingBoundary = true;
    lastBlock = block;

    if (pendingBoundary) {
      pendingBoundary = false;
      // A synthetic separator belongs to no node — the gap it leaves
      // between segments is handled by `findSegment` below.
      if (text.length > 0 && !text.endsWith(' ')) text += ' ';
    }

    const precededBySpace = text.length === 0 || text.endsWith(' ');
    let emitted = '';
    for (const { ch } of normalizedChars(raw, precededBySpace)) emitted += ch;
    if (!emitted) continue;

    segments.push({
      node: textNode,
      start: text.length,
      end: text.length + emitted.length,
      precededBySpace,
    });
    text += emitted;
  }

  return { text, segments, root };
}

/** Index of the segment covering `offset`, or -1. `atEnd` picks the segment
 *  that *ends* at the offset rather than the one that starts there, so a
 *  range's end boundary stays attached to the text it actually covers. */
function findSegment(index: TextIndex, offset: number, atEnd: boolean): number {
  const { segments } = index;
  let lo = 0;
  let hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    const before = atEnd ? offset <= seg.start : offset < seg.start;
    const after = atEnd ? offset > seg.end : offset >= seg.end;
    if (before) hi = mid - 1;
    else if (after) lo = mid + 1;
    else return mid;
  }
  // The offset fell in a gap (a synthetic block separator). Snap to the
  // nearest real segment on the appropriate side rather than failing.
  if (segments.length === 0) return -1;
  if (atEnd) return Math.min(Math.max(hi, 0), segments.length - 1);
  return Math.min(Math.max(lo, 0), segments.length - 1);
}

/** Raw offset inside `segment.node` for the `target`-th normalized character
 *  of that node (`target === length` yields one past the last one). */
function rawOffsetInSegment(segment: TextIndexSegment, target: number): number {
  let seen = 0;
  let lastRaw = -1;
  for (const { rawIndex } of normalizedChars(segment.node.data, segment.precededBySpace)) {
    if (seen === target) return rawIndex;
    lastRaw = rawIndex;
    seen++;
  }
  return lastRaw + 1;
}

export interface DomPoint {
  node: Text;
  offset: number;
}

/** Maps a normalized-text offset back to a concrete DOM position. */
export function domPointForOffset(
  index: TextIndex,
  offset: number,
  atEnd = false,
): DomPoint | null {
  if (index.segments.length === 0) return null;
  const segIndex = findSegment(index, offset, atEnd);
  if (segIndex < 0) return null;
  const segment = index.segments[segIndex];
  const clamped = Math.max(segment.start, Math.min(offset, segment.end));
  return { node: segment.node, offset: rawOffsetInSegment(segment, clamped - segment.start) };
}

/** Builds a live `Range` for a normalized-text span. Returns `null` rather
 *  than throwing if either boundary can't be mapped. */
export function rangeForSpan(index: TextIndex, start: number, end: number): Range | null {
  const startPoint = domPointForOffset(index, start, false);
  const endPoint = domPointForOffset(index, end, true);
  if (!startPoint || !endPoint) return null;
  try {
    const range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    return range.collapsed && start !== end ? null : range;
  } catch {
    return null;
  }
}

/** Child-index path from `root` down to `el`, counting element children
 *  only. `null` when `el` isn't inside `root`. */
export function elementPath(el: Element, root: Element): number[] | null {
  const path: number[] = [];
  let current: Element | null = el;
  while (current && current !== root) {
    const parent: Element | null = current.parentElement;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.children, current));
    current = parent;
  }
  return current === root ? path : null;
}

export function elementAtPath(path: number[], root: Element): Element | null {
  let current: Element = root;
  for (const idx of path) {
    const next = current.children[idx];
    if (!next) return null;
    current = next;
  }
  return current;
}

/** Character offset of a text-node position within its parent element's own
 *  direct text (its direct child text nodes, concatenated). Stable across
 *  the text-node splitting and merging that framework re-renders cause. */
export function directTextOffset(node: Text, offsetInNode: number): number | null {
  const parent = node.parentElement;
  if (!parent) return null;
  let total = 0;
  for (const child of parent.childNodes) {
    if (child === node) return total + Math.min(offsetInNode, node.data.length);
    if (child.nodeType === Node.TEXT_NODE) total += (child as Text).data.length;
  }
  return null;
}

/** Inverse of `directTextOffset`. */
export function directTextPosition(el: Element, offset: number): DomPoint | null {
  let remaining = offset;
  let last: DomPoint | null = null;
  for (const child of el.childNodes) {
    if (child.nodeType !== Node.TEXT_NODE) continue;
    const textNode = child as Text;
    if (remaining <= textNode.data.length) return { node: textNode, offset: remaining };
    remaining -= textNode.data.length;
    last = { node: textNode, offset: textNode.data.length };
  }
  return remaining === 0 ? last : null;
}

/**
 * The nearest ancestor stable enough to scope recovery to — meaning one
 * carrying an id, and nothing else.
 *
 * Deliberately not "else fall back to the block container": a container is
 * used during recovery to *break ties between identical occurrences*, and a
 * positionally-identified one (`p:nth-of-type(2)`) silently points at a
 * different paragraph the moment the page gains one earlier in the document
 * — which is exactly how a note would end up attached to the wrong text.
 * No container at all is strictly better than an unreliable one: recovery
 * simply falls through to context matching, which refuses to guess.
 */
function pickContainer(node: Node): Element | null {
  let current: Element | null = node.parentElement;
  while (current && current !== document.body) {
    if (current.id) return current;
    current = current.parentElement;
  }
  return null;
}

function buildContainerInfo(node: Node): TextAnchor['container'] {
  const el = pickContainer(node);
  if (!el || el === document.body || !document.body.contains(el)) return undefined;
  const selector = generateCssSelector(el) || undefined;
  const path = elementPath(el, document.body) ?? undefined;
  if (!selector && !path) return undefined;
  return { selector, path };
}

/** How many normalized characters of `segment` precede raw offset `rawOffset`. */
function normalizedOffsetWithin(segment: TextIndexSegment, rawOffset: number): number {
  let seen = 0;
  for (const { rawIndex } of normalizedChars(segment.node.data, segment.precededBySpace)) {
    if (rawIndex >= rawOffset) return seen;
    seen++;
  }
  return seen;
}

/**
 * Captures a `TextAnchor` for a user selection — the text-note counterpart
 * of `buildElementAnchor` / `buildVideoAnchor`. Returns `null` (rather than
 * an anchor that could never resolve back) when the range covers no real
 * text, is longer than `MAX_EXACT_LENGTH`, or doesn't intersect the indexed
 * document at all.
 *
 * The returned `range` is deliberately *not* the caller's range: it is
 * re-derived from the same normalized index restoration will use, and
 * trimmed to the exact text the note is about. That's what guarantees the
 * highlight drawn right after saving covers precisely the text the anchor
 * describes — no "the selection also swept up a trailing newline" drift
 * between capture and restore.
 */
export function buildTextAnchor(
  range: Range,
  index?: TextIndex,
): { anchor: TextAnchor; range: Range } | null {
  const idx = index ?? buildTextIndex(document.body);
  if (idx.segments.length === 0) return null;

  const covered = idx.segments.filter((segment) => {
    try {
      return range.intersectsNode(segment.node);
    } catch {
      return false;
    }
  });
  if (covered.length === 0) return null;

  const first = covered[0];
  const last = covered[covered.length - 1];

  const startInNode =
    range.startContainer === first.node ? Math.min(range.startOffset, first.node.data.length) : 0;
  const endInNode =
    range.endContainer === last.node
      ? Math.min(range.endOffset, last.node.data.length)
      : last.node.data.length;

  let start = first.start + normalizedOffsetWithin(first, startInNode);
  let end = last.start + normalizedOffsetWithin(last, endInNode);
  if (end <= start) return null;

  // Trim to real text so `exact`, `textPosition`, both context slices, and
  // the highlight range all describe the same characters.
  while (start < end && idx.text[start] === ' ') start++;
  while (end > start && idx.text[end - 1] === ' ') end--;

  const exact = idx.text.slice(start, end);
  if (!exact || exact.length > MAX_EXACT_LENGTH) return null;

  const resolvedRange = rangeForSpan(idx, start, end);
  if (!resolvedRange) return null;

  const anchor: TextAnchor = {
    type: 'text',
    version: TEXT_ANCHOR_VERSION,
    exact,
    context: {
      prefix: idx.text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
      suffix: idx.text.slice(end, end + CONTEXT_LENGTH),
    },
    textPosition: { start, end },
  };

  const startParent = resolvedRange.startContainer.parentElement;
  const endParent = resolvedRange.endContainer.parentElement;
  if (startParent && endParent) {
    const startPath = elementPath(startParent, document.body);
    const endPath = elementPath(endParent, document.body);
    const startOffset = directTextOffset(
      resolvedRange.startContainer as Text,
      resolvedRange.startOffset,
    );
    const endOffset = directTextOffset(resolvedRange.endContainer as Text, resolvedRange.endOffset);
    if (startPath && endPath && startOffset !== null && endOffset !== null) {
      anchor.path = { startPath, startOffset, endPath, endOffset };
    }
  }

  const container = buildContainerInfo(resolvedRange.startContainer);
  if (container) anchor.container = container;

  return { anchor, range: resolvedRange };
}

/** Whitespace-normalizes an arbitrary string the same way the index does —
 *  used to check a live `Range`'s text against a stored `exact`. */
export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
