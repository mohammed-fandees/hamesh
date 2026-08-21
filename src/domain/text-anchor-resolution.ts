import type { TextAnchor } from './note';
import { ResolutionQuality } from './anchor-resolution';
import {
  buildTextIndex,
  directTextPosition,
  domPointForOffset,
  elementAtPath,
  normalizeText,
  rangeForSpan,
  type TextIndex,
} from './text-anchor';

/**
 * Anything below this and a match is refused outright. Context similarity is
 * the primary signal — a stored prefix/suffix that no longer looks anything
 * like what surrounds a candidate means this probably isn't the same text,
 * however well the characters themselves line up.
 */
const MIN_CONTEXT_SCORE = 0.34;

/** With more than one candidate, the winner must beat the runner-up by this
 *  much *and* clear `MIN_AMBIGUOUS_CONTEXT`. Anything closer is treated as
 *  genuinely ambiguous and resolves to nothing — never to "the first one". */
const AMBIGUITY_MARGIN = 0.15;
const MIN_AMBIGUOUS_CONTEXT = 0.5;

/** A selection at least this long is distinctive enough to accept as the
 *  sole occurrence on the page even if the surrounding text has changed
 *  completely (a re-worded paragraph around an intact quote). Shorter
 *  selections — a word, a number — must still clear `MIN_CONTEXT_SCORE`. */
const DISTINCTIVE_LENGTH = 24;

/** Position agreement is only ever a tiebreak, hence the small weight. The
 *  tolerance scales with the page so a long document doesn't punish text
 *  that merely moved a few paragraphs. */
const POSITION_WEIGHT = 0.15;
const CONTEXT_WEIGHT = 1 - POSITION_WEIGHT;
const MIN_POSITION_TOLERANCE = 500;

/** Added to a candidate's total when it sits inside the anchor's original
 *  container — enough to settle an otherwise close call between two
 *  identical strings in different regions of the page, not enough to rescue
 *  a candidate whose context is plainly wrong. */
const CONTAINER_BONUS = 0.25;

export interface TextResolution {
  quality: ResolutionQuality;
  /** A live range over the anchored text, or `null` when it could not be
   *  identified with enough confidence. `null` never means the note is
   *  gone — only that it has no location on this page right now. */
  range: Range | null;
}

const UNRESOLVED: TextResolution = { quality: ResolutionQuality.Unresolved, range: null };

/** Length of the longest common suffix of two strings, capped by both. */
function commonSuffixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

/** Length of the longest common prefix of two strings. */
function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** How well the text immediately around `start`/`end` matches the context
 *  captured with the anchor: 1 when both sides are identical, 0 when neither
 *  shares a single character. An empty stored side is neutral (it was
 *  captured at the very start/end of the document). */
export function contextScore(pageText: string, start: number, end: number, anchor: TextAnchor) {
  const { prefix, suffix } = anchor.context;

  const actualPrefix = pageText.slice(Math.max(0, start - prefix.length), start);
  const actualSuffix = pageText.slice(end, end + suffix.length);

  const prefixScore =
    prefix.length === 0 ? 1 : commonSuffixLength(prefix, actualPrefix) / prefix.length;
  const suffixScore =
    suffix.length === 0 ? 1 : commonPrefixLength(suffix, actualSuffix) / suffix.length;

  return (prefixScore + suffixScore) / 2;
}

/** How close a candidate sits to where the text used to be, 0…1. */
export function positionScore(pageTextLength: number, start: number, anchor: TextAnchor): number {
  const tolerance = Math.max(MIN_POSITION_TOLERANCE, pageTextLength * 0.1);
  const drift = Math.abs(start - anchor.textPosition.start);
  return Math.max(0, 1 - drift / tolerance);
}

interface Candidate {
  start: number;
  end: number;
  context: number;
  total: number;
}

/** Every occurrence of `exact` in the page's normalized text. Deliberately
 *  exhaustive: knowing there are three is what makes refusing to guess
 *  possible. */
function findOccurrences(pageText: string, exact: string): number[] {
  const found: number[] = [];
  if (!exact) return found;
  let from = 0;
  for (;;) {
    const at = pageText.indexOf(exact, from);
    if (at === -1) break;
    found.push(at);
    from = at + 1;
  }
  return found;
}

function resolveContainer(anchor: TextAnchor, root: Element): Element | null {
  const container = anchor.container;
  if (!container) return null;
  if (container.selector) {
    try {
      const bySelector = document.querySelector(container.selector);
      if (bySelector) return bySelector;
    } catch {
      /* a selector captured against a since-changed DOM may be invalid */
    }
  }
  if (container.path) return elementAtPath(container.path, root);
  return null;
}

/**
 * Layer 1 + 2 — the fast path. Follows the stored element paths and direct
 * text offsets straight to a range, then *validates* that the range's text
 * is still the anchored text. Costs two short DOM walks and one string
 * compare, and never touches a page-wide index, so this is what the common
 * case (a page that simply reloaded) pays.
 */
function resolveByPath(anchor: TextAnchor, root: Element): Range | null {
  const path = anchor.path;
  if (!path) return null;

  const startEl = elementAtPath(path.startPath, root);
  const endEl = elementAtPath(path.endPath, root);
  if (!startEl || !endEl) return null;

  const startPoint = directTextPosition(startEl, path.startOffset);
  const endPoint = directTextPosition(endEl, path.endOffset);
  if (!startPoint || !endPoint) return null;

  try {
    const range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    if (range.collapsed) return null;
    return normalizeText(range.toString()) === anchor.exact ? range : null;
  } catch {
    return null;
  }
}

/**
 * Layers 3–7 — recovery. Scores every occurrence of the exact text by
 * context, original position, and whether it still lives inside the original
 * container, then hands back the winner only when it is clearly the winner.
 *
 * Exported for its own tests: this is the function that must never guess.
 */
export function resolveByContext(anchor: TextAnchor, index: TextIndex): TextResolution {
  const occurrences = findOccurrences(index.text, anchor.exact);
  if (occurrences.length === 0) return UNRESOLVED;

  const container = index.root instanceof Element ? resolveContainer(anchor, index.root) : null;

  const candidates: Candidate[] = occurrences.map((start) => {
    const end = start + anchor.exact.length;
    const context = contextScore(index.text, start, end, anchor);
    let total =
      context * CONTEXT_WEIGHT + positionScore(index.text.length, start, anchor) * POSITION_WEIGHT;
    if (container) {
      const point = domPointForOffset(index, start);
      if (point && container.contains(point.node)) total += CONTAINER_BONUS;
    }
    return { start, end, context, total };
  });

  candidates.sort((a, b) => b.total - a.total);
  const best = candidates[0];

  if (candidates.length > 1) {
    const runnerUp = candidates[1];
    // Ambiguity protection. Two occurrences that look equally plausible are
    // not a 50/50 bet worth taking — the note keeps its data and simply has
    // no location on this page right now.
    if (best.total - runnerUp.total < AMBIGUITY_MARGIN) return UNRESOLVED;
    if (best.context < MIN_AMBIGUOUS_CONTEXT) return UNRESOLVED;
  } else if (best.context < MIN_CONTEXT_SCORE && anchor.exact.length < DISTINCTIVE_LENGTH) {
    // A single short match with unrecognizable surroundings is far more
    // likely to be a different sentence that happens to share a word.
    return UNRESOLVED;
  }

  const range = rangeForSpan(index, best.start, best.end);
  if (!range) return UNRESOLVED;
  return { quality: ResolutionQuality.Probable, range };
}

/** A range that is still attached to the document and still covers exactly
 *  the anchored text. Revalidating one of these is the cheapest possible
 *  outcome of a resolution pass — no walks, no index, one string compare. */
function isStillValid(range: Range | null | undefined, anchor: TextAnchor): range is Range {
  if (!range) return false;
  try {
    const container = range.commonAncestorContainer;
    if (!container.isConnected) return false;
    return normalizeText(range.toString()) === anchor.exact;
  } catch {
    return false;
  }
}

export interface TextResolutionRequest {
  id: string;
  anchor: TextAnchor;
  /** The range this note resolved to last pass, if any. */
  previous?: Range | null;
}

export interface TextResolutionOptions {
  root?: Element;
  /** Injected by tests; production always builds from the live DOM. */
  buildIndex?: (root: Element) => TextIndex;
}

/**
 * Resolves a batch of text anchors against the current DOM.
 *
 * Batched on purpose. The expensive part of recovery is building one
 * normalized index of the page's text, so it is built lazily — only if at
 * least one anchor fails both revalidation and the fast path — and then
 * shared by every anchor that needs it. A page whose DOM hasn't meaningfully
 * changed resolves every note without building an index at all.
 */
export function resolveTextAnchors(
  requests: TextResolutionRequest[],
  options: TextResolutionOptions = {},
): Map<string, TextResolution> {
  const results = new Map<string, TextResolution>();
  if (requests.length === 0) return results;

  const root = options.root ?? document.body;
  if (!root) {
    for (const request of requests) results.set(request.id, UNRESOLVED);
    return results;
  }

  const needsIndex: TextResolutionRequest[] = [];

  for (const request of requests) {
    if (isStillValid(request.previous, request.anchor)) {
      results.set(request.id, { quality: ResolutionQuality.Exact, range: request.previous });
      continue;
    }
    const byPath = resolveByPath(request.anchor, root);
    if (byPath) {
      results.set(request.id, { quality: ResolutionQuality.Exact, range: byPath });
      continue;
    }
    needsIndex.push(request);
  }

  if (needsIndex.length > 0) {
    const index = options.buildIndex ? options.buildIndex(root) : buildTextIndex(root);
    for (const request of needsIndex) {
      results.set(request.id, resolveByContext(request.anchor, index));
    }
  }

  return results;
}

/** Single-anchor convenience wrapper — the batch form is what the content
 *  script uses. */
export function resolveTextAnchor(
  anchor: TextAnchor,
  options: TextResolutionOptions = {},
): TextResolution {
  return resolveTextAnchors([{ id: 'single', anchor }], options).get('single') ?? UNRESOLVED;
}
