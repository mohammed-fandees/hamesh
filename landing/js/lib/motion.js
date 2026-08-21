/**
 * Motion preferences and visibility, in one place.
 *
 * Everything animated on this page asks here first. Reduced motion is not a
 * CSS-only concern: a paused-looking page that is still running a dozen
 * infinite timelines under the hood is exactly what the setting asks us not
 * to do, so the JavaScript honours it by building still states instead of
 * loops.
 */

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarseQuery = window.matchMedia('(hover: none), (pointer: coarse)');

/** True when the visitor has asked for less movement. */
export function prefersReducedMotion() {
  return reduceQuery.matches;
}

/** True for touch and other pointers that cannot hover. */
export function isCoarsePointer() {
  return coarseQuery.matches;
}

/** Re-run when the motion preference changes, without a reload. */
export function onMotionPreferenceChange(handler) {
  reduceQuery.addEventListener('change', handler);
}

/**
 * Run `onEnter` while `el` is on screen and `onLeave` when it leaves.
 *
 * Used to keep timelines paused off screen. The threshold is deliberately
 * low: a demo should already be running by the time it is properly in view,
 * not start from a standstill once it arrives.
 */
export function whenVisible(el, { onEnter, onLeave, threshold = 0.2 } = {}) {
  if (!('IntersectionObserver' in window)) {
    onEnter?.();
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onEnter?.();
        else onLeave?.();
      }
    },
    { threshold },
  );

  observer.observe(el);
  return () => observer.disconnect();
}

/**
 * Nothing should keep animating in a background tab — it burns battery for a
 * page nobody is looking at.
 */
export function onTabVisibilityChange(handler) {
  document.addEventListener('visibilitychange', () => handler(!document.hidden));
}

/** Debounce, for resize and language changes that force a rebuild. */
export function debounce(fn, wait = 180) {
  let id = 0;
  return (...args) => {
    clearTimeout(id);
    id = window.setTimeout(() => fn(...args), wait);
  };
}
