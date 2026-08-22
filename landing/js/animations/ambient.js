/**
 * The one thing in a scene that moves on its own.
 *
 * There used to be more: floating layers, a bobbing window, a drifting wash
 * behind the hero. It read as slow and unfocused next to demos that are
 * trying to show a product, and the wash was quietly extending the page —
 * a 4% drift to the right grows the document in LTR and not in RTL, which is
 * why the horizontal overflow only ever appeared in English, and why it crept
 * rather than jumped.
 *
 * What is left is the light inside the video, which is not decoration: it is
 * the only thing that says the clip is playing.
 */

import { gsap } from '../lib/gsap.js';
import { prefersReducedMotion } from '../lib/motion.js';

export function createPlaybackDrift(scene) {
  const glow = scene.querySelector('.ui-video__glow');
  if (!glow || prefersReducedMotion()) {
    return { pause() {}, resume() {}, kill() {} };
  }

  const tween = gsap.to(glow, {
    xPercent: 6,
    yPercent: -5,
    scale: 1.12,
    duration: 11,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut',
  });

  return {
    pause: () => tween.pause(),
    resume: () => tween.resume(),
    kill: () => tween.kill(),
  };
}
