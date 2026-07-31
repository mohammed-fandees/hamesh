import { describe, it, expect } from 'vitest';
import { DEFAULT_WORKSPACE_ID } from '@/domain/workspace';

describe('DEFAULT_WORKSPACE_ID', () => {
  it('is a stable, non-empty string', () => {
    expect(typeof DEFAULT_WORKSPACE_ID).toBe('string');
    expect(DEFAULT_WORKSPACE_ID.length).toBeGreaterThan(0);
  });
});
