/**
 * Demo — a note attached to selected text.
 *
 * The scenario, start to finish: a page is open, a hand arrives, drags across
 * a phrase, the Hamesh mark appears beside it, the hand clicks, the composer
 * opens already holding the words it is attached to, a note is typed and
 * saved, and the phrase keeps the faint clay tint and underline the extension
 * leaves behind. Hovering it brings the note back. Then everything it changed
 * fades out and the loop begins again — the reset never snaps, because the
 * only things still visible at the seam are things that were already fading.
 *
 * Every position is measured from the real elements rather than written down,
 * so the same code lands correctly in Arabic and English, at any width.
 */

import { gsap } from '../lib/gsap.js';
import { qs, rectIn } from '../lib/dom.js';
import { createDemoCursor } from '../animations/cursor.js';
import { prefersReducedMotion } from '../lib/motion.js';
import { typeInto, fullText } from '../lib/typing.js';

export function createContextualNoteDemo(root) {
  const target = qs('[data-el="target"]', root);
  const selection = qs('[data-el="selection"]', root);
  const highlight = qs('[data-el="highlight"]', root);
  const underline = qs('[data-el="underline"]', root);
  const action = qs('[data-el="action"]', root);
  const card = qs('[data-el="card"]', root);
  const fieldText = qs('[data-el="field-text"]', root);
  const caret = qs('[data-el="caret"]', root);
  const save = qs('[data-el="save"]', root);
  const pill = qs('[data-el="pill"]', root);

  if (!target || !card) return null;

  const rtl = document.documentElement.dir === 'rtl';
  const text = fullText(fieldText);
  fieldText.textContent = text;
  const flip = rtl ? -1 : 1;

  /* A rebuild measures at full size, not at the scale the last one left. */
  gsap.set([action, card, pill], { clearProps: 'transform' });

  const targetBox = rectIn(root, target);
  const cardBox = rectIn(root, card);
  const pillBox = rectIn(root, pill);
  const rootWidth = root.offsetWidth;
  /* In the hero the composer stays inside its window. */
  const windowBox = rectIn(root, qs('.ui-window', root));
  const lowest = root.hasAttribute('data-contain')
    ? windowBox.y + windowBox.height - cardBox.height - 10
    : Infinity;

  /* The composer opens below the words it belongs to, and may reach past the
     foot of the window: it floats over the page, as the extension's own does.
     Opening it above instead put it on top of the browser's address bar,
     which read as a mistake rather than as a composer. */
  const places = {
    /* The mark offers itself just after the selection, on its line — where
       the extension puts it. */
    action: {
      x: gsap.utils.clamp(
        2,
        rootWidth - 24,
        rtl ? targetBox.x - 28 : targetBox.x + targetBox.width + 6,
      ),
      y: targetBox.y - 1,
    },
    card: {
      x: gsap.utils.clamp(
        12,
        Math.max(12, rootWidth - cardBox.width - 12),
        targetBox.centerX - cardBox.width / 2,
      ),
      y: Math.min(targetBox.y + targetBox.height + 12, lowest),
    },
    pill: {
      x: gsap.utils.clamp(
        12,
        Math.max(12, rootWidth - pillBox.width - 12),
        targetBox.centerX - pillBox.width / 2,
      ),
      y: targetBox.y - pillBox.height - 8,
    },
  };

  /* Resting states. Anything the story adds starts invisible. */
  gsap.set([action, card, pill], { top: 0, left: 0, opacity: 0 });
  gsap.set(action, { x: places.action.x, y: places.action.y, scale: 0.85 });
  gsap.set(card, { x: places.card.x, y: places.card.y, scale: 0.96 });
  gsap.set(pill, { x: places.pill.x, y: places.pill.y, scale: 0.96 });
  gsap.set([selection, highlight, underline], { scaleX: 0, opacity: 1 });
  gsap.set(caret, { opacity: 0 });

  /* Reduced motion: the finished state, held still. Everything the story
     would have produced is simply already there. */
  if (prefersReducedMotion()) {
    gsap.set([highlight, underline], { scaleX: 1 });
    gsap.set(pill, { opacity: 1, scale: 1 });
    return gsap.timeline({ paused: true });
  }

  const cursor = createDemoCursor(root);
  /* Measured while the field still holds its full text, which is its size when
     the hand gets there. */
  const saveBox = rectIn(root, save);
  const rest = { x: targetBox.centerX - 90 * flip, y: targetBox.y + 96 };

  const dragFrom = {
    x: rtl ? targetBox.x + targetBox.width + 4 : targetBox.x - 4,
    y: targetBox.centerY + 1,
  };
  const dragTo = {
    x: rtl ? targetBox.x - 4 : targetBox.x + targetBox.width + 4,
    y: targetBox.centerY + 1,
  };

  cursor?.placeAt(rest);

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5, paused: true });

  /* 1 — the hand arrives and drags across the phrase. */
  cursor?.enter(tl, 0.1);
  cursor?.drag(tl, dragFrom, dragTo, {
    at: 0.35,
    duration: 0.78,
    onSweep: (at, duration) => {
      tl.fromTo(selection, { scaleX: 0 }, { scaleX: 1, duration, ease: 'power1.inOut' }, at);
    },
  });

  /* 2 — the mark offers itself beside the selection. */
  tl.to(action, { opacity: 1, scale: 1, duration: 0.24, ease: 'back.out(2)' }, '>-0.1');

  cursor?.moveTo(tl, { x: places.action.x + 12, y: places.action.y + 14 }, { at: '>', bend: -1 });
  cursor?.settle(tl, {});
  cursor?.hover(tl, action, true, {});
  cursor?.press(tl, { target: action });

  /* 3 — the composer opens, holding the words it belongs to. */
  tl.to(action, { opacity: 0, scale: 0.85, duration: 0.16 }, '>-0.12')
    .to(card, { opacity: 1, scale: 1, duration: 0.34, ease: 'power3.out' }, '<+0.05')
    .to(caret, { opacity: 1, duration: 0.12 }, '>');

  /* 4 — typing. */
  const typing = typeInto(tl, fieldText, text, { caret });
  tl.to(caret, { opacity: 0, duration: 0.2 }, '>+0.45');

  /* 5 — saved. */
  cursor?.moveTo(tl, { x: saveBox.centerX, y: saveBox.centerY + 2 }, { at: '>-0.2', bend: 1 });
  cursor?.settle(tl, {});
  cursor?.hover(tl, save, true, {});
  cursor?.press(tl, { target: save });

  tl.to(card, { opacity: 0, scale: 0.96, y: places.card.y - 6, duration: 0.26 }, '>-0.05')
    .to(selection, { opacity: 0, duration: 0.26 }, '<')
    /* What the note leaves behind: the words tinted, and underlined in clay —
       all the extension leaves on a page. */
    .fromTo(highlight, { scaleX: 0 }, { scaleX: 1, duration: 0.42, ease: 'power2.out' }, '<+0.08')
    .fromTo(underline, { scaleX: 0 }, { scaleX: 1, duration: 0.42, ease: 'power2.out' }, '<+0.05');

  /* 6 — coming back to it later: hover, and the note returns. */
  cursor?.moveTo(tl, { x: targetBox.centerX, y: targetBox.centerY + 6 }, { at: '>+0.2', bend: -1 });
  tl.to(pill, { opacity: 1, scale: 1, duration: 0.3, ease: 'power3.out' }, '>-0.05').to(
    {},
    { duration: 1.5 },
  );

  /* 7 — the seam. Everything the story added leaves the way it came, and the
     resets happen behind the fade rather than after it. */
  tl.to(pill, { opacity: 0, duration: 0.42 }, '>').to(
    [highlight, underline],
    { opacity: 0, duration: 0.42 },
    '<',
  );
  cursor?.exit(tl, '<');

  tl.set([selection, highlight, underline], { scaleX: 0, opacity: 1 })
    .set(typing.state, { t: 0 })
    .set(card, { y: places.card.y })
    .call(() => cursor?.placeAt(rest));

  return tl;
}
