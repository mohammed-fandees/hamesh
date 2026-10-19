/**
 * Entry point.
 *
 * Wires the page together and does nothing clever itself: the hero owns its
 * intro, each scene owns its story, scroll owns when things start, and this
 * file only introduces them to each other.
 *
 * Order matters in two places.
 *
 * The language is applied before anything is built, because every demo
 * measures real elements to place its cursor and cards — and in Arabic all of
 * that mirrors. Building first and switching afterwards leaves each demo
 * reaching for where things used to be.
 *
 * Everything else is built inside `runIntro`, while the loading screen still
 * covers the page. Building is when GSAP snaps a dozen elements back to their
 * starting positions; done in the open, that is a visible flash followed by a
 * jump.
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
import { runIntro } from './animations/intro.js';
import { ScrollTrigger } from './lib/gsap.js';
import { onTabVisibilityChange, onMotionPreferenceChange } from './lib/motion.js';
import { createPlans } from './plans.js';

async function boot() {
  let heroIntro = null;
  let scenes = null;
  let plans = null;

  /* Applies the visitor's saved language and sets `dir` before a single
     position is measured. The handler below only runs on a later toggle. */
  createLanguageToggle({
    onChange: () => {
      plans?.render();
      heroIntro?.rebuild();
      scenes?.rebuild();
      ScrollTrigger.refresh();
    },
  });

  /* Asked for now, so the answer is often in before anyone scrolls to it. */
  const plansSection = qs('#plans');
  plans = plansSection ? createPlans(plansSection) : null;
  /* The cards may not be the outlines' exact height; triggers below them move. */
  plans?.ready.then(() => ScrollTrigger.refresh());

  await runIntro({
    build: () => {
      const hero = qs('.hero');
      heroIntro = hero ? createHeroIntro(hero) : null;
      scenes = createFeatureScenes();

      createSceneEntrances();
      createPointerTilt();
      createSectionReveals();

      return heroIntro?.timeline ?? null;
    },
  });

  /* The loader was covering a page whose fonts may have settled underneath
     it; every trigger position is measured against the layout that resulted. */
  ScrollTrigger.refresh();

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
