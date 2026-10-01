import type { CSSProperties } from 'react';

/** How far apart the items of a list arrive, and when they stop waiting. */
const STEP_MS = 30;
const CAP_MS = 240;

/**
 * The entrance delay for the `index`th item of a list that fades in
 * (`hm-fade-in`) — one step and one cap for every list in Hamesh, so a long
 * list arrives as quickly as a short one and no two lists move differently.
 */
export function stagger(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index * STEP_MS, CAP_MS)}ms` };
}
