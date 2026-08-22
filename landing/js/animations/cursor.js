/**
 * The cursor inside the product demos.
 *
 * This is not the visitor's pointer — it is the one in the story, and it has
 * to read as a hand rather than a playhead. Three things do most of that
 * work:
 *
 *   1. It travels on a slight arc, never a ruled line. Real pointing is
 *      never straight, and a straight glide is the single clearest tell that
 *      something was animated rather than done.
 *   2. It settles before it clicks. The pause is short — around a tenth of a
 *      second — but without it the click lands while the cursor is still
 *      moving, which no hand does.
 *   3. It moves at a speed that depends on distance, easing out of rest and
 *      into the target, so a short hop and a long sweep do not take the same
 *      time.
 *
 * Every helper writes into a timeline the caller owns, so a demo stays one
 * timeline that can be paused, resumed, scrubbed or thrown away.
 */

import { gsap } from '../lib/gsap.js';
import { qs } from '../lib/dom.js';

/** Pixels per second the cursor travels, before easing. */
const SPEED = 620;
const MIN_TRAVEL = 0.34;
const MAX_TRAVEL = 0.95;

/**
 * Three points describing a gentle arc between two positions.
 *
 * The middle point is pushed perpendicular to the line of travel, by an
 * amount that grows with distance but is capped — a long sweep bows a
 * little, a short hop stays almost straight.
 */
function arcThrough(from, to, bend) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const offset = bend * Math.min(distance * 0.2, 44);

  return [
    { x: from.x, y: from.y },
    {
      x: (from.x + to.x) / 2 - (dy / distance) * offset,
      y: (from.y + to.y) / 2 + (dx / distance) * offset,
    },
    { x: to.x, y: to.y },
  ];
}

function travelTime(from, to) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return gsap.utils.clamp(MIN_TRAVEL, MAX_TRAVEL, distance / SPEED);
}

export function createDemoCursor(root) {
  const el = qs('.demo-cursor', root);
  if (!el) return null;

  const arrow = qs('.demo-cursor__arrow', el);
  const ring = qs('.demo-cursor__ring', el);

  /* Where the cursor is as the timeline is being built. Timelines are built
     ahead of time from measured positions, so this walks the same route the
     playhead will. */
  let point = { x: 0, y: 0 };

  const api = {
    el,

    /** Put the cursor somewhere without animating — for the initial state.
     *  Kept inside the demo: a resting position a few pixels outside it is
     *  invisible either way, but in RTL it is scrollable overflow. */
    placeAt(target) {
      const width = root.getBoundingClientRect().width;
      point = {
        x: gsap.utils.clamp(2, Math.max(2, width - 22), target.x),
        y: target.y,
      };
      gsap.set(el, { x: point.x, y: point.y, opacity: 0 });
      gsap.set(arrow, { scale: 1 });
      gsap.set(ring, { opacity: 0, scale: 0.4 });
      return api;
    },

    /** Fade in where it already stands. */
    enter(tl, at, { duration = 0.36 } = {}) {
      tl.to(el, { opacity: 1, duration }, at);
      return api;
    },

    /** Fade out; the demo is done with it for this cycle. */
    exit(tl, at, { duration = 0.4 } = {}) {
      tl.to(el, { opacity: 0, duration }, at);
      return api;
    },

    /**
     * Glide to a point along an arc.
     *
     * `bend` flips sign per call site so consecutive moves do not all bow the
     * same way, which would read as a pattern of its own.
     */
    moveTo(tl, target, { at, bend = 1, duration, ease = 'power2.inOut', label } = {}) {
      const path = arcThrough(point, target, bend);
      tl.to(
        el,
        {
          motionPath: { path, curviness: 1.3, autoRotate: false },
          duration: duration ?? travelTime(point, target),
          ease,
        },
        at,
      );
      /* A label at the moment the cursor arrives. Whatever the pointer is
         meant to affect — an outline lighting up, a control reacting — can
         then be pinned to that instant. Hanging it off `'>'` instead means
         it fires relative to whichever tween was added last, which drifts as
         soon as anything else joins the timeline, and reads as lag between
         the hand and what it is touching. */
      if (label) tl.addLabel(label);
      point = { x: target.x, y: target.y };
      return api;
    },

    /** A brief stillness. Nothing clicks the instant it arrives. */
    settle(tl, { at, duration = 0.12 } = {}) {
      tl.to(el, { duration }, at);
      return api;
    },

    /** Mark what the cursor is over, so the control can light up. */
    hover(tl, target, on = true, { at } = {}) {
      if (!target) return api;
      tl.call(() => target.classList.toggle('is-hover', on), null, at);
      return api;
    },

    /**
     * A click: the arrow dips, a ring pushes out from under it, and the
     * pressed control is released a beat later.
     */
    press(tl, { at, target } = {}) {
      const label = at ?? '>';
      tl.to(arrow, { scale: 0.8, duration: 0.09, ease: 'power2.out' }, label)
        .to(arrow, { scale: 1, duration: 0.26, ease: 'back.out(2)' }, '>-0.02')
        .fromTo(
          ring,
          { opacity: 0.8, scale: 0.35 },
          { opacity: 0, scale: 1.3, duration: 0.52, ease: 'power2.out' },
          '<-0.06',
        );

      if (target) {
        tl.call(() => target.classList.remove('is-hover'), null, '<+0.18');
      }
      return api;
    },

    /**
     * A drag across text: press, sweep, release.
     *
     * Deliberately close to straight — a hand selecting words tracks the line
     * of the text, and this is the one move that should not bow.
     */
    drag(tl, from, to, { at, duration = 0.72, onSweep } = {}) {
      const label = at ?? '>';

      api.moveTo(tl, from, { at: label, bend: 0.55 });
      tl.to(arrow, { scale: 0.86, duration: 0.1 }, '>');

      const sweepAt = '>';
      api.moveTo(tl, to, { at: sweepAt, bend: 0.08, duration, ease: 'power1.inOut' });
      if (onSweep) onSweep(sweepAt, duration);

      tl.to(arrow, { scale: 1, duration: 0.2 }, '>-0.08');
      return api;
    },

    /** The point the cursor currently stands at, as the builder sees it. */
    get position() {
      return { ...point };
    },
  };

  return api;
}
