/**
 * Demo — a note attached to selected text (Hawamesh).
 *
 * The scenario, start to finish: a page is open, a hand arrives, drags across
 * a phrase, the Hamesh mark appears beside it, the hand clicks, the composer
 * opens already holding the words it is attached to, a note is typed and
 * saved, and the phrase keeps a clay underline with a mark in the margin.
 * Hovering it brings the note back. Then everything it changed fades out and
 * the loop begins again — the reset never snaps, because the only things
 * still visible at the seam are things that were already fading.
 *
 * Every position is measured from the real elements rather than written down,
 * so the same code lands correctly in Arabic and English, at any width.
 */

import { gsap } from '../lib/gsap.js';
import { qs, rectIn } from '../lib/dom.js';
import { createDemoCursor } from '../animations/cursor.js';
import { prefersReducedMotion } from '../lib/motion.js';

export function createContextualNoteDemo(root) {
  const target = qs('[data-el="target"]', root);
  const selection = qs('[data-el="selection"]', root);
  const underline = qs('[data-el="underline"]', root);
  const action = qs('[data-el="action"]', root);
  const card = qs('[data-el="card"]', root);
  const fieldText = qs('[data-el="field-text"]', root);
  const caret = qs('[data-el="caret"]', root);
  const reveal = qs('[data-el="reveal"]', root);
  const save = qs('[data-el="save"]', root);
  const marginMark = qs('[data-el="margin-mark"]', root);
  const pill = qs('[data-el="pill"]', root);
  const paragraph = qs('[data-el="paragraph"]', root);

  if (!target || !card) return null;

  const rtl = document.documentElement.dir === 'rtl';
  const flip = rtl ? -1 : 1;

  const targetBox = rectIn(root, target);
  const paraBox = rectIn(root, paragraph);
  const cardBox = rectIn(root, card);
  const windowBox = rectIn(root, qs('.ui-window', root));
  const rootWidth = root.getBoundingClientRect().width;

  /* The composer opens below the words it belongs to, unless it would hang
     off the bottom of the page it is annotating — in which case it opens
     above them instead. The extension clamps to the viewport the same way,
     for the same reason: a note card half outside its own page reads as a
     mistake. */
  const below = targetBox.y + targetBox.height + 12;
  const fitsBelow = below + cardBox.height <= windowBox.y + windowBox.height - 10;
  const cardY = fitsBelow ? below : Math.max(windowBox.y + 10, targetBox.y - cardBox.height - 10);

  /* Where each floating piece belongs, relative to the words it serves. */
  const places = {
    action: {
      x: rtl ? targetBox.x - 16 : targetBox.x + targetBox.width - 42,
      y: targetBox.y + targetBox.height + 6,
    },
    card: {
      x: gsap.utils.clamp(
        12,
        Math.max(12, rootWidth - cardBox.width - 12),
        targetBox.centerX - cardBox.width / 2,
      ),
      y: cardY,
    },
    marginMark: {
      /* Docked in the page's own margin, and kept inside the window it
         belongs to: on a narrow screen the page's padding is smaller than the
         mark's offset, which used to push it past the edge where it was
         clipped in half. */
      x: gsap.utils.clamp(
        windowBox.x + 3,
        windowBox.x + windowBox.width - 25,
        rtl ? paraBox.x + paraBox.width + 4 : paraBox.x - 27,
      ),
      y: targetBox.y - 2,
    },
    pill: {
      x: gsap.utils.clamp(12, Math.max(12, rootWidth - 250), targetBox.centerX - 90),
      y: targetBox.y - 40,
    },
  };

  /* Resting states. Anything the story adds starts invisible. */
  gsap.set([action, card, pill, marginMark], { top: 0, left: 0, opacity: 0 });
  gsap.set(action, { x: places.action.x, y: places.action.y, scale: 0.94 });
  gsap.set(card, { x: places.card.x, y: places.card.y, scale: 0.96 });
  gsap.set(marginMark, { x: places.marginMark.x, y: places.marginMark.y, scale: 0.7 });
  gsap.set(pill, { x: places.pill.x, y: places.pill.y, scale: 0.96 });
  gsap.set(selection, { scaleX: 0 });
  gsap.set(underline, { scaleX: 0, opacity: 1 });
  gsap.set(reveal, { scaleX: 1 });
  gsap.set(caret, { opacity: 0, x: 0 });

  /* Reduced motion: the finished state, held still. Everything the story
     would have produced is simply already there. */
  if (prefersReducedMotion()) {
    gsap.set([underline], { scaleX: 1 });
    gsap.set(reveal, { scaleX: 0 });
    gsap.set([marginMark], { opacity: 1, scale: 1 });
    gsap.set(pill, { opacity: 1, scale: 1 });
    return gsap.timeline({ paused: true });
  }

  const cursor = createDemoCursor(root);
  const textWidth = fieldText ? rectIn(root, fieldText).width : 120;

  const dragFrom = {
    x: rtl ? targetBox.x + targetBox.width + 4 : targetBox.x - 4,
    y: targetBox.centerY + 1,
  };
  const dragTo = {
    x: rtl ? targetBox.x - 4 : targetBox.x + targetBox.width + 4,
    y: targetBox.centerY + 1,
  };

  cursor?.placeAt({ x: targetBox.centerX - 90 * flip, y: targetBox.y + 96 });

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
  tl.to(action, { opacity: 1, scale: 1, duration: 0.28, ease: 'power3.out' }, '>-0.1');

  cursor?.moveTo(tl, { x: places.action.x + 26, y: places.action.y + 14 }, { at: '>', bend: -1 });
  cursor?.settle(tl, {});
  cursor?.hover(tl, action, true, {});
  cursor?.press(tl, { target: action });

  /* 3 — the composer opens, holding the words it belongs to. */
  tl.to(action, { opacity: 0, scale: 0.94, duration: 0.18 }, '>-0.12')
    .to(selection, { opacity: 0.55, duration: 0.3 }, '<')
    .to(card, { opacity: 1, scale: 1, duration: 0.34, ease: 'power3.out' }, '<+0.05')
    .to(caret, { opacity: 1, duration: 0.12 }, '>');

  /* 4 — typing. The mask retreats in steps so words appear as words, and the
     caret rides its edge instead of sitting still at the end. */
  tl.to(reveal, { scaleX: 0, duration: 1.45, ease: 'steps(23)' }, '>')
    .to(caret, { x: textWidth * flip, duration: 1.45, ease: 'steps(23)' }, '<')
    .to(caret, { opacity: 0, duration: 0.2 }, '>-0.1');

  /* 5 — saved. */
  cursor?.moveTo(
    tl,
    { x: rectIn(root, save).centerX, y: rectIn(root, save).centerY + 2 },
    { at: '>-0.2', bend: 1 },
  );
  cursor?.settle(tl, {});
  cursor?.hover(tl, save, true, {});
  cursor?.press(tl, { target: save });

  tl.to(card, { opacity: 0, scale: 0.96, y: places.card.y - 6, duration: 0.26 }, '>-0.05')
    .to(selection, { opacity: 0, duration: 0.26 }, '<')
    /* What the note leaves behind: a clay underline and a mark in the
       margin, which is all the extension leaves on a page. */
    .fromTo(underline, { scaleX: 0 }, { scaleX: 1, duration: 0.42, ease: 'power2.out' }, '<+0.08')
    .to(marginMark, { opacity: 1, scale: 1, duration: 0.3, ease: 'power3.out' }, '<+0.06');

  /* 6 — coming back to it later: hover, and the note returns. */
  cursor?.moveTo(
    tl,
    { x: targetBox.centerX, y: targetBox.centerY + 6 },
    { at: '>+0.15', bend: -1 },
  );
  tl.to(pill, { opacity: 1, scale: 1, duration: 0.3, ease: 'power3.out' }, '>-0.05').to(
    {},
    { duration: 1.5 },
  );

  /* 7 — the seam. Everything the story added leaves the way it came, and the
     resets happen behind the fade rather than after it. */
  tl.to([pill, marginMark], { opacity: 0, duration: 0.42 }, '>')
    .to(underline, { opacity: 0, duration: 0.42 }, '<')
    .to(selection, { opacity: 1, duration: 0 }, '<');
  cursor?.exit(tl, '<');

  tl.set([selection], { scaleX: 0 })
    .set(underline, { scaleX: 0, opacity: 1 })
    .set(reveal, { scaleX: 1 })
    .set(caret, { x: 0 })
    .set(card, { y: places.card.y })
    .call(() => cursor?.placeAt({ x: targetBox.centerX - 90 * flip, y: targetBox.y + 96 }));

  return tl;
}
