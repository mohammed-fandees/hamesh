// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  captureTextSelection,
  isAnchorableRange,
  rectsContainPoint,
} from '@/content/text-selection';
import { MAX_EXACT_LENGTH } from '@/domain/text-anchor';

function selectWithin(selector: string, start: number, end: number): Range {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`no element for ${selector}`);
  const text = el.firstChild as Text;
  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(text, end);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return range;
}

describe('isAnchorableRange', () => {
  beforeEach(() => {
    document.body.innerHTML = '<p id="copy">Some ordinary page text</p>';
  });

  it('accepts an ordinary text selection', () => {
    expect(isAnchorableRange(selectWithin('#copy', 5, 13))).toBe(true);
  });

  it('rejects a collapsed selection', () => {
    expect(isAnchorableRange(selectWithin('#copy', 5, 5))).toBe(false);
  });

  it('rejects a whitespace-only selection', () => {
    expect(isAnchorableRange(selectWithin('#copy', 4, 5))).toBe(false);
  });

  it('rejects a selection inside editable content', () => {
    document.body.innerHTML = '<div contenteditable="true"><p id="copy">typed text here</p></div>';
    // jsdom derives isContentEditable from the attribute only via the
    // property, so assert against the real check the same way Chrome would.
    const editable = document.querySelector('[contenteditable]') as HTMLElement;
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isAnchorableRange(selectWithin('#copy', 0, 5))).toBe(false);
  });

  it("rejects a selection inside Hamesh's own UI", () => {
    document.body.innerHTML = '<hamesh-ui><p id="copy">Hamesh chrome text</p></hamesh-ui>';
    const host = document.querySelector('hamesh-ui');
    expect(isAnchorableRange(selectWithin('#copy', 0, 6), host)).toBe(false);
  });

  it('rejects a selection larger than the supported maximum', () => {
    const long = 'word '.repeat(MAX_EXACT_LENGTH);
    document.body.innerHTML = `<p id="copy">${long}</p>`;
    expect(isAnchorableRange(selectWithin('#copy', 0, long.length))).toBe(false);
  });

  it('rejects a detached range', () => {
    const detached = document.createElement('p');
    detached.textContent = 'orphan text';
    const range = document.createRange();
    range.selectNodeContents(detached);
    expect(isAnchorableRange(range)).toBe(false);
  });
});

describe('captureTextSelection', () => {
  beforeEach(() => {
    document.body.innerHTML = '<p id="copy">Some ordinary page text</p>';
  });

  it('returns null when nothing is selected', () => {
    window.getSelection()!.removeAllRanges();
    expect(captureTextSelection()).toBeNull();
  });

  it('captures the normalized text and a range that outlives the selection', () => {
    selectWithin('#copy', 5, 13);
    const capture = captureTextSelection();
    expect(capture?.text).toBe('ordinary');

    // What happens when the user clicks the action chip: focus moves and the
    // live selection is gone. The capture must be unaffected.
    window.getSelection()!.removeAllRanges();
    expect(capture!.range.toString()).toBe('ordinary');
  });

  it('is not confused by a later selection replacing the first', () => {
    selectWithin('#copy', 5, 13);
    const first = captureTextSelection();
    selectWithin('#copy', 14, 18);
    const second = captureTextSelection();

    expect(first?.text).toBe('ordinary');
    expect(second?.text).toBe('page');
    expect(first!.range.toString()).toBe('ordinary');
  });
});

describe('rectsContainPoint', () => {
  const rect = { left: 10, top: 10, right: 60, bottom: 30 } as DOMRect;

  it('hits inside a rect', () => {
    expect(rectsContainPoint([rect], 30, 20)).toBe(true);
  });

  it('misses outside every rect', () => {
    expect(rectsContainPoint([rect], 200, 200)).toBe(false);
  });

  it('allows a small tolerance around the edge', () => {
    expect(rectsContainPoint([rect], 61, 31)).toBe(true);
    expect(rectsContainPoint([rect], 70, 31)).toBe(false);
  });
});
