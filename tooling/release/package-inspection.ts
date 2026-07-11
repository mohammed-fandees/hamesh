export interface PackageInspectionIssue {
  file: string;
  reason: string;
}

export interface ManifestSummary {
  name: string | undefined;
  version: string | undefined;
  manifestVersion: number | undefined;
  permissions: string[];
  hostPermissions: string[];
}

/**
 * Patterns for files that should never end up inside a production Chrome Web Store package.
 * Each entry pairs a matcher with a human-readable reason so the inspection report is
 * self-explanatory rather than just listing filenames.
 */
const FORBIDDEN_ENTRY_RULES: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\.map$/i, reason: 'source map' },
  { pattern: /(^|\/)\.env(\.|$)/i, reason: 'environment file' },
  { pattern: /(^|\/)tests?\//i, reason: 'test source' },
  { pattern: /(^|\/)e2e\//i, reason: 'end-to-end test source' },
  { pattern: /(^|\/)__tests__\//i, reason: 'test source' },
  { pattern: /\.test\.[jt]sx?$/i, reason: 'test source' },
  { pattern: /\.spec\.[jt]sx?$/i, reason: 'test source' },
  { pattern: /(^|\/)\.git\//i, reason: 'version control metadata' },
  { pattern: /(^|\/)node_modules\//i, reason: 'unbundled dependency tree' },
  { pattern: /\.(md|markdown)$/i, reason: 'documentation' },
  {
    pattern:
      /(^|\/)(tsconfig.*\.json|vite\.config\.\w+|wxt\.config\.\w+|eslint\.config\.\w+|\.prettierrc)$/i,
    reason: 'development configuration',
  },
  { pattern: /\.(pem|key|p12|pfx)$/i, reason: 'credential/key material' },
  { pattern: /(^|\/)(credentials|service-account.*)\.json$/i, reason: 'credential material' },
];

/** Scans a flat list of archive entry paths for anything that shouldn't ship in production. */
export function scanPackageEntries(entries: string[]): PackageInspectionIssue[] {
  const issues: PackageInspectionIssue[] = [];

  for (const entry of entries) {
    const normalized = entry.replace(/\\/g, '/');
    for (const rule of FORBIDDEN_ENTRY_RULES) {
      if (rule.pattern.test(normalized)) {
        issues.push({ file: entry, reason: rule.reason });
        break;
      }
    }
  }

  return issues;
}

/** Summarizes the parts of a built manifest.json relevant to release review. */
export function summarizeManifest(manifest: Record<string, unknown>): ManifestSummary {
  const permissions = Array.isArray(manifest.permissions)
    ? manifest.permissions.filter((value): value is string => typeof value === 'string')
    : [];
  const hostPermissions = Array.isArray(manifest.host_permissions)
    ? manifest.host_permissions.filter((value): value is string => typeof value === 'string')
    : [];

  return {
    name: typeof manifest.name === 'string' ? manifest.name : undefined,
    version: typeof manifest.version === 'string' ? manifest.version : undefined,
    manifestVersion:
      typeof manifest.manifest_version === 'number' ? manifest.manifest_version : undefined,
    permissions,
    hostPermissions,
  };
}

/**
 * Picks the single production Chrome zip out of a directory listing (WXT's `.output/` also
 * contains firefox builds, dev builds, and non-zip artifacts). Throws if the match isn't
 * unique, since silently picking "the first one" could upload the wrong build.
 */
export function resolveChromeZipPath(files: string[]): string {
  const candidates = files.filter(
    (file) => /-chrome\.zip$/i.test(file) && !/-firefox-chrome\.zip$/i.test(file),
  );

  if (candidates.length === 0) {
    throw new Error('No *-chrome.zip file found. Run `pnpm zip` before packaging.');
  }
  if (candidates.length > 1) {
    throw new Error(
      `Expected exactly one *-chrome.zip file, found ${candidates.length}: ${candidates.join(', ')}`,
    );
  }
  return candidates[0];
}
