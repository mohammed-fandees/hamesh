// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ResolutionQuality } from '@/domain/anchor-resolution';
import type { TextAnchor } from '@/domain/note';
import { buildTextAnchor } from '@/domain/text-anchor';
import { resolveTextAnchor, resolveTextAnchors } from '@/domain/text-anchor-resolution';

/** Captures an anchor for `needle` exactly the way the content script does,
 *  so every restoration test starts from a real, honestly-built anchor
 *  rather than a hand-written one. */
function anchorFor(html: string, needle: string, occurrence = 0): TextAnchor {
  document.body.innerHTML = html;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let seen = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    let from = 0;
    for (;;) {
      const at = text.data.indexOf(needle, from);
      if (at === -1) break;
      if (seen === occurrence) {
        const range = document.createRange();
        range.setStart(text, at);
        range.setEnd(text, at + needle.length);
        const built = buildTextAnchor(range);
        if (!built) throw new Error('anchor could not be built');
        return built.anchor;
      }
      seen++;
      from = at + 1;
    }
  }
  throw new Error(`"${needle}" occurrence ${occurrence} not found`);
}

/** Replaces the page, as a reload with changed markup would. */
function reload(html: string): void {
  document.body.innerHTML = html;
}

const ARTICLE =
  '<article id="post"><p id="intro">Performance is extremely important in large applications.</p>' +
  '<p id="body">Caching helps, but correctness comes first.</p></article>';

describe('resolveTextAnchor — fast path', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('restores the exact range on an unchanged page', () => {
    const anchor = anchorFor(ARTICLE, 'extremely important');
    const result = resolveTextAnchor(anchor);
    expect(result.quality).toBe(ResolutionQuality.Exact);
    expect(result.range?.toString()).toBe('extremely important');
  });

  it('restores after a reload that rebuilds identical markup', () => {
    const anchor = anchorFor(ARTICLE, 'correctness comes first');
    reload(ARTICLE);
    const result = resolveTextAnchor(anchor);
    expect(result.quality).toBe(ResolutionQuality.Exact);
    expect(result.range?.toString()).toBe('correctness comes first');
  });

  it('restores through harmless DOM changes around the text', () => {
    const anchor = anchorFor(ARTICLE, 'extremely important');
    // A banner inserted above, and the paragraph re-wrapped — the stored
    // paths no longer lead anywhere, so recovery has to do the work.
    reload(
      '<div class="banner">Subscribe now</div>' +
        '<article id="post"><div><p id="intro">Performance is extremely important in large applications.</p></div></article>',
    );
    const result = resolveTextAnchor(anchor);
    expect(result.quality).not.toBe(ResolutionQuality.Unresolved);
    expect(result.range?.toString()).toBe('extremely important');
  });

  it('restores when the text node has been split by a re-render', () => {
    const anchor = anchorFor(ARTICLE, 'extremely important');
    const intro = document.getElementById('intro')!;
    (intro.firstChild as Text).splitText(5);
    const result = resolveTextAnchor(anchor);
    expect(result.range?.toString()).toBe('extremely important');
  });

  it('restores across nested inline elements', () => {
    const html = '<p>Read the <b>bold <i>and italic</i></b> parts now</p>';
    document.body.innerHTML = html;
    const p = document.querySelector('p')!;
    const range = document.createRange();
    range.setStart(p.firstChild!, 'Read the '.length);
    range.setEnd(p.lastChild!, ' parts'.length);
    const anchor = buildTextAnchor(range)!.anchor;

    reload(html);
    const result = resolveTextAnchor(anchor);
    expect(result.quality).not.toBe(ResolutionQuality.Unresolved);
    expect(result.range?.toString().replace(/\s+/g, ' ')).toBe('bold and italic parts');
  });
});

describe('resolveTextAnchor — repeated text and disambiguation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const REPEATED =
    '<p>The quick brown fox jumps over the lazy dog.</p>' +
    '<p>A tired grey fox jumps over the sleeping cat.</p>';

  it('picks the occurrence its prefix and suffix point at, not the first one', () => {
    const anchor = anchorFor(REPEATED, 'jumps over', 1); // the second one
    reload(REPEATED);

    const result = resolveTextAnchor(anchor);
    expect(result.quality).not.toBe(ResolutionQuality.Unresolved);

    // The resolved range must sit in the *second* paragraph.
    const paragraphs = document.querySelectorAll('p');
    expect(paragraphs[1].contains(result.range!.startContainer)).toBe(true);
    expect(paragraphs[0].contains(result.range!.startContainer)).toBe(false);
  });

  it('still finds the first occurrence when that is the one anchored', () => {
    const anchor = anchorFor(REPEATED, 'jumps over', 0);
    reload(REPEATED);
    const result = resolveTextAnchor(anchor);
    const paragraphs = document.querySelectorAll('p');
    expect(paragraphs[0].contains(result.range!.startContainer)).toBe(true);
  });

  it('uses the original container to break a tie between identical occurrences', () => {
    const html =
      '<section id="left"><p>shared phrase here</p></section>' +
      '<section id="right"><p>shared phrase here</p></section>';
    const anchor = anchorFor(html, 'shared phrase', 1);
    expect(anchor.container?.selector).toContain('#right');
    // Rebuilt one level deeper, so the stored paths lead nowhere and
    // recovery has to choose between two textually identical candidates.
    reload(`<div>${html}</div>`);

    const result = resolveTextAnchor(anchor);
    expect(result.range).not.toBeNull();
    expect(document.getElementById('right')!.contains(result.range!.startContainer)).toBe(true);
  });
});

describe('resolveTextAnchor — safety', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('refuses to choose between interior occurrences with identical surroundings', () => {
    // A long run of identical list items: every interior one has exactly the
    // same text, the same prefix and the same suffix, with no id anywhere to
    // scope to. Once the stored path stops resolving, the only honest answer
    // is "not here" — the note keeps its data and simply isn't highlighted.
    const items = `<ul>${'<li>repeated item</li>'.repeat(8)}</ul>`;
    const anchor = anchorFor(items, 'repeated item', 2);
    reload(`<div>${items}</div>`);

    const result = resolveTextAnchor(anchor);
    expect(result.quality).toBe(ResolutionQuality.Unresolved);
    expect(result.range).toBeNull();
  });

  it('does disambiguate when the surroundings genuinely differ', () => {
    // The counterpart to the test above — refusing to guess must not mean
    // refusing to resolve anything repeated.
    const anchor = anchorFor('<p>alpha beta. alpha beta. alpha beta.</p>', 'alpha beta', 1);
    reload('<div><p>alpha beta. alpha beta. alpha beta.</p></div>');

    const result = resolveTextAnchor(anchor);
    expect(result.quality).toBe(ResolutionQuality.Probable);
    // Second occurrence: 'alpha beta. ' is 12 characters.
    expect(result.range!.startOffset).toBe(12);
  });

  it('never falls back to the first match when occurrences are indistinguishable', () => {
    const anchor = anchorFor('<p>alpha</p><p>alpha</p><p>alpha</p>', 'alpha', 1);
    // Every trace of which one it was is gone: same text, same neighbours,
    // paths and container invalidated by a full re-wrap.
    reload('<div><span>alpha</span><span>alpha</span><span>alpha</span></div>');

    const result = resolveTextAnchor(anchor);
    expect(result.quality).toBe(ResolutionQuality.Unresolved);
    expect(result.range).toBeNull();
  });

  it('does not highlight a different sentence that happens to share the words', () => {
    const anchor = anchorFor('<p>we should cache the results of this call</p>', 'cache');
    reload('<p>an entirely unrelated paragraph about cache invalidation policy</p>');

    const result = resolveTextAnchor(anchor);
    expect(result.quality).toBe(ResolutionQuality.Unresolved);
    expect(result.range).toBeNull();
  });

  it('resolves nothing when the original text has been removed', () => {
    const anchor = anchorFor(ARTICLE, 'extremely important');
    reload('<article id="post"><p id="intro">This paragraph was rewritten.</p></article>');

    const result = resolveTextAnchor(anchor);
    expect(result.quality).toBe(ResolutionQuality.Unresolved);
    expect(result.range).toBeNull();
  });

  it('resolves nothing when the original text was edited', () => {
    const anchor = anchorFor(ARTICLE, 'extremely important');
    reload(
      '<article id="post"><p id="intro">Performance is somewhat important here.</p></article>',
    );

    const result = resolveTextAnchor(anchor);
    expect(result.quality).toBe(ResolutionQuality.Unresolved);
  });

  it('accepts a long, distinctive quote even when everything around it changed', () => {
    const sentence = 'Correctness matters more than forcing a match every single time';
    const anchor = anchorFor(`<p>Intro sentence. ${sentence}. Outro sentence.</p>`, sentence);
    reload(`<div><blockquote>${sentence}.</blockquote></div>`);

    const result = resolveTextAnchor(anchor);
    expect(result.quality).toBe(ResolutionQuality.Probable);
    expect(result.range?.toString()).toBe(sentence);
  });

  it('leaves the anchor data itself untouched when restoration fails', () => {
    const anchor = anchorFor(ARTICLE, 'extremely important');
    const before = JSON.parse(JSON.stringify(anchor));
    reload('<p>nothing like the original</p>');

    expect(resolveTextAnchor(anchor).range).toBeNull();
    expect(anchor).toEqual(before);
  });
});

describe('resolveTextAnchors — batching', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves several anchors in one pass', () => {
    const first = anchorFor(ARTICLE, 'extremely important');
    const second = anchorFor(ARTICLE, 'correctness comes first');
    reload(ARTICLE);

    const results = resolveTextAnchors([
      { id: 'a', anchor: first },
      { id: 'b', anchor: second },
    ]);
    expect(results.get('a')?.range?.toString()).toBe('extremely important');
    expect(results.get('b')?.range?.toString()).toBe('correctness comes first');
  });

  it('builds the page-text index at most once, and only when needed', () => {
    const resolvable = anchorFor(ARTICLE, 'extremely important');
    const broken: TextAnchor = { ...resolvable, exact: 'text that is nowhere on this page' };
    reload(ARTICLE);

    let builds = 0;
    const results = resolveTextAnchors(
      [
        { id: 'fast', anchor: resolvable },
        { id: 'needs-recovery', anchor: broken },
        { id: 'also-needs-recovery', anchor: { ...broken, exact: 'likewise absent entirely' } },
      ],
      {
        buildIndex: (root) => {
          builds++;
          // Delegates to the real builder so results stay meaningful.
          return {
            text: root.textContent ?? '',
            segments: [],
            root,
          };
        },
      },
    );

    expect(builds).toBe(1);
    expect(results.get('fast')?.quality).toBe(ResolutionQuality.Exact);
    expect(results.get('needs-recovery')?.range).toBeNull();
  });

  it('revalidates a previous range instead of resolving again', () => {
    const anchor = anchorFor(ARTICLE, 'extremely important');
    const first = resolveTextAnchors([{ id: 'a', anchor }]);
    const previous = first.get('a')!.range!;

    let builds = 0;
    const second = resolveTextAnchors([{ id: 'a', anchor, previous }], {
      buildIndex: (root) => {
        builds++;
        return { text: '', segments: [], root };
      },
    });

    expect(builds).toBe(0);
    expect(second.get('a')?.range).toBe(previous);
    expect(second.get('a')?.quality).toBe(ResolutionQuality.Exact);
  });

  it('discards a previous range whose text has since changed', () => {
    const anchor = anchorFor(ARTICLE, 'extremely important');
    const previous = resolveTextAnchors([{ id: 'a', anchor }]).get('a')!.range!;
    document.getElementById('intro')!.textContent = 'Performance is barely relevant now.';

    const result = resolveTextAnchors([{ id: 'a', anchor, previous }]).get('a');
    expect(result?.quality).toBe(ResolutionQuality.Unresolved);
    expect(result?.range).toBeNull();
  });
});
