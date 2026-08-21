/**
 * Scroll behaviour and pointer parallax.
 *
 * Nothing on this page is scrubbed. Scroll decides *when* something starts,
 * never how far along it is: a demo tied to the wheel stalls mid-gesture the
 * moment the visitor stops, and hands them the pacing of a story they have not
 * read yet. So each scene gets one entrance as it arrives, and then runs on
 * its own clock.
 */

import { gsap, ScrollTrigger } from '../lib/gsap.js';
import { qsa } from '../lib/dom.js';
import { prefersReducedMotion, isCoarsePointer } from '../lib/motion.js';

/**
 * Each scene arrives once, from depth — the same move the hero's does, so the
 * page reads as one space rather than a series of unrelated panels.
 */
export function createSceneEntrances(selector = '[data-reveal-scene]') {
  if (prefersReducedMotion()) return;

  qsa(selector).forEach((stage) => {
    gsap.from(stage, {
      opacity: 0,
      z: -260,
      y: 40,
      rotateX: 6,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: stage, start: 'top 82%', once: true },
    });
  });
}

/**
 * A few degrees of tilt following the pointer, so a stage reads as a thing
 * standing in space rather than a picture pasted on the page.
 *
 * `quickTo` keeps this to one interpolated write per frame instead of a new
 * tween per mousemove, and the rotation is capped low on purpose: past about
 * five degrees it stops feeling like depth and starts feeling like a toy.
 * Each stage only listens while it is near the viewport.
 */
export function createPointerTilt(selector = '.stage__tilt', { maxTilt = 4.5 } = {}) {
  if (prefersReducedMotion() || isCoarsePointer()) return () => {};

  const stages = qsa(selector).map((stage) => ({
    stage,
    live: false,
    rotateX: gsap.quickTo(stage, 'rotateX', { duration: 0.9, ease: 'power3.out' }),
    rotateY: gsap.quickTo(stage, 'rotateY', { duration: 0.9, ease: 'power3.out' }),
  }));

  stages.forEach((entry) => {
    ScrollTrigger.create({
      trigger: entry.stage,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => {
        entry.live = self.isActive;
        if (!self.isActive) {
          entry.rotateX(0);
          entry.rotateY(0);
        }
      },
    });
  });

  function onMove(event) {
    for (const entry of stages) {
      if (!entry.live) continue;
      const box = entry.stage.getBoundingClientRect();
      const dx = (event.clientX - (box.left + box.width / 2)) / (box.width / 2);
      const dy = (event.clientY - (box.top + box.height / 2)) / (box.height / 2);

      /* Pointer right tilts the scene away to the right, as a hinged panel
         would — the near edge follows the hand. */
      entry.rotateY(gsap.utils.clamp(-1, 1, dx) * maxTilt);
      entry.rotateX(gsap.utils.clamp(-1, 1, dy) * -maxTilt * 0.7);
    }
  }

  function onLeave() {
    stages.forEach((entry) => {
      entry.rotateX(0);
      entry.rotateY(0);
    });
  }

  window.addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('mouseleave', onLeave);

  return () => {
    window.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseleave', onLeave);
  };
}

/**
 * One short reveal per block on first sight. Deliberately plain: the demos are
 * what should hold attention, not the copy sliding around them.
 */
export function createSectionReveals(selector = '[data-reveal]') {
  if (prefersReducedMotion()) return;

  qsa(selector).forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 22,
      duration: 0.7,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 86%', once: true },
    });
  });
}
