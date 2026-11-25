/**
 * Typing, one grapheme at a time.
 *
 * Real text is written into the element, so Arabic letters join as they
 * arrive and a mark is never separated from its letter. The caret is an inline
 * element after the text: the browser places it, in either direction and
 * across a wrap.
 */

const BASE = 0.055;
const JITTER = 0.25;
const AFTER_SPACE = 0.12;
const AFTER_PUNCTUATION = 0.22;
const PUNCTUATION = /[،.؛,;]$/;

export function graphemes(text) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

/* Seeded from the text, so every loop of a demo has the same rhythm and a test
   can rely on it. */
function randomFrom(text) {
  let state = 2166136261;
  for (const char of text) state = Math.imul(state ^ char.codePointAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

/** Each grapheme, and when it appears in seconds from the start. */
export function typingSchedule(text) {
  const parts = graphemes(text);
  const random = randomFrom(text);
  const times = [];
  let at = 0;
  parts.forEach((_, i) => {
    const previous = i ? parts[i - 1] : '';
    if (previous === ' ') at += AFTER_SPACE;
    else if (PUNCTUATION.test(previous)) at += AFTER_PUNCTUATION;
    at += BASE * (1 + (random() * 2 - 1) * JITTER);
    times.push(at);
  });
  return { parts, times };
}

/** The text an element carries in the page's language, whatever it shows now. */
export function fullText(el) {
  const lang = el.ownerDocument.documentElement.lang === 'en' ? 'en' : 'ar';
  return el.getAttribute(`data-${lang}`) ?? el.textContent;
}

/**
 * Add the typing of `text` into `el` to a timeline.
 *
 * The tween drives a property with a setter rather than an `onUpdate`, so
 * seeking, restarting and repeating (which suppress callbacks) still leave
 * the right text on screen.
 */
export function typeInto(tl, el, text, { caret, at = '>' } = {}) {
  const { parts, times } = typingSchedule(text);
  const duration = times.at(-1) ?? 0;
  let elapsed = 0;
  let shown = -1;

  const render = (value) => {
    elapsed = value;
    let count = 0;
    while (count < times.length && times[count] <= value + 1e-6) count += 1;
    caret?.classList.toggle('is-typing', value > 0 && count < parts.length);
    if (count === shown) return;
    shown = count;
    el.textContent = parts.slice(0, count).join('');
  };

  const state = {
    get t() {
      return elapsed;
    },
    set t(value) {
      render(value);
    },
  };

  render(0);
  tl.to(state, { t: duration, duration, ease: 'none' }, at);

  return { state, duration, reset: () => render(0) };
}
