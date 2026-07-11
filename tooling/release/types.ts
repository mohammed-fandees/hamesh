export interface ManifestPermissions {
  permissions: string[];
  hostPermissions: string[];
}

export interface ManifestConfig extends ManifestPermissions {
  version: string | undefined;
}

export interface PermissionDiffResult {
  addedPermissions: string[];
  removedPermissions: string[];
  unchangedPermissions: string[];
  addedHostPermissions: string[];
  removedHostPermissions: string[];
  unchangedHostPermissions: string[];
  /** True if this release's manifest can reach more than the previous release could. */
  isExpansion: boolean;
}

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export interface VersionConsistencyIssue {
  field: string;
  message: string;
}

export interface VersionConsistencyReport {
  ok: boolean;
  tagVersion: string;
  issues: VersionConsistencyIssue[];
}
