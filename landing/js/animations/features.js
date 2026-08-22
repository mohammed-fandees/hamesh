/**
 * The feature scenes.
 *
 * One scene per section, each owning an independent looping timeline built
 * from measured positions. Two rules keep the page cheap to run:
 *
 *   - a scene animates only while it is on screen, ambient drift included.
 *     Everything else is paused, not merely invisible.
 *   - positions are measured rather than written down, so a resize or a
 *     language switch rebuilds instead of stretching. In Arabic every one of
 *     these demos mirrors, and a rebuild is what makes that free.
 */

import { qs, qsa } from '../lib/dom.js';
import { createPlaybackDrift } from './ambient.js';
import { whenVisible, debounce } from '../lib/motion.js';
import { createContextualNoteDemo } from '../demos/contextual-note.js';
import { createElementNoteDemo } from '../demos/element-note.js';
import { createQuickNoteDemo } from '../demos/quick-note.js';
import { createNoteManagementDemo } from '../demos/note-management.js';
import { createFoldersDemo } from '../demos/folders.js';

const BUILDERS = {
  contextual: createContextualNoteDemo,
  element: createElementNoteDemo,
  quick: createQuickNoteDemo,
  library: createNoteManagementDemo,
  folders: createFoldersDemo,
};

export function createFeatureScenes(scope = document) {
  const scenes = qsa('.feature .scene', scope);
  if (!scenes.length) return null;

  const items = scenes.map((scene) => ({
    scene,
    demo: qs('.demo', scene),
    name: scene.dataset.scene,
    timeline: null,
    ambient: null,
    visible: false,
  }));

  function build(item) {
    const builder = BUILDERS[item.name];
    if (!builder || !item.demo) return;
    item.timeline = builder(item.demo) ?? null;
    item.ambient = createPlaybackDrift(item.scene);
    if (item.visible) resume(item);
    else halt(item);
  }

  function destroy(item) {
    item.timeline?.kill();
    item.ambient?.kill();
    item.timeline = null;
    item.ambient = null;
  }

  /* Restarted rather than resumed: it is a story, and someone arriving at it
     should not join halfway through. */
  function resume(item) {
    item.timeline?.restart();
    item.ambient?.resume();
  }

  function halt(item) {
    item.timeline?.pause();
    item.ambient?.pause();
  }

  items.forEach((item) => {
    build(item);
    whenVisible(item.scene, {
      threshold: 0.25,
      onEnter: () => {
        item.visible = true;
        resume(item);
      },
      onLeave: () => {
        item.visible = false;
        halt(item);
      },
    });
  });

  function rebuild() {
    items.forEach((item) => {
      destroy(item);
      build(item);
    });
  }

  window.addEventListener('resize', debounce(rebuild, 220));

  return {
    rebuild,
    pauseAll: () => items.forEach(halt),
    resumeAll: () => items.filter((item) => item.visible).forEach(resume),
  };
}
