/**
 * Demo — talking where the thought was born.
 *
 * A colleague's face sits beside a paragraph. The hand opens it: her note,
 * and the latest of what the circle said about it, with one of them naming
 * another. A reply is written in the field at the foot and sent; it joins the
 * conversation, and the oldest line steps back. Then the conversation is
 * opened whole, in Chrome's side panel beside the page — without leaving it.
 *
 * Lines are shown and hidden in their place rather than animated in height,
 * so the popup grows the way the extension's does: by a line, at once, with
 * the new line fading in.
 */

import { gsap } from '../lib/gsap.js';
import { qs, rectIn } from '../lib/dom.js';
import { createDemoCursor } from '../animations/cursor.js';
import { prefersReducedMotion } from '../lib/motion.js';

export function createTeamTalkDemo(root) {
  const paragraph = qs('[data-el="paragraph"]', root);
  const pin = qs('[data-el="pin"]', root);
  const popup = qs('[data-el="popup"]', root);
  const openSide = qs('[data-el="open-side"]', root);
  const line1 = qs('[data-el="line-1"]', root);
  const line3 = qs('[data-el="line-3"]', root);
  const count2 = qs('[data-el="count-2"]', root);
  const count3 = qs('[data-el="count-3"]', root);
  const field = qs('[data-el="reply-field"]', root);
  const placeholder = qs('[data-el="reply-placeholder"]', root);
  const fieldText = qs('[data-el="field-text"]', root);
  const caret = qs('[data-el="caret"]', root);
  const reveal = qs('[data-el="reveal"]', root);
  const send = qs('[data-el="send"]', root);
  const side = qs('[data-el="side"]', root);

  if (!paragraph || !pin || !popup || !field || !side) return null;

  const rtl = document.documentElement.dir === 'rtl';
  const flip = rtl ? -1 : 1;

  const paraBox = rectIn(root, paragraph);
  const windowBox = rectIn(root, qs('.ui-window', root));
  const rootWidth = root.getBoundingClientRect().width;

  /* A rebuild (a resize, a change of language) starts from the stylesheet's
     places, not from where the last build parked things. */
  gsap.set([pin, popup], { clearProps: 'transform' });

  /* The conversation as it stands before the reply: two lines, two said. */
  const before = () => {
    gsap.set(line1, { display: 'flex', opacity: 1, y: 0 });
    gsap.set(line3, { display: 'none', opacity: 0 });
    gsap.set(count2, { opacity: 1 });
    gsap.set(count3, { opacity: 0 });
    gsap.set(placeholder, { opacity: 1 });
    gsap.set(fieldText, { opacity: 0 });
    gsap.set(reveal, { scaleX: 1 });
    gsap.set(caret, { opacity: 0, x: 0 });
    field.classList.remove('is-focus');
    send?.classList.remove('is-ready');
    [pin, openSide, send].forEach((el) => el?.classList.remove('is-hover'));
  };
  before();

  /* Measured with the popup in its "before" shape, which is the one it opens
     in, and at its full size: every control below is placed from these. */
  const popupBox = rectIn(root, popup);
  const controls = [field, send, openSide].map((el) => rectIn(root, el));

  const pinPlace = {
    x: gsap.utils.clamp(
      windowBox.x + 3,
      windowBox.x + windowBox.width - 31,
      rtl ? paraBox.x + paraBox.width + 6 : paraBox.x - 34,
    ),
    y: paraBox.y - 2,
  };
  /* The popup opens just under the line the pin marks, reaching into the
     page from the pin's side, and never past the demo's edges. */
  const popupPlace = {
    x: gsap.utils.clamp(
      10,
      Math.max(10, rootWidth - popupBox.width - 10),
      rtl ? pinPlace.x + 28 - popupBox.width : pinPlace.x,
    ),
    y: pinPlace.y + 34,
  };

  gsap.set([pin, popup], { top: 0, left: 0 });
  gsap.set(pin, { x: pinPlace.x, y: pinPlace.y, opacity: 1, scale: 1 });
  gsap.set(popup, { x: popupPlace.x, y: popupPlace.y, opacity: 0, scale: 0.96 });
  /* `x: 0` as well: the stylesheet parks the panel off the window for a page
     without scripts, and GSAP would otherwise read that as a pixel offset of
     its own and keep it under `xPercent` — the panel never arrived. */
  gsap.set(side, { x: 0, xPercent: 104 });

  if (prefersReducedMotion()) {
    gsap.set(popup, { opacity: 1, scale: 1 });
    return gsap.timeline({ paused: true });
  }

  const cursor = createDemoCursor(root);
  /* Where a control in the popup will be once it is open. */
  const inPopup = (box, dx = 0) => ({
    x: popupPlace.x + (box.centerX - popupBox.x) + dx,
    y: popupPlace.y + (box.centerY - popupBox.y),
  });
  const [fieldBox, sendBox, sideBox] = controls;
  const typed = fieldText ? rectIn(root, fieldText).width : 120;
  const textWidth = Math.min(typed, fieldBox.width - 22);
  const rest = { x: pinPlace.x - 60 * flip, y: paraBox.y + paraBox.height + 120 };

  cursor?.placeAt(rest);

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });

  /* 1 — a face on the page; open what she wrote. */
  cursor?.enter(tl, 0.15);
  cursor?.moveTo(
    tl,
    { x: pinPlace.x + 14, y: pinPlace.y + 14 },
    { at: 0.3, bend: 1, label: 'onPin' },
  );
  cursor?.hover(tl, pin, true, { at: 'onPin-=0.08' });
  cursor?.settle(tl, {});
  cursor?.press(tl, { target: pin });

  tl.to(popup, { opacity: 1, scale: 1, duration: 0.32, ease: 'power3.out' }, '>-0.1').to(
    {},
    { duration: 0.9 },
  );

  /* 2 — a reply, in the field at the foot. */
  cursor?.moveTo(tl, inPopup(fieldBox, -20 * flip), { at: '>', bend: -0.8 });
  cursor?.settle(tl, {});
  cursor?.press(tl, {});
  tl.call(() => field.classList.add('is-focus'), null, '<+0.05')
    .to(placeholder, { opacity: 0, duration: 0.12 }, '<')
    .set(fieldText, { opacity: 1 }, '<')
    .to(caret, { opacity: 1, duration: 0.1 }, '>')
    .to(reveal, { scaleX: 0, duration: 1.4, ease: 'steps(24)' }, '>')
    .to(caret, { x: textWidth * flip, duration: 1.4, ease: 'steps(24)' }, '<')
    .call(() => send?.classList.add('is-ready'), null, '<+0.3')
    .to(caret, { opacity: 0, duration: 0.14 }, '>-0.05');

  /* 3 — sent: it joins the conversation, and the oldest line steps back. */
  cursor?.moveTo(tl, inPopup(sendBox), { at: '>', bend: 1 });
  cursor?.settle(tl, {});
  cursor?.hover(tl, send, true, {});
  cursor?.press(tl, { target: send });

  tl.to(line1, { opacity: 0, y: -4, duration: 0.2 }, '>-0.1')
    .to(fieldText, { opacity: 0, duration: 0.16 }, '<')
    .set(line1, { display: 'none' }, '>')
    .set(line3, { display: 'flex' }, '<')
    .fromTo(line3, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3 }, '<')
    .to(count2, { opacity: 0, duration: 0.18 }, '<')
    .to(count3, { opacity: 1, duration: 0.18 }, '<')
    .call(
      () => {
        field.classList.remove('is-focus');
        send?.classList.remove('is-ready');
      },
      null,
      '<',
    )
    .set(reveal, { scaleX: 1 }, '<')
    .set(caret, { x: 0 }, '<')
    .to(placeholder, { opacity: 1, duration: 0.2 }, '<+0.1')
    .to({}, { duration: 0.8 });

  /* 4 — and the whole of it, beside the page. Measured with the reply in
     place: the popup is a line taller now, and its header has not moved. */
  cursor?.moveTo(tl, inPopup(sideBox), { at: '>', bend: -1, label: 'onSide' });
  cursor?.hover(tl, openSide, true, { at: 'onSide-=0.08' });
  cursor?.settle(tl, {});
  cursor?.press(tl, { target: openSide });

  /* The pin belongs to the page under the panel; drawn outside the window,
     it would sit on top of it. */
  tl.to(popup, { opacity: 0, scale: 0.97, duration: 0.22 }, '>-0.05')
    .to(pin, { opacity: 0, duration: 0.2 }, '<')
    .to(side, { xPercent: 0, duration: 0.55, ease: 'power3.out' }, '<+0.05')
    .to({}, { duration: 2.2 });

  /* 5 — the seam: the panel goes back, the conversation is put back as it
     was, all behind the hand on its way out. */
  cursor?.exit(tl, '>');
  tl.to(side, { xPercent: 104, duration: 0.45, ease: 'power2.in' }, '<')
    .to(pin, { opacity: 1, duration: 0.3 }, '>-0.1')
    .set(popup, { scale: 0.96 })
    .call(() => {
      before();
      cursor?.placeAt(rest);
    });

  return tl;
}
