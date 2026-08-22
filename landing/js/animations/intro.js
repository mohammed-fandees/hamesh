/**
 * The intro: loader out, hero in, as one movement.
 *
 * The page opens with `<html class="is-loading">`, set by a blocking snippet
 * in the head, so the main content is hidden from the very first paint rather
 * than after a stylesheet or a module has arrived. That is the whole point:
 * without it the browser paints the finished hero, then GSAP snatches every
 * element back to its start position and plays the entrance — a flash, then a
 * jump.
 *
 * Nothing here waits for the whole page to load. It waits for the things that
 * would visibly change if they arrived late: the animation engine, the
 * timelines built from it, and the fonts, since text reflowing under a
 * finished animation is its own kind of flash.
 */

import { gsap } from '../lib/gsap.js';
import { qs } from '../lib/dom.js';
import { prefersReducedMotion } from '../lib/motion.js';

/** Longest the loader may hold the page, whatever else is still pending. */
const PATIENCE = 2600;

/**
 * Fonts, but only briefly. A late webfont reflows the hero's text, and doing
 * that under a running entrance looks like a bug; waiting forever for one is
 * worse.
 */
function fontsSettled(limit = 1200) {
  if (!document.fonts?.ready) return Promise.resolve();
  return Promise.race([
    document.fonts.ready,
    new Promise((resolve) => window.setTimeout(resolve, limit)),
  ]);
}

/**
 * Hand the page over.
 *
 * `build` is where the caller creates its timelines and applies initial
 * states — it runs while the loader is still covering everything, so the
 * repositioning it does is never seen.
 */
export async function runIntro({ build }) {
  const root = document.documentElement;
  const loader = qs('.loader');

  /* However badly the next few lines go, the page must end up usable. A
     visitor stuck behind a loading screen because a script threw has been
     given the worst possible version of an enhancement. */
  const release = () => {
    root.classList.remove('is-loading');
    root.classList.add('is-ready');
  };

  /* The document head starts a failsafe before any of this loads, for the
     case where none of it loads at all. Now that we are running, it is ours
     to cancel — and ours to honour if building takes too long. */
  window.clearTimeout(window.__hameshFailsafe);
  const failsafe = window.setTimeout(() => {
    release();
    loader?.remove();
  }, PATIENCE);

  let intro = null;
  try {
    intro = build();
    await fontsSettled();
  } catch (error) {
    console.error('[hamesh] intro build failed', error);
    window.clearTimeout(failsafe);
    release();
    loader?.remove();
    return null;
  }

  window.clearTimeout(failsafe);

  if (!loader) {
    release();
    intro?.play();
    return intro;
  }

  if (prefersReducedMotion()) {
    release();
    loader.remove();
    return intro;
  }

  /* One timeline, so the hand-over is a single movement rather than two
     animations that happen to be adjacent: the hero is already arriving
     underneath while the loader is still on its way out. */
  const handover = gsap.timeline({
    onComplete: () => loader.remove(),
  });

  handover
    .to(qs('.loader__inner', loader), {
      opacity: 0,
      y: -12,
      duration: 0.4,
      ease: 'power2.in',
    })
    .to(loader, { opacity: 0, duration: 0.55, ease: 'power2.inOut' }, '>-0.15')
    .add(() => release(), '<')
    /* Started by a callback rather than nested with `.add(intro)`: a paused
       timeline handed to a parent stays paused, and the hero would sit at the
       start values its `from` tweens had already applied — an empty page,
       held open behind a loader that had politely got out of the way. */
    .add(() => intro?.play(0), '<+0.08');

  return handover;
}
