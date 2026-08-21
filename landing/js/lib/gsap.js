/**
 * GSAP, registered once.
 *
 * The library and its plugins are vendored into `js/vendor/` and loaded as
 * classic scripts before this module runs, so they arrive as globals. A page
 * whose entire claim is that nothing about you leaves your machine has no
 * business fetching its animation engine from someone else's CDN.
 */

const { gsap, ScrollTrigger, MotionPathPlugin } = window;

if (!gsap) {
  throw new Error('GSAP failed to load — check js/vendor/gsap.min.js');
}

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

/* One shared default so easings stay consistent across every timeline.
   `power2.out` is the closest match to the extension's own easing curve. */
gsap.defaults({ ease: 'power2.out', duration: 0.5 });

export { gsap, ScrollTrigger, MotionPathPlugin };
