import { describe, expect, it } from 'vitest';
import { coreStepsDone, stepsDone, type GettingStartedFacts } from '@/domain/getting-started';
import type { Note } from '@/domain/note';

const note = (anchor: unknown) => ({ id: 'n', anchor }) as Note;
const facts = (over: Partial<GettingStartedFacts> = {}): GettingStartedFacts => ({
  pinned: false,
  notes: [],
  folderCount: 0,
  teamCount: 0,
  ...over,
});

describe('stepsDone', () => {
  it('has nothing ticked for someone who has done nothing', () => {
    expect([...stepsDone(facts())]).toEqual([]);
  });

  it('ticks each step from what the reader actually did', () => {
    const done = stepsDone(
      facts({
        pinned: true,
        notes: [note({ type: 'text' }), note({ type: 'video' }), note({ signals: {} })],
        folderCount: 1,
        teamCount: 1,
      }),
    );
    expect([...done].sort()).toEqual(['folder', 'note', 'pin', 'team', 'text', 'video']);
  });

  it('does not ask for what the browser cannot report', () => {
    expect(stepsDone(facts({ pinned: null })).has('pin')).toBe(true);
  });

  it('counts only the basics towards being done', () => {
    const done = stepsDone(facts({ notes: [note({ type: 'video' })], folderCount: 3 }));
    expect(coreStepsDone(done)).toBe(1);
  });
});
