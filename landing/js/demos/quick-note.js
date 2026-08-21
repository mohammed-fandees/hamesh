/**
 * Demo — a note on a moment in a video (Alt+V).
 *
 * A different scenario on purpose: nothing is selected and nothing is
 * clicked. The video is playing, a keyboard shortcut interrupts it, one field
 * appears, a line is typed, Enter files it, and a clay marker settles onto
 * the timeline at the second it was written. That is the whole feature — it
 * is quick, and the demo has to feel quick.
 *
 * The cursor stays out of this one. Showing a pointer hunting for a control
 * would misrepresent a shortcut, and it gives the showcase a second rhythm
 * beside the pointer-driven demos.
 */

import { gsap } from '../lib/gsap.js';
import { qs, rectIn } from '../lib/dom.js';
import { prefersReducedMotion } from '../lib/motion.js';

/** Where along the timeline the note lands, as a fraction of its width. */
const NOTE_AT = 0.46;

export function createQuickNoteDemo(root) {
  const bar = qs('[data-el="bar"]', root);
  const played = qs('[data-el="played"]', root);
  const marker = qs('[data-el="marker"]', root);
  const time = qs('[data-el="time"]', root);
  const hint = qs('[data-el="hint"]', root);
  const quick = qs('[data-el="quick"]', root);
  const reveal = qs('[data-el="reveal"]', root);
  const caret = qs('[data-el="caret"]', root);
  const fieldText = qs('[data-el="field-text"]', root);
  const stamp = qs('[data-el="stamp"]', root);

  if (!bar || !quick) return null;

  const rtl = document.documentElement.dir === 'rtl';
  const flip = rtl ? -1 : 1;

  const barBox = rectIn(root, bar);
  const quickBox = rectIn(root, quick);
  const rootWidth = root.getBoundingClientRect().width;

  /* Two different frames of reference: the marker lives inside the bar, while
     the editor and the hint are placed against the demo. Mixing them put the
     marker roughly forty pixels late. */
  const markerInBar = barBox.width * NOTE_AT;
  const markerX = barBox.x + markerInBar;

  const places = {
    quick: {
      x: gsap.utils.clamp(
        12,
        Math.max(12, rootWidth - quickBox.width - 12),
        markerX - quickBox.width / 2,
      ),
      y: barBox.y - quickBox.height - 18,
    },
    hint: { x: markerX - 46, y: barBox.y - 44 },
  };

  gsap.set([quick, hint], { top: 0, left: 0, opacity: 0 });
  gsap.set(quick, { x: places.quick.x, y: places.quick.y, scale: 0.96 });
  gsap.set(hint, { x: places.hint.x, y: places.hint.y, scale: 0.96 });
  gsap.set(marker, { x: markerInBar, opacity: 0, scale: 0.4 });
  gsap.set(played, { scaleX: 0.08 });
  gsap.set(reveal, { scaleX: 1 });
  gsap.set(caret, { opacity: 0, x: 0 });

  if (prefersReducedMotion()) {
    gsap.set(played, { scaleX: NOTE_AT });
    gsap.set(marker, { opacity: 1, scale: 1 });
    gsap.set(quick, { opacity: 1, scale: 1 });
    gsap.set(reveal, { scaleX: 0 });
    if (time) time.textContent = '1:12';
    return gsap.timeline({ paused: true });
  }

  const textWidth = fieldText ? rectIn(root, fieldText).width : 120;

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });

  /* 1 — it is playing. The progress bar is the clock everything else runs
     against, and the readout counts with it rather than beside it. */
  const clock = { t: 8 };
  tl.to(played, { scaleX: NOTE_AT, duration: 2.6, ease: 'none' }, 0).to(
    clock,
    {
      t: 72,
      duration: 2.6,
      ease: 'none',
      onUpdate: () => {
        if (!time) return;
        const seconds = Math.round(clock.t);
        time.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      },
    },
    0,
  );

  /* 2 — the shortcut. The hint is how a first-time visitor learns the key
     exists at all, so it arrives before the editor, not with it. */
  tl.to(hint, { opacity: 1, scale: 1, duration: 0.26, ease: 'power3.out' }, 1.5)
    .to(hint, { scale: 0.94, duration: 0.1, ease: 'power2.in' }, '>+0.5')
    .to(hint, { scale: 1, duration: 0.16, ease: 'back.out(2)' }, '>');

  /* 3 — playback stops where the thought happened, and one field opens. */
  tl.to(played, { timeScale: 0, duration: 0 }, '>')
    .to(hint, { opacity: 0, y: places.hint.y - 8, duration: 0.24 }, '>')
    .to(quick, { opacity: 1, scale: 1, duration: 0.3, ease: 'power3.out' }, '<+0.04')
    .to(caret, { opacity: 1, duration: 0.12 }, '>');

  if (stamp) tl.call(() => (stamp.textContent = '1:12'), null, '<');

  /* 4 — typing, then Enter. No Save button to find: this note files itself. */
  tl.to(reveal, { scaleX: 0, duration: 1.15, ease: 'steps(19)' }, '>')
    .to(caret, { x: textWidth * flip, duration: 1.15, ease: 'steps(19)' }, '<')
    .to(caret, { opacity: 0, duration: 0.16 }, '>-0.05')
    .to(quick, { opacity: 0, scale: 0.94, y: places.quick.y + 10, duration: 0.28 }, '>+0.25')
    /* 5 — and the moment is marked. */
    .to(marker, { opacity: 1, scale: 1, duration: 0.34, ease: 'back.out(2.2)' }, '<+0.1')
    .to({}, { duration: 1.4 });

  /* 6 — the seam: playback resumes past the mark, which stays where it was
     put, then the whole bar resets while the marker is fading. */
  tl.to(played, { scaleX: 0.86, duration: 1.2, ease: 'none' }, '>')
    .to(marker, { opacity: 0, duration: 0.5 }, '>-0.35')
    .set(played, { scaleX: 0.08 })
    .set(marker, { scale: 0.4 })
    .set(reveal, { scaleX: 1 })
    .set(caret, { x: 0 })
    .set(quick, { y: places.quick.y })
    .set(hint, { y: places.hint.y })
    .call(() => {
      clock.t = 8;
      if (time) time.textContent = '0:08';
    });

  return tl;
}
