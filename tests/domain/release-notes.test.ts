import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  RELEASE_NOTES,
  compareVersions,
  getLatestReleaseVersion,
  hasUnseenReleases,
  localizeReleaseNote,
  releasesSince,
  shouldAnnounceUpdate,
} from '@/domain/release-notes';

describe('compareVersions', () => {
  it('orders by number, not by string', () => {
    // The case a string compare gets backwards, and the reason this exists.
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.9.0', '1.10.0')).toBeLessThan(0);
  });

  it('compares each part in order', () => {
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(compareVersions('1.2.3', '1.2.4')).toBeLessThan(0);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('treats a malformed part as zero rather than NaN', () => {
    expect(compareVersions('1.x.0', '1.0.0')).toBe(0);
    expect(compareVersions('', '0.0.0')).toBe(0);
  });
});

describe('release notes data', () => {
  it('is listed newest first', () => {
    for (let i = 1; i < RELEASE_NOTES.length; i++) {
      expect(
        compareVersions(RELEASE_NOTES[i - 1].version, RELEASE_NOTES[i].version),
      ).toBeGreaterThan(0);
    }
  });

  it('has no duplicate versions', () => {
    const versions = RELEASE_NOTES.map((r) => r.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('gives every release both languages, everywhere', () => {
    // The whole point of the page is that an Arabic reader gets Arabic
    // release notes — a missing translation would silently fall back to
    // English text under Arabic chrome.
    for (const release of RELEASE_NOTES) {
      expect(release.version, `${release.version} version`).toMatch(/^\d+\.\d+\.\d+$/);
      expect(release.date, `${release.version} date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(release.title.en.trim(), `${release.version} title.en`).not.toBe('');
      expect(release.title.ar.trim(), `${release.version} title.ar`).not.toBe('');
      expect(release.items.length, `${release.version} items`).toBeGreaterThan(0);
      for (const [i, item] of release.items.entries()) {
        expect(item.en.trim(), `${release.version} items[${i}].en`).not.toBe('');
        expect(item.ar.trim(), `${release.version} items[${i}].ar`).not.toBe('');
        // Arabic that is actually Arabic — a copy-pasted English string
        // would pass a non-empty check but not this one.
        expect(item.ar, `${release.version} items[${i}].ar`).toMatch(/[؀-ۿ]/);
      }
    }
  });

  it('covers every version the changelog documents', () => {
    // The changelog is for maintainers and What's New is for users, but a
    // released version missing from the page means someone updated and was
    // told nothing.
    const changelog = readFileSync(resolve(process.cwd(), 'CHANGELOG.md'), 'utf8');
    const released = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((m) => m[1]);
    expect(released.length).toBeGreaterThan(0);
    const documented = new Set(RELEASE_NOTES.map((r) => r.version));
    expect(released.filter((v) => !documented.has(v))).toEqual([]);
  });
});

describe('localizeReleaseNote', () => {
  it('picks the requested language', () => {
    const item = { en: 'English text', ar: 'نص عربي' };
    expect(localizeReleaseNote(item, 'en')).toBe('English text');
    expect(localizeReleaseNote(item, 'ar')).toBe('نص عربي');
  });
});

describe('releasesSince', () => {
  it('returns the whole history for someone who has never looked', () => {
    expect(releasesSince(null)).toHaveLength(RELEASE_NOTES.length);
  });

  it('returns nothing when the newest release has already been seen', () => {
    expect(releasesSince(getLatestReleaseVersion())).toEqual([]);
    expect(hasUnseenReleases(getLatestReleaseVersion())).toBe(false);
  });

  it('returns only what came after the given version', () => {
    const versions = releasesSince('1.1.0').map((r) => r.version);
    expect(versions).toEqual(['1.3.0', '1.2.3', '1.2.1', '1.2.0']);
    expect(hasUnseenReleases('1.1.0')).toBe(true);
  });

  it('handles a stored version newer than anything listed', () => {
    expect(releasesSince('99.0.0')).toEqual([]);
    expect(hasUnseenReleases('99.0.0')).toBe(false);
  });
});

describe('shouldAnnounceUpdate', () => {
  it('announces a genuine version-to-version update', () => {
    expect(shouldAnnounceUpdate('update', '1.1.0', '1.2.3')).toBe(true);
  });

  it('stays quiet on a fresh install', () => {
    // Nothing to be "new" relative to, and an uninvited changelog is a poor
    // first impression.
    expect(shouldAnnounceUpdate('install', undefined, '1.2.3')).toBe(false);
  });

  it('stays quiet for a browser update or a developer reload of the same version', () => {
    expect(shouldAnnounceUpdate('chrome_update', undefined, '1.2.3')).toBe(false);
    expect(shouldAnnounceUpdate('update', '1.2.3', '1.2.3')).toBe(false);
  });

  it('stays quiet on a downgrade', () => {
    expect(shouldAnnounceUpdate('update', '1.2.3', '1.1.0')).toBe(false);
  });

  it('stays quiet when the new version has nothing to show', () => {
    // A version with no release-notes entry must not open an empty page.
    expect(shouldAnnounceUpdate('update', getLatestReleaseVersion(), '99.0.0')).toBe(false);
  });
});
