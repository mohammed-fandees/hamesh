/**
 * Demo — a note written for the team.
 *
 * The page already carries a colleague's face beside its title: someone has
 * been here before you. Hamesh is called up from the keyboard, the frame
 * settles on a paragraph, the composer opens, a line is written — and then
 * the one new choice: who it is for. "Reading circle" is chosen, the button
 * says it will save and share, and once it does, the paragraph gains a second
 * face in its margin: yours.
 *
 * As in the extension, a face marks a note on a whole element; the words of
 * a passage keep their tint instead. So this scene frames a paragraph rather
 * than selecting words.
 */

import { gsap } from '../lib/gsap.js';
import { qs, rectIn } from '../lib/dom.js';
import { createDemoCursor } from '../animations/cursor.js';
import { prefersReducedMotion } from '../lib/motion.js';

export function createTeamWriteDemo(root) {
  const target = qs('[data-el="target"]', root);
  const frame = qs('[data-el="frame"]', root);
  const hint = qs('[data-el="hint"]', root);
  const card = qs('[data-el="card"]', root);
  const fieldText = qs('[data-el="field-text"]', root);
  const caret = qs('[data-el="caret"]', root);
  const reveal = qs('[data-el="reveal"]', root);
  const destMe = qs('[data-el="dest-me"]', root);
  const destTeam = qs('[data-el="dest-team"]', root);
  const save = qs('[data-el="save"]', root);
  const myPin = qs('[data-el="my-pin"]', root);
  const otherPin = qs('[data-el="other-pin"]', root);
  const title = qs('.ui-page__title', root);

  if (!target || !card || !destTeam || !myPin) return null;

  const rtl = document.documentElement.dir === 'rtl';
  const flip = rtl ? -1 : 1;

  /* A rebuild (a resize, a change of language) starts from the stylesheet's
     places, not from where the last build parked things. */
  gsap.set([card, myPin, otherPin, hint], { clearProps: 'transform' });

  const targetBox = rectIn(root, target);
  const titleBox = rectIn(root, title);
  /* The card and what the hand will press in it, measured at full size before
     it is parked and shrunk: offsets taken afterwards were off by the move. */
  const cardBox = rectIn(root, card);
  const destBox = rectIn(root, destTeam);
  const saveBox = rectIn(root, save);
  const windowBox = rectIn(root, qs('.ui-window', root));
  const rootWidth = root.getBoundingClientRect().width;

  /* A face in the margin of what it marks, kept inside the window it
     annotates — the same rule as every mark on this page. */
  const marginOf = (box) => ({
    x: gsap.utils.clamp(
      windowBox.x + 3,
      windowBox.x + windowBox.width - 31,
      rtl ? box.x + box.width + 6 : box.x - 34,
    ),
    y: box.y - 2,
  });

  const places = {
    card: {
      x: gsap.utils.clamp(
        12,
        Math.max(12, rootWidth - cardBox.width - 12),
        targetBox.centerX - cardBox.width / 2,
      ),
      y: targetBox.y + targetBox.height + 12,
    },
    myPin: marginOf(targetBox),
    otherPin: marginOf(titleBox),
    hint: { x: windowBox.x + windowBox.width / 2 - 40, y: windowBox.y + 46 },
  };

  gsap.set([card, myPin, otherPin, hint], { top: 0, left: 0 });
  gsap.set(card, { x: places.card.x, y: places.card.y, scale: 0.96, opacity: 0 });
  gsap.set(myPin, { x: places.myPin.x, y: places.myPin.y, scale: 0.5, opacity: 0 });
  gsap.set(otherPin, { x: places.otherPin.x, y: places.otherPin.y, scale: 1, opacity: 1 });
  gsap.set(hint, { x: places.hint.x, y: places.hint.y, scale: 0.96, opacity: 0 });
  gsap.set(frame, { opacity: 0 });
  gsap.set(reveal, { scaleX: 1 });
  gsap.set(caret, { opacity: 0, x: 0 });

  const chooseMe = () => {
    destMe?.classList.add('is-on');
    destTeam.classList.remove('is-on');
    save?.classList.remove('is-team');
  };
  const chooseTeam = () => {
    destMe?.classList.remove('is-on');
    destTeam.classList.add('is-on');
    save?.classList.add('is-team');
  };
  chooseMe();

  if (prefersReducedMotion()) {
    gsap.set(myPin, { opacity: 1, scale: 1 });
    return gsap.timeline({ paused: true });
  }

  const cursor = createDemoCursor(root);
  const textWidth = fieldText ? Math.min(rectIn(root, fieldText).width, cardBox.width - 30) : 120;
  const rest = { x: targetBox.centerX - 50 * flip, y: windowBox.y + windowBox.height + 24 };
  /* Where something in the card will be once it stands at its place. */
  const inCard = (box) => ({
    x: places.card.x + (box.centerX - cardBox.x),
    y: places.card.y + (box.centerY - cardBox.y),
  });

  cursor?.placeAt(rest);

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });

  /* 1 — called up from the keyboard. */
  tl.to(hint, { opacity: 1, scale: 1, duration: 0.26, ease: 'power3.out' }, 0.25)
    .to(hint, { scale: 0.94, duration: 0.1, ease: 'power2.in' }, '>+0.4')
    .to(hint, { scale: 1, duration: 0.16, ease: 'back.out(2)' }, '>');
  cursor?.enter(tl, '<');

  /* 2 — the frame finds the paragraph. */
  cursor?.moveTo(
    tl,
    { x: targetBox.centerX, y: targetBox.centerY },
    { at: '>+0.1', bend: 0.8, label: 'over' },
  );
  tl.to(frame, { opacity: 1, duration: 0.16 }, 'over-=0.1').to(
    hint,
    { opacity: 0, y: places.hint.y - 8, duration: 0.24 },
    '<',
  );
  cursor?.settle(tl, { duration: 0.18 });
  cursor?.press(tl, {});

  /* 3 — the composer, and a line written into it. */
  tl.to(card, { opacity: 1, scale: 1, duration: 0.32, ease: 'power3.out' }, '>-0.08')
    .to(caret, { opacity: 1, duration: 0.12 }, '>')
    .to(reveal, { scaleX: 0, duration: 1.3, ease: 'steps(22)' }, '>')
    .to(caret, { x: textWidth * flip, duration: 1.3, ease: 'steps(22)' }, '<')
    .to(caret, { opacity: 0, duration: 0.16 }, '>-0.06');

  /* 4 — the new choice: for the circle, not just for me. */
  cursor?.moveTo(tl, inCard(destBox), { at: '>+0.05', bend: -1, label: 'overTeam' });
  cursor?.settle(tl, {});
  cursor?.press(tl, {});
  tl.call(chooseTeam, null, '<+0.04');

  /* 5 — saved, and shared. */
  cursor?.moveTo(tl, inCard(saveBox), { at: '>+0.25', bend: 1 });
  cursor?.settle(tl, {});
  cursor?.hover(tl, save, true, {});
  cursor?.press(tl, { target: save });

  tl.to(card, { opacity: 0, scale: 0.96, y: places.card.y - 6, duration: 0.26 }, '>-0.05')
    .to(frame, { opacity: 0, duration: 0.3 }, '<')
    /* What it leaves: your face beside the paragraph, next to everyone
       else's on the page. */
    .to(myPin, { opacity: 1, scale: 1, duration: 0.42, ease: 'back.out(2.4)' }, '<+0.12')
    .to({}, { duration: 1.8 });

  /* 6 — the seam. */
  cursor?.exit(tl, '>');
  tl.to(myPin, { opacity: 0, scale: 0.7, duration: 0.4 }, '<')
    .set(myPin, { scale: 0.5 })
    .set(reveal, { scaleX: 1 })
    .set(caret, { x: 0 })
    .set(card, { y: places.card.y })
    .set(hint, { y: places.hint.y })
    .call(() => {
      chooseMe();
      save?.classList.remove('is-hover');
      cursor?.placeAt(rest);
    });

  return tl;
}
