import { describe, it, expect } from 'vitest';
import { isDryRun } from '../../tooling/release/dry-run';

describe('isDryRun', () => {
  it('is false with no flag and no env var', () => {
    expect(isDryRun([], {})).toBe(false);
  });

  it('is true when --dry-run is in argv', () => {
    expect(isDryRun(['--tag=v0.2.0', '--dry-run'], {})).toBe(true);
  });

  it('is true when DRY_RUN=true', () => {
    expect(isDryRun([], { DRY_RUN: 'true' })).toBe(true);
  });

  it('is true when DRY_RUN=1', () => {
    expect(isDryRun([], { DRY_RUN: '1' })).toBe(true);
  });

  it('is case-insensitive for the env var', () => {
    expect(isDryRun([], { DRY_RUN: 'TRUE' })).toBe(true);
  });

  it('is false for an unrelated DRY_RUN value', () => {
    expect(isDryRun([], { DRY_RUN: 'nope' })).toBe(false);
  });
});
