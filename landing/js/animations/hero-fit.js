/**
 * On a desktop the whole hero fits the screen: the words keep their size and
 * the demo window is scaled to the height that is left. A phone scrolls.
 */

import { qs } from '../lib/dom.js';

/* Below this the page inside the window stops being readable. */
const SMALLEST = 0.6;
const DESKTOP = '(min-width: 861px)';

/** Sets `--hero-scale` on the hero and returns it. */
export function fitHero(hero) {
  const inner = qs('.hero__inner', hero);
  const stage = qs('.hero__stage', hero);
  hero.style.removeProperty('--hero-scale');
  if (!inner || !stage || !window.matchMedia(DESKTOP).matches) return 1;

  const natural = stage.offsetHeight;
  const style = window.getComputedStyle(hero);
  const around =
    inner.offsetHeight - natural + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const header = qs('.site-header')?.offsetHeight ?? 0;
  const room = window.innerHeight - header - around;
  const scale = Math.min(1, Math.max(SMALLEST, room / natural));

  hero.style.setProperty('--hero-scale', scale.toFixed(4));
  return scale;
}
