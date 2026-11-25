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
  /* The hero's window is scaled to fit the screen. Positions are written back
     in the demo's own pixels, so what the screen measured is divided out. */
  const scale = root.offsetWidth ? base.width / root.offsetWidth : 1;
  const x = (box.left - base.left) / scale;
  const y = (box.top - base.top) / scale;
  const width = box.width / scale;
  const height = box.height / scale;
  return { x, y, width, height, centerX: x + width / 2, centerY: y + height / 2 };
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
