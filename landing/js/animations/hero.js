/**
 * The hero.
 *
 * One timeline, not a chain of timeouts: the copy resolves, the scene arrives
 * from depth and settles, ambient drift takes over, and only then does the
 * demo start telling its story. Each beat is anchored to the one before it,
 * so the whole opening can be slowed, paused or replayed as a unit.
 *
 * The install link is in the first beat. Whatever else the page does, it must
 * not make someone wait through an animation to find out how to get the
 * thing.
 */

import { gsap } from '../lib/gsap.js';
import { qs, qsa } from '../lib/dom.js';
import { createHeroGlowDrift, createAmbientDrift } from './ambient.js';
import { prefersReducedMotion, whenVisible, debounce } from '../lib/motion.js';
import { createContextualNoteDemo } from '../demos/contextual-note.js';

export function createHeroIntro(hero) {
  const scene = qs('.hero__scene', hero);
  const demoRoot = qs('.demo', hero);
  const glow = qs('.hero__glow', hero);
  const lines = qsa('[data-hero-line]', hero);
  /* Masked lines slide; the call to action only fades, because the mask that
     makes a slide look clean would also clip its focus ring. */
  const fades = qsa('[data-hero-fade]', hero);

  let demo = null;
  let ambient = null;
  let visible = false;

  function buildDemo() {
    demo?.kill();
    ambient?.kill();
    demo = demoRoot ? createContextualNoteDemo(demoRoot) : null;
    ambient = scene ? createAmbientDrift(scene) : null;
    if (!visible) {
      demo?.pause();
      ambient?.pause();
    }
  }

  buildDemo();

  createHeroGlowDrift(glow);

  if (prefersReducedMotion()) {
    gsap.set([...lines, ...fades], { opacity: 1, y: 0 });
    gsap.set(scene, { opacity: 1 });
    return null;
  }

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  /* 1 — the words. Each line is masked by its own wrapper, so the transform
     lands on a box and never on a text node. */
  tl.from(lines, { yPercent: 118, opacity: 0, duration: 0.8, stagger: 0.075 }, 0.1).from(
    fades,
    { opacity: 0, y: 14, duration: 0.6, stagger: 0.08 },
    '>-0.45',
  );

  /* 2 — the product arrives from behind the page and settles. */
  if (scene) {
    tl.from(
      scene,
      { opacity: 0, z: -420, y: 54, rotateX: 9, duration: 1.15, ease: 'power3.out' },
      '<+0.25',
    );
  }

  /* 3 — it is alive before it is busy: drift first, story second. */
  tl.call(() => ambient?.resume(), null, '>-0.35');
  tl.call(() => visible && demo?.play(), null, '>-0.1');

  /* Off screen it stops; back on screen it picks the story up from the top. */
  whenVisible(hero, {
    threshold: 0.15,
    onEnter: () => {
      visible = true;
      ambient?.resume();
      if (demo && !demo.isActive()) demo.restart();
    },
    onLeave: () => {
      visible = false;
      demo?.pause();
      ambient?.pause();
    },
  });

  window.addEventListener('resize', debounce(buildDemo, 220));

  return {
    rebuild: buildDemo,
    pause: () => {
      demo?.pause();
      ambient?.pause();
    },
    resume: () => {
      if (!visible) return;
      demo?.play();
      ambient?.resume();
    },
  };
}
