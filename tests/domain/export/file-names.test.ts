import { describe, it, expect } from 'vitest';
import { safeFileName, assignPaths } from '@/domain/export/file-names';

describe('safeFileName', () => {
  it('drops characters no file system or vault accepts', () => {
    expect(safeFileName('zustand/docs: intro? "a" <b> | #c ^d [e]')).toBe(
      'zustand docs intro a b c d e',
    );
  });

  it('never gives a device name, a dot name or nothing', () => {
    expect(safeFileName('CON')).toBe('_CON');
    expect(safeFileName('...')).toBe('_untitled');
    expect(safeFileName('  .hidden. ')).toBe('hidden');
  });

  it('stops at 80 characters', () => {
    expect(safeFileName('a'.repeat(200))).toHaveLength(80);
  });

  it('keeps Arabic as it is', () => {
    expect(safeFileName('مقدمة في الخوارزميات — المحاضرة 3')).toBe(
      'مقدمة في الخوارزميات — المحاضرة 3',
    );
  });
});

describe('safeFileName length', () => {
  it('drops an emoji at the limit whole instead of splitting it', () => {
    const name = safeFileName(`${'a'.repeat(79)}\u{1F600}b`);
    expect(name).toBe(`${'a'.repeat(79)}\u{1F600}`);
    expect(name).not.toMatch(/\p{Cs}/u);
  });
});

describe('assignPaths', () => {
  const item = (id: string, name: string, order: string, dir = 'Sites/react.dev') => ({
    id,
    dir,
    name,
    tiebreak: id.slice(0, 4),
    order,
  });

  it('gives the first-made page the plain name and the later one a stable suffix', () => {
    const paths = assignPaths([
      item('bbbb-2', 'useState – React', '2026-02'),
      item('aaaa-1', 'useState – React', '2026-01'),
    ]);
    expect(paths.get('aaaa-1')).toBe('Sites/react.dev/useState – React');
    expect(paths.get('bbbb-2')).toBe('Sites/react.dev/useState – React (bbbb)');
  });

  it('treats names that differ only by case as a clash', () => {
    const paths = assignPaths([item('a', 'Intro', '1'), item('b', 'intro', '2')]);
    expect(paths.get('b')).toBe('Sites/react.dev/intro (b)');
  });

  it('never hands out a suffixed name that is already taken', () => {
    const paths = assignPaths([
      item('aaaa-1', 'Intro', '1'),
      item('x', 'Intro (aaaa)', '2'),
      item('aaaa-3', 'Intro', '3'),
      item('aaaa-4', 'Intro', '4'),
    ]);
    expect(new Set(paths.values()).size).toBe(4);
    expect(paths.get('aaaa-3')).toBe('Sites/react.dev/Intro (aaaa 2)');
    expect(paths.get('aaaa-4')).toBe('Sites/react.dev/Intro (aaaa 3)');
  });

  it('lets the same name live in two folders', () => {
    const paths = assignPaths([
      item('a', 'Intro', '1', 'Sites/x'),
      item('b', 'Intro', '2', 'Sites/y'),
    ]);
    expect(paths.get('b')).toBe('Sites/y/Intro');
  });
});
