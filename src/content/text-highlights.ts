import type { HostTheme } from '@/content/theme';

/**
 * Painting contextual-note highlights on the host page.
 *
 * Uses the CSS Custom Highlight API (`CSS.highlights` + `::highlight()`),
 * not wrapped `<mark>` elements. That choice is the whole reason this
 * feature can claim not to disturb the page: nothing is inserted, moved, or
 * split, so no framework's virtual DOM is invalidated, no event handler is
 * detached, no link or button is covered, and there is nothing to "clean
 * up" beyond dropping a registration. Ranges that cross nested inline
 * elements work for free, and so do overlapping highlights from two notes
 * over the same words.
 *
 * Where the API is missing entirely, every function here degrades to a
 * no-op: contextual notes are still created, stored, restored, hovered and
 * opened — they simply aren't tinted. No caller has to check first.
 *
 * The one thing it costs: highlight ranges have no DOM node, so they can't
 * be hovered or clicked directly. Hit-testing happens against
 * `range.getClientRects()` instead (see `text-selection.ts`), which is the
 * same coordinate-proximity approach the video timeline markers already use
 * for their own reasons.
 */

const HIGHLIGHT_NAME = 'hamesh-text';
const FLASH_NAME = 'hamesh-text-flash';
const STYLE_ID = 'hamesh-text-highlight-styles';

/** Set on `<html>` only while the pointer is actually over a highlight, so
 *  the rule below is inert the rest of the time. */
const HOVER_ATTRIBUTE = 'data-hamesh-text-hover';

/** Minimal structural view of the API — `Highlight`/`CSS.highlights` aren't
 *  in this project's TS DOM lib yet, and declaring the slice actually used
 *  keeps that contained to this module instead of a global shim. */
interface HighlightLike {
  add(range: Range): void;
  clear(): void;
  priority: number;
}
type HighlightConstructor = new (...ranges: Range[]) => HighlightLike;
interface HighlightRegistry {
  set(name: string, highlight: HighlightLike): void;
  delete(name: string): boolean;
}

function registry(): HighlightRegistry | null {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  return css?.highlights ?? null;
}

function highlightConstructor(): HighlightConstructor | null {
  return (globalThis as { Highlight?: HighlightConstructor }).Highlight ?? null;
}

/**
 * `::highlight()` rules have to live in a stylesheet that applies to the
 * highlighted text, i.e. the host page's own document — a rule inside
 * Hamesh's shadow root would never reach it. This is the only mark Hamesh
 * leaves on the page's DOM: a single `<style>` element, rewritten in place
 * when the theme changes and removed on teardown.
 *
 * Colors are the brand accent at low alpha (plus an accent underline) so a
 * highlight reads as an annotation sitting *in* the page rather than as a
 * stuck browser text selection.
 */
export function ensureHighlightStyles(theme: HostTheme): void {
  if (typeof document === 'undefined' || !document.head) return;
  // Light: --hm-accent #b5502f. Dark: --hm-accent #e08b5c (see tokens.css).
  const accent = theme === 'dark' ? '224, 139, 92' : '181, 80, 47';
  const css = [
    `::highlight(${HIGHLIGHT_NAME}) {`,
    `  background-color: rgba(${accent}, ${theme === 'dark' ? '0.30' : '0.28'});`,
    `  text-decoration: underline;`,
    `  text-decoration-color: rgba(${accent}, 0.85);`,
    `  text-decoration-thickness: 1px;`,
    `  text-underline-offset: 2px;`,
    `}`,
    `::highlight(${FLASH_NAME}) {`,
    `  background-color: rgba(${accent}, ${theme === 'dark' ? '0.55' : '0.45'});`,
    `  text-decoration: underline;`,
    `  text-decoration-color: rgba(${accent}, 1);`,
    `  text-decoration-thickness: 2px;`,
    `  text-underline-offset: 2px;`,
    `}`,
    // Highlighted text opens its note when clicked, so the pointer should
    // look like it. `::highlight()` supports no such property (its allowed
    // properties are colors and decorations only), and a highlight has no
    // element to target — so the cursor is switched at the document level
    // while the pointer is over one, and only then. `!important` and the
    // descendant `*` are what let it win against a page's own `cursor`
    // rule on the element under the pointer.
    `html[${HOVER_ATTRIBUTE}], html[${HOVER_ATTRIBUTE}] * {`,
    `  cursor: pointer !important;`,
    `}`,
  ].join('\n');

  const existing = document.getElementById(STYLE_ID);
  if (existing) {
    if (existing.textContent !== css) existing.textContent = css;
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.setAttribute('data-hamesh', 'text-highlight-styles');
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Replaces what is currently painted. Idempotent by construction — the
 * registration is rebuilt from the given ranges every time rather than
 * diffed, so a repaint can never leave a stale highlight behind, and
 * clearing is just painting nothing.
 *
 * `flashRanges` are painted more strongly on top (higher priority) — used
 * by the Notes Library's Open Note flow to say "here it is" for a moment.
 */
export function paintTextHighlights(ranges: Range[], flashRanges: Range[] = []): void {
  const highlights = registry();
  const Ctor = highlightConstructor();
  if (!highlights || !Ctor) return;

  if (ranges.length === 0) highlights.delete(HIGHLIGHT_NAME);
  else {
    const highlight = new Ctor(...ranges);
    highlight.priority = 1;
    highlights.set(HIGHLIGHT_NAME, highlight);
  }

  if (flashRanges.length === 0) highlights.delete(FLASH_NAME);
  else {
    const flash = new Ctor(...flashRanges);
    flash.priority = 2;
    highlights.set(FLASH_NAME, flash);
  }
}

/** Switches the pointer cursor over highlighted text on and off. Idempotent
 *  — safe to call on every pointer frame, which is exactly how it's used. */
export function setTextHoverCursor(active: boolean): void {
  const root = document.documentElement;
  if (!root) return;
  if (active) {
    if (!root.hasAttribute(HOVER_ATTRIBUTE)) root.setAttribute(HOVER_ATTRIBUTE, '');
  } else if (root.hasAttribute(HOVER_ATTRIBUTE)) {
    root.removeAttribute(HOVER_ATTRIBUTE);
  }
}

/** Drops every Hamesh highlight, the hover-cursor attribute, and the
 *  injected stylesheet, leaving the page exactly as it was found. */
export function clearTextHighlights(): void {
  const highlights = registry();
  highlights?.delete(HIGHLIGHT_NAME);
  highlights?.delete(FLASH_NAME);
  setTextHoverCursor(false);
  document.getElementById(STYLE_ID)?.remove();
}
