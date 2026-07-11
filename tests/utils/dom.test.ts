// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isEligibleElement,
  getDeepestEligibleElement,
  getElementPosition,
  scrollToElement,
} from '@/utils/dom';

describe('isEligibleElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns false for body', () => {
    expect(isEligibleElement(document.body)).toBe(false);
  });

  it('returns false for html', () => {
    expect(isEligibleElement(document.documentElement)).toBe(false);
  });

  it('returns false for script', () => {
    const el = document.createElement('script');
    expect(isEligibleElement(el)).toBe(false);
  });

  it('returns false for style', () => {
    const el = document.createElement('style');
    expect(isEligibleElement(el)).toBe(false);
  });

  it('returns false for svg', () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    expect(isEligibleElement(el)).toBe(false);
  });

  it('returns false for noscript', () => {
    const el = document.createElement('noscript');
    expect(isEligibleElement(el)).toBe(false);
  });

  it('returns true for div', () => {
    const el = document.createElement('div');
    expect(isEligibleElement(el)).toBe(true);
  });

  it('returns true for p', () => {
    const el = document.createElement('p');
    expect(isEligibleElement(el)).toBe(true);
  });

  it('returns true for span', () => {
    const el = document.createElement('span');
    expect(isEligibleElement(el)).toBe(true);
  });

  it('returns true for a', () => {
    const el = document.createElement('a');
    expect(isEligibleElement(el)).toBe(true);
  });

  it('returns true for h1', () => {
    const el = document.createElement('h1');
    expect(isEligibleElement(el)).toBe(true);
  });
});

describe('getDeepestEligibleElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns element itself if already eligible', () => {
    document.body.innerHTML = '<div><p><span>text</span></p></div>';
    const span = document.querySelector('span')!;
    expect(getDeepestEligibleElement(span)).toBe(span);
  });

  it('walks up from ineligible child to eligible parent', () => {
    document.body.innerHTML = '<div><script>var x=1;</script></div>';
    const script = document.querySelector('script')!;
    const result = getDeepestEligibleElement(script);
    expect(result).toBe(document.querySelector('div'));
  });

  it('returns document.body if nothing eligible found', () => {
    document.body.innerHTML = '';
    expect(getDeepestEligibleElement(document.body)).toBe(document.body);
  });
});

describe('getElementPosition', () => {
  it('returns all six properties from rect', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({
      top: 10,
      left: 20,
      right: 120,
      bottom: 60,
      width: 100,
      height: 50,
      x: 20,
      y: 10,
      toJSON: () => {},
    });
    const pos = getElementPosition(el);
    expect(pos).toEqual({ top: 10, left: 20, right: 120, bottom: 60, width: 100, height: 50 });
  });
});

describe('scrollToElement', () => {
  it('calls scrollIntoView with smooth and center', () => {
    const el = document.createElement('div');
    const spy = vi.fn();
    el.scrollIntoView = spy;
    scrollToElement(el);
    expect(spy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });
});
