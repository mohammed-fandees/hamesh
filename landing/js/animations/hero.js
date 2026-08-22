/**
 * The hero.
 *
 * One timeline, not a chain of timeouts: the copy resolves, the scene arrives
 * from depth and settles, and only then does the demo start telling its
 * story — once.
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
import { prefersReducedMotion, whenVisible, debounce } from '../lib/motion.js';
import { createContextualNoteDemo } from '../demos/contextual-note.js';

export function createHeroIntro(hero) {
  const scene = qs('.hero__scene', hero);
  const demoRoot = qs('.demo', hero);
  const lines = qsa('[data-hero-line]', hero);
  /* Masked lines slide; the call to action only fades, because the mask that
     makes a slide look clean would also clip its focus ring. */
  const fades = qsa('[data-hero-fade]', hero);

  let demo = null;
  let visible = true;
  /* The demo is started once, by the intro, when the loading screen hands the
     page over. Without this the visibility observer starts it the moment the
     page loads — behind the loader — and the intro then restarts it in front
     of the visitor, which looks exactly like the animation glitching and
     beginning again. */
  let handedOver = false;

  function buildDemo() {
    demo?.kill();
    demo = demoRoot ? createContextualNoteDemo(demoRoot) : null;
    if (!handedOver || !visible) demo?.pause();
  }

  buildDemo();

  const api = {
    timeline: null,
    rebuild: buildDemo,
    pause: () => demo?.pause(),
    resume: () => {
      if (!visible || !handedOver) return;
      demo?.play();
    },
  };

  if (prefersReducedMotion()) {
    gsap.set([...lines, ...fades], { opacity: 1, y: 0 });
    gsap.set(scene, { opacity: 1 });
    handedOver = true;
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
  if (scene) {
    tl.from(
      scene,
      { opacity: 0, z: depth, y: lift, rotateX: 7, duration: 1.05, ease: 'power3.out' },
      '<+0.2',
    );
  }

  /* 3 — and only now does the story begin, once, as the scene settles. */
  tl.call(
    () => {
      handedOver = true;
      if (visible) demo?.restart();
    },
    null,
    '>-0.25',
  );

  /* Off screen it stops; back on screen it picks the story up from the top. */
  whenVisible(hero, {
    threshold: 0.15,
    onEnter: () => {
      visible = true;
      /* Resumed, not restarted: coming back to the hero should not rewind a
         story that is halfway through, and before the hand-over there is
         nothing to resume yet. */
      if (handedOver) demo?.play();
    },
    onLeave: () => {
      visible = false;
      demo?.pause();
    },
  });

  window.addEventListener('resize', debounce(buildDemo, 220));

  api.timeline = tl;
  return api;
}
