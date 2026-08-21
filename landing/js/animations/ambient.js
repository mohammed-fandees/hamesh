/**
 * Ambient motion — the reason a scene feels alive between interactions.
 *
 * The rule that keeps this from becoming noise: nothing shares a duration and
 * nothing shares a phase. Elements drifting in unison read as one object
 * wobbling; the same elements on unrelated clocks read as depth. Amplitudes
 * stay in single-digit pixels — if you can catch a layer moving while reading
 * the copy beside it, it is too much.
 */

import { gsap } from '../lib/gsap.js';
import { prefersReducedMotion } from '../lib/motion.js';

/**
 * Float the depth sheets behind a scene, plus the window itself, each on its
 * own slow cycle. Returns a timeline-like handle the caller can pause.
 */
export function createAmbientDrift(scene) {
  if (prefersReducedMotion()) return { pause() {}, resume() {}, kill() {} };

  const tweens = [];

  const layers = scene.querySelectorAll('.scene__layer');
  layers.forEach((layer, index) => {
    tweens.push(
      gsap.to(layer, {
        y: index % 2 === 0 ? -9 : 7,
        rotation: index % 2 === 0 ? -0.6 : 0.5,
        duration: 5.4 + index * 1.7,
        delay: index * 0.9,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      }),
    );
  });

  const window_ = scene.querySelector('.ui-window');
  if (window_) {
    tweens.push(
      gsap.to(window_, {
        y: -6,
        duration: 6.8,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      }),
    );
  }

  /* The video demo's light source drifts on its own, far slower than
     anything else, so the picture never looks like a still. */
  const glow = scene.querySelector('.ui-video__glow');
  if (glow) {
    tweens.push(
      gsap.to(glow, {
        xPercent: 6,
        yPercent: -5,
        scale: 1.12,
        duration: 11,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      }),
    );
  }

  return {
    pause: () => tweens.forEach((t) => t.pause()),
    resume: () => tweens.forEach((t) => t.resume()),
    kill: () => tweens.forEach((t) => t.kill()),
  };
}

/**
 * The hero's single background wash. One element, one transform, very slow —
 * enough to keep the top of the page from feeling like a screenshot.
 */
export function createHeroGlowDrift(glow) {
  if (!glow || prefersReducedMotion()) return { kill() {} };

  const tween = gsap.to(glow, {
    xPercent: 4,
    yPercent: 6,
    scale: 1.08,
    duration: 14,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut',
  });

  return { kill: () => tween.kill() };
}
