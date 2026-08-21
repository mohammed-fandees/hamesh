import type { SemVer, VersionConsistencyIssue, VersionConsistencyReport } from './types.js';

/** Strict `vMAJOR.MINOR.PATCH` — no prerelease/build metadata, no leading zeros. */
const RELEASE_TAG_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Parses a release tag like `v0.2.0`. Returns null if it doesn't match the required strict format. */
export function parseReleaseTag(tag: string): SemVer | null {
  const match = RELEASE_TAG_PATTERN.exec(tag.trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function formatSemVer(version: SemVer): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

export function semVerToTag(version: SemVer): string {
  return `v${formatSemVer(version)}`;
}

export interface ChangelogEntry {
  version: string;
  heading: string;
  body: string;
}

/**
 * Parses a "Keep a Changelog"-style CHANGELOG.md into per-version sections. Only versioned
 * headings (`## [X.Y.Z] — date`) are returned; `## [Unreleased]` is skipped.
 */
export function parseChangelog(changelog: string): ChangelogEntry[] {
  const lines = changelog.split(/\r?\n/);
  const headingPattern = /^## \[([^\]]+)]/;
  const entries: ChangelogEntry[] = [];
  let current: { version: string; heading: string; body: string[] } | null = null;

  const flush = () => {
    if (current && current.version.toLowerCase() !== 'unreleased') {
      entries.push({
        version: current.version,
        heading: current.heading,
        body: current.body.join('\n').trim(),
      });
    }
  };

  for (const line of lines) {
    const match = headingPattern.exec(line);
    if (match) {
      flush();
      current = { version: match[1], heading: line, body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  flush();

  return entries;
}

export interface VersionConsistencyInput {
  tag: string;
  packageJsonVersion: string;
  manifestVersion: string | undefined;
  changelog: string;
  /** Versions present in `src/domain/release-notes.ts` — the user-facing
   *  What's New page. Optional so existing callers/tests that only care
   *  about the changelog keep working unchanged. */
  releaseNoteVersions?: readonly string[];
}

/**
 * Cross-checks a release tag against package.json's version, the extension manifest's
 * version, the presence of a matching CHANGELOG.md section, and (when supplied) a matching
 * What's New entry. Never throws — collects every mismatch so the approval report can show all
 * of them at once instead of failing fast on the first one.
 *
 * The What's New check exists because that page is the only changelog most users will ever
 * read, and nothing else would notice it going stale: the extension would ship, update itself,
 * open the page, and show the reader nothing about the version they just received.
 */
export function checkVersionConsistency(input: VersionConsistencyInput): VersionConsistencyReport {
  const issues: VersionConsistencyIssue[] = [];
  const parsedTag = parseReleaseTag(input.tag);

  if (!parsedTag) {
    issues.push({
      field: 'tag',
      message: `Tag "${input.tag}" is not a valid release tag. Expected the strict format vMAJOR.MINOR.PATCH (e.g. v0.2.0) with no prerelease/build suffix.`,
    });
    return { ok: false, tagVersion: input.tag, issues };
  }

  const tagVersion = formatSemVer(parsedTag);

  if (input.packageJsonVersion !== tagVersion) {
    issues.push({
      field: 'package.json',
      message: `package.json version "${input.packageJsonVersion}" does not match tag version "${tagVersion}".`,
    });
  }

  if (input.manifestVersion === undefined) {
    issues.push({
      field: 'wxt.config.ts',
      message: 'Could not find manifest.version in wxt.config.ts.',
    });
  } else if (input.manifestVersion !== tagVersion) {
    issues.push({
      field: 'wxt.config.ts',
      message: `manifest.version "${input.manifestVersion}" does not match tag version "${tagVersion}".`,
    });
  }

  const changelogEntries = parseChangelog(input.changelog);
  const changelogEntry = changelogEntries.find((entry) => entry.version === tagVersion);
  if (!changelogEntry) {
    issues.push({
      field: 'CHANGELOG.md',
      message: `No "## [${tagVersion}]" section found in CHANGELOG.md.`,
    });
  } else if (changelogEntry.body.trim().length === 0) {
    issues.push({
      field: 'CHANGELOG.md',
      message: `The "## [${tagVersion}]" section in CHANGELOG.md is empty.`,
    });
  }

  if (input.releaseNoteVersions && !input.releaseNoteVersions.includes(tagVersion)) {
    issues.push({
      field: 'src/domain/release-notes.ts',
      message: `No release-notes entry for "${tagVersion}" — the What's New page would not mention this version.`,
    });
  }

  return { ok: issues.length === 0, tagVersion, issues };
}
