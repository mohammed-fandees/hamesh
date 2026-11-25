/** The header's install link appears once the hero's has scrolled out of view. */

import { whenVisible } from './lib/motion.js';

export function createNavCta(link, heroCta) {
  if (!link || !heroCta) return;
  whenVisible(heroCta, {
    threshold: 0,
    onEnter: () => link.classList.remove('is-shown'),
    onLeave: () => link.classList.add('is-shown'),
  });
}
