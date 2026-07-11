import type { PermissionDiffResult, VersionConsistencyReport } from './types.js';
import type { ListingValidationResult } from './metadata-schema.js';

function renderList(items: string[], emptyText: string): string {
  return items.length === 0 ? emptyText : items.map((item) => `- \`${item}\``).join('\n');
}

export function renderVersionConsistencyMarkdown(report: VersionConsistencyReport): string {
  const lines = [`## Version consistency`, ''];
  if (report.ok) {
    lines.push(`✅ All version sources agree: \`${report.tagVersion}\`.`);
  } else {
    lines.push(`❌ Version mismatch found for tag \`${report.tagVersion}\`:`, '');
    for (const issue of report.issues) {
      lines.push(`- **${issue.field}**: ${issue.message}`);
    }
  }
  return lines.join('\n');
}

/**
 * Renders the permission diff with expansions made visually prominent, per the requirement
 * that added permissions must be clearly visible before owner approval even though they are
 * never auto-blocked.
 */
export function renderPermissionDiffMarkdown(diff: PermissionDiffResult): string {
  const lines = [`## Permissions`, ''];

  if (diff.isExpansion) {
    lines.push(
      '> ⚠️ **This release requests broader access than the previous release.** Review carefully before approving.',
      '',
    );
  }

  lines.push(
    '### Added',
    renderList(
      [...diff.addedPermissions, ...diff.addedHostPermissions.map((value) => `host: ${value}`)],
      '_None._',
    ),
    '',
    '### Removed',
    renderList(
      [...diff.removedPermissions, ...diff.removedHostPermissions.map((value) => `host: ${value}`)],
      '_None._',
    ),
    '',
    '### Unchanged',
    renderList(
      [
        ...diff.unchangedPermissions,
        ...diff.unchangedHostPermissions.map((value) => `host: ${value}`),
      ],
      '_None._',
    ),
  );

  return lines.join('\n');
}

/**
 * Renders the metadata validation result. Explicitly labels the comparison limitation: this is
 * schema validation of the repo's listing.yaml, not a diff against the live Chrome Web Store
 * listing, because the API cannot read the live listing (docs/releases/RESEARCH.md §2).
 */
export function renderMetadataValidationMarkdown(result: ListingValidationResult): string {
  const lines = [
    `## Store listing metadata`,
    '',
    '> Chrome Web Store API v2 has no endpoint to read the live dashboard listing, so this cannot be a diff',
    '> against the current live values — only schema validation of `docs/chrome-web-store/listing.yaml` at this',
    '> release commit. All listing fields remain manual-dashboard-only. See ADR 0001 §4.',
    '',
  ];

  if (result.success) {
    lines.push('✅ `listing.yaml` is valid.');
  } else {
    lines.push('❌ `listing.yaml` failed validation:', '');
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('', '**Warnings (advisory only, does not block approval):**', '');
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join('\n');
}
