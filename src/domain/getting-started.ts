import type { Note } from './note';

/** The steps a new reader is walked through, in order. */
export type GettingStartedStep = 'pin' | 'note' | 'text' | 'video' | 'folder' | 'team';

/** Enough to know someone has found their feet; the rest are there if wanted. */
export const CORE_STEPS: readonly GettingStartedStep[] = ['pin', 'note', 'text'];

export interface GettingStartedFacts {
  /** Null where the browser won't say whether Hamesh is on the toolbar. */
  pinned: boolean | null;
  notes: readonly Note[];
  folderCount: number;
  teamCount: number;
}

/**
 * Which steps are done, read from what the reader has actually done rather than
 * from anything they ticked. A note deleted afterwards un-ticks its step, which
 * is fine: this only ever points at what to try next.
 */
export function stepsDone(facts: GettingStartedFacts): ReadonlySet<GettingStartedStep> {
  const done = new Set<GettingStartedStep>();
  if (facts.pinned !== false) done.add('pin');
  if (facts.notes.length > 0) done.add('note');
  if (facts.notes.some((note) => note.anchor?.type === 'text')) done.add('text');
  if (facts.notes.some((note) => note.anchor?.type === 'video')) done.add('video');
  if (facts.folderCount > 0) done.add('folder');
  if (facts.teamCount > 0) done.add('team');
  return done;
}

export function coreStepsDone(done: ReadonlySet<GettingStartedStep>): number {
  return CORE_STEPS.filter((step) => done.has(step)).length;
}
