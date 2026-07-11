import { describe, it, expect } from 'vitest';
import {
  parseReleaseTag,
  formatSemVer,
  parseChangelog,
  checkVersionConsistency,
} from '../../tooling/release/version';

describe('parseReleaseTag', () => {
  it('parses a valid strict semver tag', () => {
    expect(parseReleaseTag('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('parses v0.0.0', () => {
    expect(parseReleaseTag('v0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
  });

  it.each([
    ['missing v prefix', '1.2.3'],
    ['prerelease suffix', 'v1.2.3-beta.1'],
    ['build metadata', 'v1.2.3+build.5'],
    ['leading zero', 'v1.02.3'],
    ['too few segments', 'v1.2'],
    ['non-numeric', 'v1.2.x'],
    ['empty string', ''],
    ['trailing garbage', 'v1.2.3abc'],
  ])('rejects %s (%s)', (_label, tag) => {
    expect(parseReleaseTag(tag)).toBeNull();
  });
});

describe('formatSemVer', () => {
  it('formats without a v prefix', () => {
    expect(formatSemVer({ major: 1, minor: 2, patch: 3 })).toBe('1.2.3');
  });
});

describe('parseChangelog', () => {
  const changelog = `# Changelog

## [Unreleased]

### Added
- Nothing yet.

## [0.2.0] — 2026-07-10

### Added
- Settings screen.

## [0.1.0] — 2026-07-08

### Added
- Initial release.
`;

  it('extracts versioned sections, skipping Unreleased', () => {
    const entries = parseChangelog(changelog);
    expect(entries.map((entry) => entry.version)).toEqual(['0.2.0', '0.1.0']);
  });

  it('captures section body content', () => {
    const entries = parseChangelog(changelog);
    expect(entries[0].body).toContain('Settings screen.');
  });

  it('returns an empty array when there are no versioned sections', () => {
    expect(parseChangelog('# Changelog\n\n## [Unreleased]\n\nnothing\n')).toEqual([]);
  });
});

describe('checkVersionConsistency', () => {
  const changelog = '## [0.2.0] — 2026-07-10\n\n### Added\n- Something.\n';

  it('passes when tag, package.json, manifest, and changelog all agree', () => {
    const report = checkVersionConsistency({
      tag: 'v0.2.0',
      packageJsonVersion: '0.2.0',
      manifestVersion: '0.2.0',
      changelog,
    });
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it('fails fast with a single issue on a malformed tag', () => {
    const report = checkVersionConsistency({
      tag: 'v0.2',
      packageJsonVersion: '0.2.0',
      manifestVersion: '0.2.0',
      changelog,
    });
    expect(report.ok).toBe(false);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].field).toBe('tag');
  });

  it('reports every mismatch at once instead of stopping at the first', () => {
    const report = checkVersionConsistency({
      tag: 'v0.2.0',
      packageJsonVersion: '0.1.9',
      manifestVersion: '0.1.8',
      changelog: '## [Unreleased]\n\nnothing\n',
    });
    expect(report.ok).toBe(false);
    const fields = report.issues.map((issue) => issue.field);
    expect(fields).toEqual(['package.json', 'wxt.config.ts', 'CHANGELOG.md']);
  });

  it('flags a missing manifest version', () => {
    const report = checkVersionConsistency({
      tag: 'v0.2.0',
      packageJsonVersion: '0.2.0',
      manifestVersion: undefined,
      changelog,
    });
    expect(report.issues.some((issue) => issue.field === 'wxt.config.ts')).toBe(true);
  });

  it('flags an empty changelog section', () => {
    const report = checkVersionConsistency({
      tag: 'v0.2.0',
      packageJsonVersion: '0.2.0',
      manifestVersion: '0.2.0',
      changelog: '## [0.2.0] — 2026-07-10\n\n',
    });
    expect(report.issues.some((issue) => issue.field === 'CHANGELOG.md')).toBe(true);
  });
});
