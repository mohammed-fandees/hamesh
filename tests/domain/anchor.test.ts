// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';

describe('collectAnchorSignals', () => {
  let collectAnchorSignals: typeof import('@/domain/anchor').collectAnchorSignals;

  beforeEach(async () => {
    const mod = await import('@/domain/anchor');
    collectAnchorSignals = mod.collectAnchorSignals;
  });

  function el(html: string): Element {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.firstElementChild!;
  }

  it('captures tagName lowercased', () => {
    const signals = collectAnchorSignals(el('<DIV></DIV>'));
    expect(signals.tagName).toBe('div');
  });

  it('captures aria-label when present', () => {
    const signals = collectAnchorSignals(el('<button aria-label="Submit"></button>'));
    expect(signals.ariaLabel).toBe('Submit');
  });

  it('omits aria-label when absent', () => {
    const signals = collectAnchorSignals(el('<div></div>'));
    expect(signals.ariaLabel).toBeUndefined();
  });

  it('captures data-testid', () => {
    const signals = collectAnchorSignals(el('<div data-testid="hero"></div>'));
    expect(signals.testId).toBe('hero');
  });

  it('captures data-test-id fallback', () => {
    const signals = collectAnchorSignals(el('<div data-test-id="x"></div>'));
    expect(signals.testId).toBe('x');
  });

  it('captures data-test fallback', () => {
    const signals = collectAnchorSignals(el('<div data-test="y"></div>'));
    expect(signals.testId).toBe('y');
  });

  it('captures id attribute', () => {
    const signals = collectAnchorSignals(el('<div id="main"></div>'));
    expect(signals.id).toBe('main');
  });

  it('captures textSnippet trimmed and sliced to 200 chars', () => {
    const long = 'A'.repeat(300);
    const signals = collectAnchorSignals(el(`<p>${long}</p>`));
    expect(signals.textSnippet).toBe('A'.repeat(200));
  });

  it('omits textSnippet when empty', () => {
    const signals = collectAnchorSignals(el('<p></p>'));
    expect(signals.textSnippet).toBeUndefined();
  });

  it('captures classNames', () => {
    const signals = collectAnchorSignals(el('<div class="foo bar"></div>'));
    expect(signals.classNames).toBe('foo bar');
  });

  it('captures href', () => {
    const signals = collectAnchorSignals(el('<a href="/about">Link</a>'));
    expect(signals.href).toBe('/about');
  });

  it('captures src', () => {
    const signals = collectAnchorSignals(el('<img src="/logo.png" />'));
    expect(signals.src).toBe('/logo.png');
  });

  it('captures alt', () => {
    const signals = collectAnchorSignals(el('<img alt="Logo" />'));
    expect(signals.alt).toBe('Logo');
  });

  it('captures role', () => {
    const signals = collectAnchorSignals(el('<div role="button"></div>'));
    expect(signals.role).toBe('button');
  });

  it('captures custom data-* attributes in dataAttributes', () => {
    const signals = collectAnchorSignals(el('<div data-color="red" data-size="large"></div>'));
    expect(signals.dataAttributes).toEqual({ 'data-color': 'red', 'data-size': 'large' });
  });

  it('excludes data-testid from dataAttributes', () => {
    const signals = collectAnchorSignals(el('<div data-testid="x" data-color="red"></div>'));
    expect(signals.dataAttributes).toEqual({ 'data-color': 'red' });
  });

  it('omits dataAttributes when none present', () => {
    const signals = collectAnchorSignals(el('<div></div>'));
    expect(signals.dataAttributes).toBeUndefined();
  });
});

describe('generateCssSelector', () => {
  let generateCssSelector: typeof import('@/domain/anchor').generateCssSelector;

  beforeEach(async () => {
    document.body.innerHTML = '';
    if (typeof CSS === 'undefined' || !CSS.escape) {
      (globalThis as any).CSS = { escape: (s: string) => s.replace(/([^\w-])/g, '\\$1') };
    }
    const mod = await import('@/domain/anchor');
    generateCssSelector = mod.generateCssSelector;
  });

  it('returns #id when element has a unique id', () => {
    document.body.innerHTML = '<div id="unique"><span></span></div>';
    const span = document.querySelector('span')!;
    const selector = generateCssSelector(span);
    expect(selector).toBe('#unique > span');
  });

  it('uses nth-of-type when siblings share tag', () => {
    document.body.innerHTML = '<div><p>first</p><p>second</p></div>';
    const ps = document.querySelectorAll('p');
    const selector = generateCssSelector(ps[1]);
    expect(selector).toBe('div > p:nth-of-type(2)');
  });

  it('omits nth-of-type when element is only child of its tag', () => {
    document.body.innerHTML = '<div><span>only</span></div>';
    const span = document.querySelector('span')!;
    const selector = generateCssSelector(span);
    expect(selector).toBe('div > span');
  });

  it('stops at document.body', () => {
    document.body.innerHTML = '<div></div>';
    const div = document.querySelector('div')!;
    const selector = generateCssSelector(div);
    expect(selector).toBe('div');
  });
});

describe('buildElementAnchor', () => {
  let buildElementAnchor: typeof import('@/domain/anchor').buildElementAnchor;

  beforeEach(async () => {
    document.body.innerHTML = '';
    if (typeof CSS === 'undefined' || !CSS.escape) {
      (globalThis as any).CSS = { escape: (s: string) => s.replace(/([^\w-])/g, '\\$1') };
    }
    const mod = await import('@/domain/anchor');
    buildElementAnchor = mod.buildElementAnchor;
  });

  it('returns primarySelector, signals, and fallbackDocumentPosition', () => {
    document.body.innerHTML = '<div id="test" class="hero"><p>Hello</p></div>';
    const p = document.querySelector('p')!;
    p.getBoundingClientRect = () => ({
      top: 100,
      left: 50,
      right: 250,
      bottom: 130,
      width: 200,
      height: 30,
      x: 50,
      y: 100,
      toJSON: () => {},
    });
    Object.defineProperty(window, 'scrollX', { value: 0, writable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });

    const anchor = buildElementAnchor(p);
    expect(anchor.primarySelector).toBe('#test > p');
    expect(anchor.signals.tagName).toBe('p');
    expect(anchor.fallbackDocumentPosition).toEqual({ x: 50, y: 100 });
  });

  it('includes scroll offsets in fallbackDocumentPosition', () => {
    document.body.innerHTML = '<p>Hi</p>';
    const p = document.querySelector('p')!;
    p.getBoundingClientRect = () => ({
      top: 50,
      left: 30,
      right: 130,
      bottom: 70,
      width: 100,
      height: 20,
      x: 30,
      y: 50,
      toJSON: () => {},
    });
    Object.defineProperty(window, 'scrollX', { value: 10, writable: true });
    Object.defineProperty(window, 'scrollY', { value: 20, writable: true });

    const anchor = buildElementAnchor(p);
    expect(anchor.fallbackDocumentPosition).toEqual({ x: 40, y: 70 });
  });
});
