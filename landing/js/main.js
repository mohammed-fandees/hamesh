/**
 * Entry point.
 *
 * Wires the page together and does nothing clever itself: the hero owns its
 * intro, each scene owns its story, scroll owns when things start, and this
 * file only introduces them to each other.
 *
 * Order matters in exactly one place. The language is applied *before*
 * anything is built, because every demo measures real elements to place its
 * cursor and cards — and in Arabic all of that mirrors. Building first and
 * switching afterwards leaves each demo pointing at where things used to be.
 */

import { qs } from './lib/dom.js';
import { createLanguageToggle } from './lib/i18n.js';
import { createHeroIntro } from './animations/hero.js';
import { createFeatureScenes } from './animations/features.js';
import {
  createSceneEntrances,
  createPointerTilt,
  createSectionReveals,
} from './animations/scroll.js';
import { ScrollTrigger } from './lib/gsap.js';
import { onTabVisibilityChange, onMotionPreferenceChange } from './lib/motion.js';

function boot() {
  let heroIntro = null;
  let scenes = null;

  /* Applies the visitor's saved language and sets `dir` before a single
     position is measured. The handler below only runs on a later toggle. */
  createLanguageToggle({
    onChange: () => {
      heroIntro?.rebuild();
      scenes?.rebuild();
      ScrollTrigger.refresh();
    },
  });

  const hero = qs('.hero');
  heroIntro = hero ? createHeroIntro(hero) : null;
  scenes = createFeatureScenes();

  createSceneEntrances();
  createPointerTilt();
  createSectionReveals();

  /* A background tab should cost nothing. */
  onTabVisibilityChange((visible) => {
    if (visible) {
      heroIntro?.resume();
      scenes?.resumeAll();
    } else {
      heroIntro?.pause();
      scenes?.pauseAll();
    }
  });

  /* Someone turning reduced motion on mid-visit should get the still page,
     not the one they asked to stop. */
  onMotionPreferenceChange(() => window.location.reload());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
