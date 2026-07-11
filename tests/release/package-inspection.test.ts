import { describe, it, expect } from 'vitest';
import {
  scanPackageEntries,
  summarizeManifest,
  resolveChromeZipPath,
} from '../../tooling/release/package-inspection';

describe('scanPackageEntries', () => {
  it('finds no issues in a clean production package', () => {
    const entries = [
      'manifest.json',
      'background.js',
      'popup.html',
      'content-scripts/content.js',
      'content-scripts/content.css',
      'icon/128.png',
      'icon/16.png',
    ];
    expect(scanPackageEntries(entries)).toEqual([]);
  });

  it('flags a source map', () => {
    const issues = scanPackageEntries(['background.js', 'background.js.map']);
    expect(issues).toEqual([{ file: 'background.js.map', reason: 'source map' }]);
  });

  it('flags an .env file', () => {
    expect(scanPackageEntries(['.env'])).toEqual([{ file: '.env', reason: 'environment file' }]);
  });

  it('flags test sources under a tests/ or e2e/ directory', () => {
    const issues = scanPackageEntries(['tests/note.test.ts', 'e2e/core-flows.spec.ts']);
    expect(issues.map((issue) => issue.file)).toEqual([
      'tests/note.test.ts',
      'e2e/core-flows.spec.ts',
    ]);
  });

  it('flags documentation and dev config accidentally bundled', () => {
    const issues = scanPackageEntries(['README.md', 'tsconfig.json']);
    expect(issues.map((issue) => issue.file)).toEqual(['README.md', 'tsconfig.json']);
  });

  it('flags credential-shaped files', () => {
    const issues = scanPackageEntries(['service-account-key.json', 'private.pem']);
    expect(issues.map((issue) => issue.file)).toEqual(['service-account-key.json', 'private.pem']);
  });

  it('normalizes backslash path separators', () => {
    const issues = scanPackageEntries(['tests\\note.test.ts']);
    expect(issues).toEqual([{ file: 'tests\\note.test.ts', reason: 'test source' }]);
  });
});

describe('summarizeManifest', () => {
  it('extracts the fields relevant to release review', () => {
    const summary = summarizeManifest({
      name: 'Hamesh — هامش',
      version: '0.2.0',
      manifest_version: 3,
      permissions: ['storage', 'activeTab'],
      host_permissions: ['https://example.com/*'],
    });

    expect(summary).toEqual({
      name: 'Hamesh — هامش',
      version: '0.2.0',
      manifestVersion: 3,
      permissions: ['storage', 'activeTab'],
      hostPermissions: ['https://example.com/*'],
    });
  });

  it('defaults missing fields safely instead of throwing', () => {
    expect(summarizeManifest({})).toEqual({
      name: undefined,
      version: undefined,
      manifestVersion: undefined,
      permissions: [],
      hostPermissions: [],
    });
  });
});

describe('resolveChromeZipPath', () => {
  it('picks the single chrome zip out of a mixed directory listing', () => {
    const files = [
      'hamesh-0.2.0-chrome.zip',
      'hamesh-0.2.0-firefox.zip',
      'hamesh-0.2.0-sources.zip',
    ];
    expect(resolveChromeZipPath(files)).toBe('hamesh-0.2.0-chrome.zip');
  });

  it('throws when no chrome zip exists', () => {
    expect(() => resolveChromeZipPath(['hamesh-0.2.0-firefox.zip'])).toThrow(/No \*-chrome\.zip/);
  });

  it('throws when multiple chrome zips exist (ambiguous)', () => {
    expect(() =>
      resolveChromeZipPath(['hamesh-0.1.0-chrome.zip', 'hamesh-0.2.0-chrome.zip']),
    ).toThrow(/exactly one/);
  });
});
