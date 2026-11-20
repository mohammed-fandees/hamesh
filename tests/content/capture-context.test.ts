// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { sectionHeadingFor } from '@/content/capture-context';

function mount(html: string): void {
  document.body.innerHTML = html;
}
const byId = (id: string) => document.getElementById(id)!;

describe('sectionHeadingFor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('names the nearest heading above the note', () => {
    mount(`
      <h1>Using the Fetch API</h1>
      <h2>Making a request</h2><p id="a">first</p>
      <h2>Setting headers</h2><section><h3>Headers object</h3><p id="b">second</p></section>`);
    expect(sectionHeadingFor(byId('a'))).toBe('Making a request');
    expect(sectionHeadingFor(byId('b'))).toBe('Headers object');
  });

  it('works from a text node, as a selection gives it', () => {
    mount(`<h2>Caveats</h2><p id="p">The set function only updates the next render.</p>`);
    expect(sectionHeadingFor(byId('p').firstChild!)).toBe('Caveats');
  });

  it('gives nothing in the introduction, where only the page title is above', () => {
    mount(`<h1>Lifecycle of Reactive Effects</h1><p id="p">intro</p><h2>Later</h2>`);
    expect(sectionHeadingFor(byId('p'))).toBeUndefined();
  });

  it('uses the heading itself when the note is on it', () => {
    mount(`<h2 id="h">Caveats <a href="#caveats">#</a></h2>`);
    expect(sectionHeadingFor(byId('h').firstChild!)).toBe('Caveats');
  });

  it('reads aria headings by their level', () => {
    mount(`
      <div role="heading" aria-level="1">Title</div>
      <div role="heading" aria-level="3">Pitfalls</div><p id="p">x</p>`);
    expect(sectionHeadingFor(byId('p'))).toBe('Pitfalls');
  });

  it('skips hidden headings and anchor glyphs', () => {
    mount(`
      <h2>Real section ¶</h2>
      <h2 hidden>Menu</h2>
      <h2 aria-hidden="true">Skip link</h2>
      <p id="p">x</p>`);
    expect(sectionHeadingFor(byId('p'))).toBe('Real section');
  });

  it('gives nothing when the page has no headings at all', () => {
    mount(`<p id="p">x</p>`);
    expect(sectionHeadingFor(byId('p'))).toBeUndefined();
  });
});
