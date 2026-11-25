/**
 * Demo — taking the notes out as Markdown.
 *
 * Four beats: a note's menu, the export dialog with its destination and the
 * layout Hamesh suggests, the preview building line by line, and the file
 * dropping into a folder.
 */

import { gsap } from '../lib/gsap.js';
import { qs, qsa, rectIn } from '../lib/dom.js';
import { createDemoCursor } from '../animations/cursor.js';
import { prefersReducedMotion } from '../lib/motion.js';

export function createExportFlowDemo(root) {
  const library = qs('[data-el="library"]', root);
  const more = qs('[data-el="more"]', root);
  const menu = qs('[data-el="menu"]', root);
  const item = qs('[data-el="export-item"]', root);
  const dialog = qs('[data-el="dialog"]', root);
  const suggested = qs('[data-el="suggested"]', root);
  const preview = qs('[data-el="preview"]', root);
  const lines = qsa('[data-el="line"]', root);
  const fileFrame = qs('[data-el="file-frame"]', root);
  const download = qs('[data-el="download"]', root);
  const chip = qs('[data-el="chip"]', root);
  const folder = qs('[data-el="folder"]', root);

  if (!library || !preview || !chip || !folder) return null;

  gsap.set([chip, folder], { clearProps: 'transform' });
  [more, item, download].forEach((el) => el.classList.remove('is-hover'));
  gsap.set([dialog, preview, fileFrame], { opacity: 0 });
  gsap.set(menu, { opacity: 0, scale: 0.96 });
  gsap.set(library, { opacity: 1 });

  /* Reduced motion: the preview, whole — the part that says what you get. */
  if (prefersReducedMotion()) {
    gsap.set(library, { opacity: 0 });
    gsap.set(preview, { opacity: 1 });
    gsap.set(lines, { opacity: 1, y: 0 });
    return gsap.timeline({ paused: true });
  }

  const moreBox = rectIn(root, more);
  const itemBox = rectIn(root, item);
  const downloadBox = rectIn(root, download);
  const chipBox = rectIn(root, chip);
  const folderBox = rectIn(root, folder);

  /* From where it appears, out to the side and over into the folder. */
  const from = { x: 0, y: 0 };
  const into = { x: folderBox.centerX - chipBox.centerX, y: folderBox.y - chipBox.centerY + 8 };
  const side = document.documentElement.dir === 'rtl' ? -1 : 1;

  const cursor = createDemoCursor(root);
  const rest = { x: moreBox.centerX, y: moreBox.centerY + 150 };
  cursor?.placeAt(rest);

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });

  /* 1 — the note's menu. */
  cursor?.enter(tl, 0.1);
  cursor?.moveTo(tl, { x: moreBox.centerX, y: moreBox.centerY }, { at: 0.2, label: 'onMore' });
  cursor?.hover(tl, more, true, { at: 'onMore-=0.08' });
  cursor?.settle(tl, {});
  cursor?.press(tl, { target: more });
  tl.to(menu, { opacity: 1, scale: 1, duration: 0.2, ease: 'power3.out' }, '>-0.1');
  cursor?.moveTo(
    tl,
    { x: itemBox.centerX, y: itemBox.centerY },
    { at: '>', width: itemBox.height, bend: -0.5, label: 'onItem' },
  );
  cursor?.hover(tl, item, true, { at: 'onItem-=0.08' });
  cursor?.settle(tl, {});
  cursor?.press(tl, { target: item });

  /* 2 — the dialog; the suggestion lights up once. */
  tl.to(library, { opacity: 0, duration: 0.25 }, '>').to(
    dialog,
    { opacity: 1, duration: 0.3 },
    '<',
  );
  cursor?.exit(tl, '<');
  tl.fromTo(
    suggested,
    { scale: 1 },
    { scale: 1.12, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.inOut' },
    '>+0.4',
  ).to({}, { duration: 1 });

  /* 3 — the preview, built from the top at a writing pace. */
  tl.set(lines, { opacity: 0, y: 6 })
    .to(dialog, { opacity: 0, duration: 0.25 })
    .to(preview, { opacity: 1, duration: 0.25 }, '<')
    .to(lines, { opacity: 1, y: 0, duration: 0.22, stagger: 0.24 }, '>')
    .to({}, { duration: 0.6 });

  /* 4 — download, and the file finds its folder. */
  tl.to(preview, { opacity: 0, duration: 0.25 })
    .set(chip, { x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.8 })
    .to(fileFrame, { opacity: 1, duration: 0.25 }, '<');
  cursor?.moveTo(tl, { x: downloadBox.centerX, y: downloadBox.centerY }, { at: '>', bend: 1 });
  cursor?.enter(tl, '<');
  cursor?.hover(tl, download, true, {});
  cursor?.press(tl, { target: download });
  tl.to(chip, { opacity: 1, scale: 1, rotate: -3, duration: 0.15 }, '>-0.2')
    .to(chip, {
      motionPath: {
        path: [from, { x: side * 70, y: into.y * 0.2 - 20 }, into],
        curviness: 1.3,
      },
      duration: 0.8,
      ease: 'power2.inOut',
    })
    .to(chip, { opacity: 0, scale: 0.6, duration: 0.2 }, '>-0.1')
    .to(folder, { scale: 1.05, duration: 0.16, yoyo: true, repeat: 1 }, '<')
    .to({}, { duration: 0.8 });

  /* The seam. */
  cursor?.exit(tl, '>');
  tl.to(fileFrame, { opacity: 0, duration: 0.35 }, '<')
    .to(library, { opacity: 1, duration: 0.35 }, '>')
    .set(menu, { opacity: 0, scale: 0.96 }, '<-0.35')
    .call(() => cursor?.placeAt(rest));

  return tl;
}
