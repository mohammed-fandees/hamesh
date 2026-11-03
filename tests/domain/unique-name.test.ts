import { describe, expect, it } from 'vitest';
import { nameTaken, nextFreeName } from '@/domain/unique-name';

describe('nameTaken', () => {
  it('treats case and spacing as the same name', () => {
    expect(nameTaken('  design   team ', ['Design Team'])).toBe(true);
    expect(nameTaken('Design', ['Design Team'])).toBe(false);
  });

  it('compares Arabic as written', () => {
    expect(nameTaken('فريق التصميم', ['فريق  التصميم'])).toBe(true);
  });

  it('treats composed and decomposed letters as one', () => {
    expect(nameTaken('café', ['café'])).toBe(true);
  });
});

describe('nextFreeName', () => {
  it('numbers the second one (2), as Windows does', () => {
    expect(nextFreeName('Design', ['Design'], 80)).toBe('Design (2)');
  });

  it('skips numbers already in use', () => {
    expect(nextFreeName('Design', ['Design', 'Design (2)', 'design (3)'], 80)).toBe('Design (4)');
  });

  it('counts on from a number rather than adding another', () => {
    expect(nextFreeName('Design (2)', ['Design', 'Design (2)'], 80)).toBe('Design (3)');
  });

  it('cuts the name, never the number, to stay within the limit', () => {
    const long = 'x'.repeat(20);
    const free = nextFreeName(long, [long], 20);
    expect(free).toBe(`${'x'.repeat(16)} (2)`);
    expect(free).toHaveLength(20);
  });
});
