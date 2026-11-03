import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (changes: Record<string, unknown>, area: string) => void;
const listeners = vi.hoisted(() => new Set<Listener>());

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      onChanged: {
        addListener: (fn: Listener) => listeners.add(fn),
        removeListener: (fn: Listener) => listeners.delete(fn),
      },
    },
  },
}));

import { createNotesRepository } from '@/storage/notes-repository';

const fire = (key: string, area = 'local') =>
  listeners.forEach((listener) => listener({ [key]: {} }, area));

describe('watching every page’s notes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    listeners.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('fires once for several writes close together', () => {
    const onChange = vi.fn();
    createNotesRepository().watchAll(onChange);
    fire('hamesh:notes:https://a.test/');
    fire('hamesh:notes:https://b.test/');
    vi.advanceTimersByTime(100);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ignores everything that is not a note', () => {
    const onChange = vi.fn();
    createNotesRepository().watchAll(onChange);
    fire('hamesh:preferences');
    fire('hamesh:team-notes:https://a.test/');
    fire('hamesh:notes:https://a.test/', 'sync');
    vi.advanceTimersByTime(100);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops when asked, even with a call on its way', () => {
    const onChange = vi.fn();
    const stop = createNotesRepository().watchAll(onChange);
    fire('hamesh:notes:https://a.test/');
    stop();
    vi.advanceTimersByTime(100);
    expect(onChange).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });
});
