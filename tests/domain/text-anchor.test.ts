// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildTextAnchor,
  buildTextIndex,
  directTextOffset,
  directTextPosition,
  elementAtPath,
  elementPath,
  normalizeText,
  rangeForSpan,
  MAX_EXACT_LENGTH,
} from '@/domain/text-anchor';

/** Builds a range over the `occurrence`-th appearance of `needle` inside a
 *  single text node, the way a user dragging over those words would. */
function rangeOverText(node: Text, needle: string, occurrence = 0): Range {
  let index = -1;
  for (let i = 0; i <= occurrence; i++) index = node.data.indexOf(needle, index + 1);
  if (index === -1) throw new Error(`"${needle}" not found in "${node.data}"`);
  const range = document.createRange();
  range.setStart(node, index);
  range.setEnd(node, index + needle.length);
  return range;
}

function firstText(selector: string): Text {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`no element for ${selector}`);
  const node = el.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) throw new Error(`no text in ${selector}`);
  return node as Text;
}

describe('normalizeText', () => {
  it('collapses whitespace runs and trims', () => {
    expect(normalizeText('  a \n\t b  ')).toBe('a b');
  });
});

describe('buildTextIndex', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('joins inline elements without a separator and blocks with one', () => {
    document.body.innerHTML = '<p>Hel<b>lo</b> there</p><p>Next block</p>';
    expect(buildTextIndex(document.body).text).toBe('Hello there Next block');
  });

  it('collapses newlines and indentation from formatted markup', () => {
    document.body.innerHTML = `
      <p>
        Performance   is
        important
      </p>
    `;
    // Interior runs collapse to one space; the trailing run collapses to a
    // single space too rather than disappearing — anchors trim their own
    // boundaries (see the trimming test below), so it never reaches `exact`.
    expect(buildTextIndex(document.body).text).toBe('Performance is important ');
  });

  it('treats a <br> as a boundary', () => {
    document.body.innerHTML = '<p>one<br>two</p>';
    expect(buildTextIndex(document.body).text).toBe('one two');
  });

  it('skips script, style and form-field text', () => {
    document.body.innerHTML =
      '<p>real</p><script>var hidden = 1;</script><style>.x{}</style><textarea>typed</textarea>';
    expect(buildTextIndex(document.body).text).toBe('real');
  });

  it("skips Hamesh's own injected elements", () => {
    document.body.innerHTML = '<p>real</p><hamesh-ui>chrome</hamesh-ui>';
    expect(buildTextIndex(document.body).text).toBe('real');
  });

  it('maps a span back to the exact DOM range it came from', () => {
    document.body.innerHTML = '<p>Alpha <b>beta</b> gamma</p>';
    const index = buildTextIndex(document.body);
    const start = index.text.indexOf('beta');
    const range = rangeForSpan(index, start, start + 4);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe('beta');
  });
});

describe('elementPath / elementAtPath', () => {
  it('round-trips a nested element', () => {
    document.body.innerHTML = '<div><section><p>a</p><p id="target">b</p></section></div>';
    const target = document.getElementById('target')!;
    const path = elementPath(target, document.body);
    expect(path).toEqual([0, 0, 1]);
    expect(elementAtPath(path!, document.body)).toBe(target);
  });

  it('returns null for an element outside the root', () => {
    document.body.innerHTML = '<p>in</p>';
    const detached = document.createElement('p');
    expect(elementPath(detached, document.body)).toBeNull();
  });

  it('returns null when the path no longer leads anywhere', () => {
    document.body.innerHTML = '<div><p>a</p></div>';
    expect(elementAtPath([0, 5], document.body)).toBeNull();
  });
});

describe('directTextOffset / directTextPosition', () => {
  it("addresses a position by the parent's own concatenated text", () => {
    document.body.innerHTML = '<p>Alpha <b>beta</b> gamma</p>';
    const p = document.querySelector('p')!;
    const tail = p.lastChild as Text; // " gamma"
    // "Alpha " (6) + " gamma" — offset 2 into the tail is 8 overall.
    expect(directTextOffset(tail, 2)).toBe(8);
    const back = directTextPosition(p, 8);
    expect(back?.node).toBe(tail);
    expect(back?.offset).toBe(2);
  });

  it('survives the text node being split in two', () => {
    document.body.innerHTML = '<p>Alpha beta</p>';
    const p = document.querySelector('p')!;
    const original = p.firstChild as Text;
    const offset = directTextOffset(original, 8);
    expect(offset).toBe(8);
    original.splitText(3); // what a framework re-render does
    const back = directTextPosition(p, offset!);
    expect(back).not.toBeNull();
    const range = document.createRange();
    range.setStart(back!.node, back!.offset);
    range.setEnd(p, p.childNodes.length);
    expect(range.toString()).toBe('ta');
  });
});

describe('buildTextAnchor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('captures the exact text, its context, and its position', () => {
    document.body.innerHTML =
      '<article id="post"><p>Performance is extremely important in large applications. It matters.</p></article>';
    const text = firstText('#post p');
    const built = buildTextAnchor(rangeOverText(text, 'extremely important'));

    expect(built).not.toBeNull();
    const anchor = built!.anchor;
    expect(anchor.type).toBe('text');
    expect(anchor.version).toBe(1);
    expect(anchor.exact).toBe('extremely important');
    expect(anchor.context.prefix.endsWith('Performance is ')).toBe(true);
    expect(anchor.context.suffix.startsWith(' in large applications.')).toBe(true);
    expect(anchor.textPosition.start).toBe('Performance is '.length);
    expect(anchor.textPosition.end).toBe(anchor.textPosition.start + anchor.exact.length);
    expect(built!.range.toString()).toBe('extremely important');
  });

  it('records DOM paths and offsets for the fast restoration path', () => {
    document.body.innerHTML = '<div><p>first</p><p>the target words here</p></div>';
    const text = firstText('div p:nth-of-type(2)');
    const anchor = buildTextAnchor(rangeOverText(text, 'target words'))!.anchor;

    expect(anchor.path).toBeDefined();
    expect(anchor.path!.startPath).toEqual([0, 1]);
    expect(anchor.path!.startOffset).toBe('the '.length);
    expect(anchor.path!.endOffset).toBe('the target words'.length);
  });

  it('records the nearest identified ancestor as the container', () => {
    document.body.innerHTML =
      '<main><section id="body-copy"><p>some target text</p></section></main>';
    const anchor = buildTextAnchor(rangeOverText(firstText('#body-copy p'), 'target'))!.anchor;
    expect(anchor.container?.selector).toContain('#body-copy');
  });

  it('captures a selection spanning nested inline elements', () => {
    document.body.innerHTML = '<p>Read the <b>bold <i>and italic</i></b> parts now</p>';
    const p = document.querySelector('p')!;
    const range = document.createRange();
    range.setStart(p.firstChild!, 'Read the '.length);
    range.setEnd(p.lastChild!, ' parts'.length);

    const built = buildTextAnchor(range);
    expect(built).not.toBeNull();
    expect(built!.anchor.exact).toBe('bold and italic parts');
    expect(built!.range.toString()).toContain('bold');
  });

  it('trims a selection that swept up surrounding whitespace', () => {
    document.body.innerHTML = '<p>alpha beta gamma</p>';
    const text = firstText('p');
    const range = document.createRange();
    range.setStart(text, 'alpha'.length); // starts on the space
    range.setEnd(text, 'alpha beta '.length); // ends on a space
    const built = buildTextAnchor(range);
    expect(built!.anchor.exact).toBe('beta');
    expect(built!.range.toString()).toBe('beta');
  });

  it('returns null for a whitespace-only selection', () => {
    document.body.innerHTML = '<p>alpha beta</p>';
    const text = firstText('p');
    const range = document.createRange();
    range.setStart(text, 'alpha'.length);
    range.setEnd(text, 'alpha '.length);
    expect(buildTextAnchor(range)).toBeNull();
  });

  it('refuses a selection larger than the supported maximum', () => {
    const huge = 'word '.repeat(MAX_EXACT_LENGTH / 2);
    document.body.innerHTML = `<p>${huge}</p>`;
    const text = firstText('p');
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, text.data.length);
    expect(buildTextAnchor(range)).toBeNull();
  });

  it('returns null for a range that covers no indexed text', () => {
    document.body.innerHTML = '<p>visible</p><script>var x = 1;</script>';
    const script = document.querySelector('script')!;
    const range = document.createRange();
    range.selectNodeContents(script);
    expect(buildTextAnchor(range)).toBeNull();
  });
});
