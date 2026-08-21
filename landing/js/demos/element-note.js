/**
 * Demo — a note on a whole element (Alt+H).
 *
 * The story this one has to tell is precision. Where the contextual demo is
 * about words, this is about Hamesh knowing exactly which *thing* on a page
 * you mean: activate it, move across the page, and the outline snaps from one
 * element to the next — a paragraph, then a line of code — until you click
 * the one you wanted.
 *
 * The outline is not one box being resized from element to element, which
 * would stretch its border and read as an animation. Each candidate carries
 * its own overlay and they cross-fade, which is both honest about how the
 * extension behaves and cheaper to draw.
 */

import { gsap } from '../lib/gsap.js';
import { qs, rectIn } from '../lib/dom.js';
import { createDemoCursor } from '../animations/cursor.js';
import { prefersReducedMotion } from '../lib/motion.js';

export function createElementNoteDemo(root) {
  const first = qs('[data-el="el-1"]', root);
  const second = qs('[data-el="el-2"]', root);
  const hlFirst = qs('[data-el="hl-1"]', root);
  const hlSecond = qs('[data-el="hl-2"]', root);
  const hint = qs('[data-el="hint"]', root);
  const card = qs('[data-el="card"]', root);
  const fieldText = qs('[data-el="field-text"]', root);
  const caret = qs('[data-el="caret"]', root);
  const reveal = qs('[data-el="reveal"]', root);
  const save = qs('[data-el="save"]', root);
  const marginMark = qs('[data-el="margin-mark"]', root);

  if (!first || !second || !card) return null;

  const rtl = document.documentElement.dir === 'rtl';
  const flip = rtl ? -1 : 1;

  const firstBox = rectIn(root, first);
  const secondBox = rectIn(root, second);
  const cardBox = rectIn(root, card);
  const windowBox = rectIn(root, qs('.ui-window', root));
  const rootWidth = root.getBoundingClientRect().width;

  /* The composer opens under the element it is attached to, and is allowed to
     reach past the bottom of the window — it is a floating card over the page,
     which is exactly how the extension's own composer behaves near the foot of
     a document. Flipping it above instead put it on top of the browser chrome,
     which reads as a bug rather than as a composer. */
  const cardY = secondBox.y + secondBox.height + 12;

  const places = {
    card: {
      x: gsap.utils.clamp(
        12,
        Math.max(12, rootWidth - cardBox.width - 12),
        secondBox.centerX - cardBox.width / 2,
      ),
      y: cardY,
    },
    marginMark: {
      x: rtl ? secondBox.x + secondBox.width + 8 : secondBox.x - 30,
      y: secondBox.y + 2,
    },
    hint: { x: windowBox.x + windowBox.width / 2 - 40, y: windowBox.y + 46 },
  };

  gsap.set([card, marginMark, hint], { top: 0, left: 0, opacity: 0 });
  gsap.set(card, { x: places.card.x, y: places.card.y, scale: 0.96 });
  gsap.set(marginMark, { x: places.marginMark.x, y: places.marginMark.y, scale: 0.7 });
  gsap.set(hint, { x: places.hint.x, y: places.hint.y, scale: 0.96 });
  gsap.set([hlFirst, hlSecond], { opacity: 0 });
  gsap.set(reveal, { scaleX: 1 });
  gsap.set(caret, { opacity: 0, x: 0 });

  if (prefersReducedMotion()) {
    gsap.set(hlSecond, { opacity: 1 });
    gsap.set(marginMark, { opacity: 1, scale: 1 });
    gsap.set(card, { opacity: 1, scale: 1 });
    gsap.set(reveal, { scaleX: 0 });
    return gsap.timeline({ paused: true });
  }

  const cursor = createDemoCursor(root);
  const textWidth = fieldText ? rectIn(root, fieldText).width : 120;

  cursor?.placeAt({ x: firstBox.centerX - 40 * flip, y: windowBox.y + windowBox.height + 30 });

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });

  /* 1 — activated by the keyboard, not by hunting for a button. */
  tl.to(hint, { opacity: 1, scale: 1, duration: 0.26, ease: 'power3.out' }, 0.25)
    .to(hint, { scale: 0.94, duration: 0.1, ease: 'power2.in' }, '>+0.45')
    .to(hint, { scale: 1, duration: 0.16, ease: 'back.out(2)' }, '>');

  cursor?.enter(tl, '<');

  /* 2 — moving across the page, the outline follows what is under the
     pointer. This is the whole feature: it picks the element, not a
     rectangle you have to draw. */
  cursor?.moveTo(tl, { x: firstBox.centerX, y: firstBox.centerY }, { at: '>+0.1', bend: 0.8 });
  tl.to(hlFirst, { opacity: 1, duration: 0.18 }, '>-0.15').to(
    hint,
    { opacity: 0, y: places.hint.y - 8, duration: 0.24 },
    '<',
  );

  cursor?.moveTo(tl, { x: secondBox.centerX, y: secondBox.centerY }, { at: '>+0.5', bend: -0.9 });
  tl.to(hlFirst, { opacity: 0, duration: 0.18 }, '>-0.22').to(
    hlSecond,
    { opacity: 1, duration: 0.18 },
    '<+0.04',
  );

  /* 3 — chosen. */
  cursor?.settle(tl, { duration: 0.18 });
  cursor?.press(tl, {});

  tl.to(card, { opacity: 1, scale: 1, duration: 0.32, ease: 'power3.out' }, '>-0.08').to(
    caret,
    { opacity: 1, duration: 0.12 },
    '>',
  );

  /* 4 — typing, then saving. */
  tl.to(reveal, { scaleX: 0, duration: 1.25, ease: 'steps(20)' }, '>')
    .to(caret, { x: textWidth * flip, duration: 1.25, ease: 'steps(20)' }, '<')
    .to(caret, { opacity: 0, duration: 0.18 }, '>-0.08');

  cursor?.moveTo(
    tl,
    { x: rectIn(root, save).centerX, y: rectIn(root, save).centerY + 2 },
    { at: '>-0.15', bend: 1 },
  );
  cursor?.settle(tl, {});
  cursor?.hover(tl, save, true, {});
  cursor?.press(tl, { target: save });

  /* 5 — what it leaves behind: one small mark in the margin, and a page that
     still looks like the page. */
  tl.to(card, { opacity: 0, scale: 0.96, duration: 0.26 }, '>-0.05')
    .to(hlSecond, { opacity: 0, duration: 0.34 }, '<')
    .to(marginMark, { opacity: 1, scale: 1, duration: 0.32, ease: 'power3.out' }, '<+0.08')
    .to({}, { duration: 1.5 });

  /* 6 — the seam. */
  cursor?.exit(tl, '>');
  tl.to(marginMark, { opacity: 0, duration: 0.42 }, '<')
    .set(marginMark, { scale: 0.7 })
    .set(reveal, { scaleX: 1 })
    .set(caret, { x: 0 })
    .set(hint, { y: places.hint.y })
    .call(() =>
      cursor?.placeAt({ x: firstBox.centerX - 40 * flip, y: windowBox.y + windowBox.height + 30 }),
    );

  return tl;
}
