/** Small DOM helpers shared by the demos. */

export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/**
 * `el`'s box in `root`'s coordinate space.
 *
 * The demos position a cursor and a note card against elements that sit
 * inside a 3D-transformed stage, where offsetTop/offsetLeft stop meaning what
 * you expect. Two rects subtracted give the honest answer.
 */
export function rectIn(root, el) {
  const base = root.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  return {
    x: box.left - base.left,
    y: box.top - base.top,
    width: box.width,
    height: box.height,
    centerX: box.left - base.left + box.width / 2,
    centerY: box.top - base.top + box.height / 2,
  };
}

/** The centre of `el`, in `root`'s coordinates. */
export function centerIn(root, el) {
  const { centerX, centerY } = rectIn(root, el);
  return { x: centerX, y: centerY };
}

/**
 * Where a pointer would sit to click `el`: its centre, nudged up and toward
 * the reading direction, so the arrow's tip lands on the control rather than
 * its own hotspot sitting dead centre.
 */
export function pointerTarget(root, el, { dx = 0, dy = 0 } = {}) {
  const rect = rectIn(root, el);
  return { x: rect.centerX + dx, y: rect.centerY + dy };
}

/** Add a class for the length of a tween, and take it off afterwards. */
export function toggleClass(el, name, on) {
  if (!el) return;
  el.classList.toggle(name, on);
}
