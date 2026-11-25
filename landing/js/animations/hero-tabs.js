/**
 * The hero's three scenes, one after another in one window.
 *
 * Each scene is a demo of its own, built from measured positions while it is
 * still hidden and played once; its tab fills as it goes. Reading with a
 * pointer or the keyboard holds the scene, and a hero nobody can see stops
 * where it is.
 */

import { gsap } from '../lib/gsap.js';
import { qs, qsa } from '../lib/dom.js';
import { prefersReducedMotion, whenVisible } from '../lib/motion.js';
import { createContextualNoteDemo } from '../demos/contextual-note.js';
import { createElementNoteDemo } from '../demos/element-note.js';
import { createQuickNoteDemo } from '../demos/quick-note.js';

const BUILDERS = [createContextualNoteDemo, createElementNoteDemo, createQuickNoteDemo];
const FADE = 0.45;

export function createHeroRotator(scene) {
  const tabs = qsa('[role="tab"]', scene);
  const panes = qsa('[data-hero-scene]', scene);
  const still = prefersReducedMotion();

  let index = 0;
  let timeline = null;
  let started = false;
  let hovered = false;
  let focused = false;
  /* Reasons nothing at all should move. */
  const stopped = new Set();

  function paint() {
    tabs.forEach((tab, i) => {
      const progress = i !== index ? 0 : still ? 1 : (timeline?.progress() ?? 0);
      qs('.hero-tab__bar', tab).style.transform = `scaleX(${progress})`;
    });
  }

  function sync() {
    if (!timeline || still) return;
    if (started && !stopped.size) timeline.play();
    else timeline.pause();
  }

  function build() {
    timeline?.kill();
    const root = qs('.demo', panes[index]);
    qsa('.is-hover', root).forEach((el) => el.classList.remove('is-hover'));
    timeline = BUILDERS[index](root) ?? null;
    if (timeline && !still) {
      timeline.repeat(0);
      timeline.eventCallback('onUpdate', paint);
      timeline.eventCallback('onComplete', finished);
    }
    paint();
  }

  function fade(pane, from, to) {
    gsap.fromTo(
      pane,
      { autoAlpha: from },
      { autoAlpha: to, duration: FADE, clearProps: 'opacity,visibility' },
    );
  }

  function show(next) {
    const previous = index;
    index = next;
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    gsap.killTweensOf(panes);
    gsap.set(panes, { clearProps: 'opacity,visibility' });
    panes.forEach((pane, i) => pane.classList.toggle('is-active', i === index));
    build();

    if (!still) {
      if (previous !== index) fade(panes[previous], 1, 0);
      fade(panes[index], 0, 1);
    }
    sync();
  }

  /* A held scene plays again instead of giving way to the next. */
  function finished() {
    if (hovered || focused) timeline.restart();
    else show((index + 1) % panes.length);
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => show(i));
    tab.addEventListener('keydown', (event) => {
      const forward = document.documentElement.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const back = forward === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
      const to = {
        [forward]: (i + 1) % tabs.length,
        [back]: (i + tabs.length - 1) % tabs.length,
        Home: 0,
        End: tabs.length - 1,
      }[event.key];
      if (to === undefined) return;
      event.preventDefault();
      tabs[to].focus();
      show(to);
    });
  });

  scene.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') hovered = true;
  });
  scene.addEventListener('pointerleave', () => (hovered = false));
  /* Only a keyboard's focus holds it: a click leaves focus behind, and a tap
     would otherwise stop the rotation for good. */
  scene.addEventListener('focusin', (event) => {
    focused = event.target.matches(':focus-visible');
  });
  scene.addEventListener('focusout', () => (focused = false));

  function hold(reason, on) {
    if (on) stopped.add(reason);
    else stopped.delete(reason);
    sync();
  }

  whenVisible(scene, {
    threshold: 0.15,
    onEnter: () => hold('offscreen', false),
    onLeave: () => hold('offscreen', true),
  });

  build();
  sync();

  return {
    /** The hand-over from the loader: the story begins, once. */
    start: () => {
      started = true;
      sync();
    },
    rebuild: () => show(index),
    pause: () => hold('hidden', true),
    resume: () => hold('hidden', false),
  };
}
