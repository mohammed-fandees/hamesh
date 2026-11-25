/**
 * The hero.
 *
 * One timeline, not a chain of timeouts: the copy resolves, the scene arrives
 * from depth and settles, and only then do the demos start telling their
 * story.
 *
 * The timeline is built paused and handed to the intro, which plays it while
 * the loading screen is still on its way out — so the page arrives as one
 * movement rather than as a loader that leaves and a hero that then begins.
 *
 * The install link is in the first beat. Whatever else the page does, it must
 * not make someone wait through an animation to find out how to get the
 * thing.
 */

import { gsap } from '../lib/gsap.js';
import { qs, qsa } from '../lib/dom.js';
import { prefersReducedMotion, debounce } from '../lib/motion.js';
import { createHeroRotator } from './hero-tabs.js';
import { fitHero } from './hero-fit.js';

export function createHeroIntro(hero) {
  const scene = qs('.hero__scene', hero);
  const lines = qsa('[data-hero-line]', hero);
  /* Masked lines slide; the call to action only fades, because the mask that
     makes a slide look clean would also clip its focus ring. */
  const fades = qsa('[data-hero-fade]', hero);

  /* Sized before the first demo measures anything inside the window. */
  let scale = fitHero(hero);
  let width = window.innerWidth;
  const rotator = createHeroRotator(scene);

  function rebuild() {
    scale = fitHero(hero);
    rotator.rebuild();
  }

  /* Rebuilt only when something the demos measured has moved: a phone's
     address bar resizes the window as it scrolls. */
  function refit() {
    const next = fitHero(hero);
    if (next === scale && window.innerWidth === width) return;
    scale = next;
    width = window.innerWidth;
    rotator.rebuild();
  }

  window.addEventListener('resize', debounce(refit, 220));
  /* The words take a different height once their own faces arrive. */
  document.fonts?.ready.then(refit);

  const api = {
    timeline: null,
    rebuild,
    pause: rotator.pause,
    resume: rotator.resume,
  };

  if (prefersReducedMotion()) {
    gsap.set([...lines, ...fades], { opacity: 1, y: 0 });
    gsap.set(scene, { opacity: 1 });
    return api;
  }

  /* How far the scene travels in from depth, by screen size. A 420px push on
     a phone is most of the viewport's width in perspective terms: it reads as
     a lurch, and it is the kind of value that only ever looked right on the
     machine it was written on. */
  const depth = window.matchMedia('(max-width: 768px)').matches ? -150 : -420;
  const lift = window.matchMedia('(max-width: 768px)').matches ? 26 : 54;

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });

  /* 1 — the words. Each line is masked by its own wrapper, so the transform
     lands on a box and never on a text node. */
  tl.from(lines, { yPercent: 118, opacity: 0, duration: 0.8, stagger: 0.075 }, 0.05).from(
    fades,
    { opacity: 0, y: 14, duration: 0.6, stagger: 0.08 },
    '>-0.45',
  );

  /* 2 — the product arrives from behind the page and settles. */
  tl.from(
    scene,
    { opacity: 0, z: depth, y: lift, rotateX: 7, duration: 1.05, ease: 'power3.out' },
    '<+0.2',
  );

  /* 3 — and only now does the story begin, once, as the scene settles. */
  tl.call(rotator.start, null, '>-0.25');

  api.timeline = tl;
  return api;
}
