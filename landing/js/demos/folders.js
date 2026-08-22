/**
 * Demo — filing a note into a folder.
 *
 * The Library demo before this one is about finding a note. This one is about
 * putting it somewhere: the note's own menu opens in place, a folder is
 * chosen, and the note is filed without ever leaving the Library or opening
 * the page it came from.
 *
 * The folder tree stays expanded throughout. Collapsing it would mean
 * animating height, and the whole page is built on the rule that only
 * transforms and opacity move — a nested tree is better shown than performed.
 */

import { gsap } from '../lib/gsap.js';
import { qs, qsa, rectIn } from '../lib/dom.js';
import { createDemoCursor } from '../animations/cursor.js';
import { prefersReducedMotion } from '../lib/motion.js';

export function createFoldersDemo(root) {
  const more = qs('[data-el="more"]', root);
  const menu = qs('[data-el="menu"]', root);
  const items = qsa('[data-el="menu-item"]', root);
  const chip = qs('[data-el="chip"]', root);
  const count = qs('[data-el="count"]', root);
  const glow = qs('[data-el="folder-glow"]', root);

  if (!more || !menu || items.length < 3) return null;

  const target = items[1]; // "Work"

  const moreBox = rectIn(root, more);
  const menuBox = rectIn(root, menu);
  const rootWidth = root.getBoundingClientRect().width;
  const rtl = document.documentElement.dir === 'rtl';

  /* The menu hangs from the button that opened it, on the side with room. */
  const menuPlace = {
    x: gsap.utils.clamp(
      8,
      Math.max(8, rootWidth - menuBox.width - 8),
      rtl ? moreBox.x : moreBox.x + moreBox.width - menuBox.width,
    ),
    y: moreBox.y + moreBox.height + 6,
  };

  gsap.set(menu, {
    top: 0,
    left: 0,
    x: menuPlace.x,
    y: menuPlace.y,
    opacity: 0,
    scale: 0.94,
    transformOrigin: rtl ? 'left top' : 'right top',
  });
  gsap.set(chip, { opacity: 0, scale: 0.8 });
  gsap.set(glow, { opacity: 0 });
  gsap.set(more, { opacity: 0.45 });

  if (prefersReducedMotion()) {
    gsap.set(chip, { opacity: 1, scale: 1 });
    gsap.set(more, { opacity: 1 });
    if (count) count.textContent = '4';
    return gsap.timeline({ paused: true });
  }

  const cursor = createDemoCursor(root);
  const targetBox = rectIn(root, target);

  cursor?.placeAt({ x: moreBox.centerX - 60, y: moreBox.centerY + 130 });

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.7, paused: true });

  /* 1 — the note's own menu, reached from the row itself. */
  cursor?.enter(tl, 0.1);
  tl.to(more, { opacity: 1, duration: 0.3 }, 0.2);
  cursor?.moveTo(tl, { x: moreBox.centerX, y: moreBox.centerY }, { at: 0.3, bend: 1 });
  cursor?.settle(tl, {});
  cursor?.press(tl, {});

  tl.to(menu, { opacity: 1, scale: 1, duration: 0.26, ease: 'power3.out' }, '>-0.08');

  /* 2 — choosing where it belongs. */
  cursor?.moveTo(
    tl,
    { x: targetBox.x + 30, y: targetBox.centerY },
    { at: '>+0.25', bend: -0.6, label: 'overItem' },
  );
  cursor?.hover(tl, target, true, { at: 'overItem-=0.08' });
  cursor?.settle(tl, {});
  cursor?.press(tl, { target });

  /* 3 — filed. The menu closes, the row carries its folder, and the folder
     itself acknowledges the new arrival. */
  tl.to(menu, { opacity: 0, scale: 0.96, duration: 0.22 }, '>-0.05')
    .to(chip, { opacity: 1, scale: 1, duration: 0.34, ease: 'back.out(2.2)' }, '<+0.08')
    .to(glow, { opacity: 1, duration: 0.28 }, '<');

  if (count) {
    const ticker = { n: 3 };
    tl.to(
      ticker,
      {
        n: 4,
        duration: 0.3,
        ease: 'none',
        onUpdate: () => (count.textContent = String(Math.round(ticker.n))),
      },
      '<',
    );
  }

  tl.to(glow, { opacity: 0, duration: 0.5 }, '>+0.35').to({}, { duration: 1.3 });

  /* 4 — the seam. */
  cursor?.exit(tl, '>');
  tl.to(chip, { opacity: 0, duration: 0.4 }, '<')
    .to(more, { opacity: 0.45, duration: 0.4 }, '<')
    .set(chip, { scale: 0.8 })
    .set(menu, { x: menuPlace.x, y: menuPlace.y, scale: 0.94 })
    .call(() => {
      if (count) count.textContent = '3';
      cursor?.placeAt({ x: moreBox.centerX - 60, y: moreBox.centerY + 130 });
    });

  return tl;
}
