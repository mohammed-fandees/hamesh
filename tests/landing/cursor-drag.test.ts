// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

/* The page loads GSAP as classic scripts that leave globals behind; the test
   does the same before the modules that read them are imported. */
const VENDOR = resolve(import.meta.dirname, '../../landing/js/vendor');

interface Child {
  vars: { motionPath?: unknown };
  startTime(): number;
}
interface Timeline {
  getChildren(nested: boolean, tweens: boolean, timelines: boolean): Child[];
}

let gsap: { timeline(vars?: object): Timeline };
let createDemoCursor: (root: HTMLElement) => {
  placeAt(point: { x: number; y: number }): unknown;
  drag(
    tl: Timeline,
    from: { x: number; y: number },
    to: { x: number; y: number },
    opts: { at?: number; duration?: number; onSweep?: (at: unknown, duration: number) => void },
  ): unknown;
};

beforeAll(async () => {
  for (const file of ['gsap.min.js', 'MotionPathPlugin.min.js']) {
    (0, eval)(readFileSync(resolve(VENDOR, file), 'utf8'));
  }
  // Scroll is not under test, and its plugin needs layout jsdom does not have.
  Object.assign(window, { ScrollTrigger: { name: 'ScrollTrigger' } });
  // @ts-expect-error the landing page is plain browser JavaScript, with no types
  ({ gsap } = await import('../../landing/js/lib/gsap.js'));
  // @ts-expect-error the landing page is plain browser JavaScript, with no types
  ({ createDemoCursor } = await import('../../landing/js/animations/cursor.js'));
});

describe('the demo cursor’s drag', () => {
  it('starts the selection at the moment the hand starts sweeping, not after it', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div class="demo-cursor"><svg class="demo-cursor__arrow"></svg><span class="demo-cursor__ring"></span></div>';
    document.body.append(root);

    const cursor = createDemoCursor(root);
    cursor.placeAt({ x: 20, y: 20 });
    const tl = gsap.timeline({ paused: true });

    let sweepAt: unknown;
    cursor.drag(tl, { x: 40, y: 40 }, { x: 240, y: 40 }, {
      at: 0.35,
      duration: 0.78,
      onSweep: (at) => {
        sweepAt = at;
      },
    });

    const moves = tl.getChildren(false, true, false).filter((child) => child.vars.motionPath);
    const sweep = moves.at(-1)!;
    expect(sweepAt).toBe(sweep.startTime());
  });
});
