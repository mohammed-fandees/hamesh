import type { ManifestPermissions, PermissionDiffResult } from './types.js';

function diffStringSets(
  previous: string[],
  current: string[],
): { added: string[]; removed: string[]; unchanged: string[] } {
  const previousSet = new Set(previous);
  const currentSet = new Set(current);

  const added = [...currentSet].filter((value) => !previousSet.has(value)).sort();
  const removed = [...previousSet].filter((value) => !currentSet.has(value)).sort();
  const unchanged = [...currentSet].filter((value) => previousSet.has(value)).sort();

  return { added, removed, unchanged };
}

/**
 * Classifies permission changes between the previous release's manifest and this release's
 * manifest. Never blocks a release by itself — per the requirement, permission expansion must
 * be made visible before owner approval, not auto-rejected, because legitimate releases may
 * need new permissions.
 */
export function diffPermissions(
  previous: ManifestPermissions,
  current: ManifestPermissions,
): PermissionDiffResult {
  const permissions = diffStringSets(previous.permissions, current.permissions);
  const hostPermissions = diffStringSets(previous.hostPermissions, current.hostPermissions);

  return {
    addedPermissions: permissions.added,
    removedPermissions: permissions.removed,
    unchangedPermissions: permissions.unchanged,
    addedHostPermissions: hostPermissions.added,
    removedHostPermissions: hostPermissions.removed,
    unchangedHostPermissions: hostPermissions.unchanged,
    isExpansion: permissions.added.length > 0 || hostPermissions.added.length > 0,
  };
}
