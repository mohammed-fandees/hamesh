/**
 * The heading a note is written under, read from the page once, when the
 * note is saved (see `NoteCapture`). An export uses it to group notes around
 * the parts of a page.
 *
 * The page title (an h1, or an aria heading of level 1) is never a section:
 * notes in an article's introduction belong to the page, not to a part of it.
 */

const HEADINGS = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

function headingLevel(el: Element): number {
  const tag = /^H([1-6])$/.exec(el.tagName);
  if (tag) return Number(tag[1]);
  const aria = Number(el.getAttribute('aria-level'));
  return Number.isInteger(aria) && aria > 0 ? aria : 2;
}

function isHidden(el: Element): boolean {
  return !!el.closest('[hidden], [aria-hidden="true"]');
}

/** Docs sites append a "#" or "¶" link to every heading; it is not part of the name. */
function headingText(el: Element): string {
  return (el.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[#¶§🔗]+$/u, '')
    .trim();
}

function precedesOrContains(heading: Element, node: Node): boolean {
  if (heading.contains(node)) return true;
  return !!(heading.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
}

export function sectionHeadingFor(node: Node): string | undefined {
  const doc = node.ownerDocument ?? document;
  let nearest: Element | null = null;
  for (const heading of doc.querySelectorAll(HEADINGS)) {
    if (!precedesOrContains(heading, node)) break;
    if (!isHidden(heading) && headingText(heading)) nearest = heading;
  }
  if (!nearest || headingLevel(nearest) <= 1) return undefined;
  return headingText(nearest);
}
