/**
 * Demo — the Notes Library.
 *
 * The other three demos are about making a note. This one is about living
 * with a few hundred of them: search narrows the list, the rows that no
 * longer match step aside, and one note gets pinned to the top so it is
 * waiting next time.
 *
 * Rows never change height or position in layout — they are moved on `y` and
 * faded, so a list that reflows visually costs nothing to reflow.
 */

import { gsap } from '../lib/gsap.js';
import { qs, qsa, rectIn } from '../lib/dom.js';
import { createDemoCursor } from '../animations/cursor.js';
import { prefersReducedMotion } from '../lib/motion.js';

export function createNoteManagementDemo(root) {
  const search = qs('[data-el="search"]', root);
  const searchReveal = qs('[data-el="search-reveal"]', root);
  const searchCaret = qs('[data-el="search-caret"]', root);
  const rows = qsa('[data-el="row"]', root);
  const sites = qsa('[data-el="site"]', root);

  if (!search || rows.length < 3) return null;

  const [match, ...others] = [rows[1], rows[0], rows[2]];
  const pin = qs('[data-el="pin"]', match);

  const rowGap = 8;
  const rowHeight = rectIn(root, rows[0]).height + rowGap;

  gsap.set(rows, { opacity: 1, y: 0, scale: 1 });
  gsap.set(searchReveal, { scaleX: 1 });
  gsap.set(searchCaret, { opacity: 0 });
  gsap.set(pin, { opacity: 0, scale: 0.6 });

  if (prefersReducedMotion()) {
    gsap.set(searchReveal, { scaleX: 0 });
    gsap.set(others, { opacity: 0.25 });
    gsap.set(pin, { opacity: 1, scale: 1 });
    match.classList.add('is-focus');
    return gsap.timeline({ paused: true });
  }

  const cursor = createDemoCursor(root);
  const searchBox = rectIn(root, search);
  const matchBox = rectIn(root, match);
  const pinBox = pin ? rectIn(root, pin) : matchBox;

  cursor?.placeAt({ x: searchBox.centerX, y: searchBox.y + 150 });

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });

  /* 1 — into the search field. */
  cursor?.enter(tl, 0.1);
  cursor?.moveTo(tl, { x: searchBox.x + 40, y: searchBox.centerY }, { at: 0.25, bend: 1 });
  cursor?.settle(tl, {});
  cursor?.press(tl, {});

  /* 2 — typing a word that only one note contains. */
  tl.to(searchCaret, { opacity: 1, duration: 0.12 }, '>')
    .to(searchReveal, { scaleX: 0, duration: 0.72, ease: 'steps(9)' }, '>')
    .to(searchCaret, { opacity: 0, duration: 0.14 }, '>');

  /* 3 — the list narrows. The two that no longer match fade back rather than
     vanish, and the survivor rises into their place. */
  tl.to(others, { opacity: 0.12, scale: 0.985, duration: 0.34, stagger: 0.05 }, '>-0.1').to(
    match,
    { y: -rowHeight, duration: 0.42, ease: 'power2.inOut' },
    '<+0.06',
  );

  tl.call(() => match.classList.add('is-focus'), null, '>-0.15');

  /* 4 — pinning it, so it is at the top next time. */
  cursor?.moveTo(
    tl,
    { x: pinBox.centerX, y: pinBox.centerY - rowHeight },
    { at: '>+0.1', bend: -1 },
  );
  cursor?.settle(tl, {});
  cursor?.press(tl, {});

  tl.to(pin, { opacity: 1, scale: 1, duration: 0.32, ease: 'back.out(2.4)' }, '>-0.12').to(
    {},
    { duration: 1.3 },
  );

  /* 5 — and the site list keeps its own count of where notes live. */
  if (sites.length > 1) {
    tl.call(
      () => {
        sites.forEach((s) => s.classList.remove('is-active'));
        sites[1].classList.add('is-active');
      },
      null,
      '>-1.1',
    );
  }

  /* 6 — the seam: clear the search and let the list settle back, all while
     the cursor is already on its way out. */
  cursor?.exit(tl, '>');
  tl.to(match, { y: 0, duration: 0.44, ease: 'power2.inOut' }, '<')
    .to(others, { opacity: 1, scale: 1, duration: 0.4 }, '<')
    .to(pin, { opacity: 0, duration: 0.34 }, '<')
    .call(() => {
      match.classList.remove('is-focus');
      sites.forEach((s, i) => s.classList.toggle('is-active', i === 0));
    })
    .set(searchReveal, { scaleX: 1 })
    .set(pin, { scale: 0.6 })
    .call(() => cursor?.placeAt({ x: searchBox.centerX, y: searchBox.y + 150 }));

  return tl;
}
