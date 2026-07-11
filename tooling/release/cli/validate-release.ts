#!/usr/bin/env node
import { readFileSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkVersionConsistency } from '../version.js';
import { readManifestConfigFromFile, readManifestConfigAtGitRef } from '../manifest-config.js';
import { diffPermissions } from '../permission-diff.js';
import { loadAndValidateListing } from '../metadata-schema.js';
import { isDryRun } from '../dry-run.js';
import {
  renderVersionConsistencyMarkdown,
  renderPermissionDiffMarkdown,
  renderMetadataValidationMarkdown,
} from '../report.js';

/**
 * Validates a release against the repository without mutating anything: version consistency,
 * store listing metadata schema, and (when --previous-ref is given) a permission diff against
 * an earlier release. This is the dry-run validation surface required before any real
 * build/upload/publish tooling lands in PR2/PR3 — every check here is read-only today, so
 * --dry-run is accepted for CLI-surface stability but doesn't change behavior yet.
 *
 * Usage: tsx tooling/release/cli/validate-release.ts --tag=v0.2.0 [--previous-ref=v0.1.0] [--dry-run]
 */
function parseArgs(argv: string[]): { tag?: string; previousRef?: string } {
  const result: { tag?: string; previousRef?: string } = {};
  for (const arg of argv) {
    if (arg.startsWith('--tag=')) result.tag = arg.slice('--tag='.length);
    if (arg.startsWith('--previous-ref=')) result.previousRef = arg.slice('--previous-ref='.length);
  }
  return result;
}

function main(): number {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const args = parseArgs(process.argv.slice(2));
  const dryRun = isDryRun();

  if (!args.tag) {
    console.error('Missing required --tag=vMAJOR.MINOR.PATCH argument.');
    return 1;
  }

  const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as {
    version: string;
  };
  const manifestConfig = readManifestConfigFromFile(resolve(repoRoot, 'wxt.config.ts'));
  const changelog = readFileSync(resolve(repoRoot, 'CHANGELOG.md'), 'utf8');
  const listingRaw = readFileSync(resolve(repoRoot, 'docs/chrome-web-store/listing.yaml'), 'utf8');

  const versionReport = checkVersionConsistency({
    tag: args.tag,
    packageJsonVersion: packageJson.version,
    manifestVersion: manifestConfig.version,
    changelog,
  });

  const listingResult = loadAndValidateListing(listingRaw);

  const sections = [
    `# Release validation — ${args.tag}${dryRun ? ' (dry run)' : ''}`,
    renderVersionConsistencyMarkdown(versionReport),
    renderMetadataValidationMarkdown(listingResult),
  ];

  if (args.previousRef) {
    try {
      const previousConfig = readManifestConfigAtGitRef(
        args.previousRef,
        'wxt.config.ts',
        repoRoot,
      );
      const diff = diffPermissions(previousConfig, manifestConfig);
      sections.push(renderPermissionDiffMarkdown(diff));
    } catch (error) {
      sections.push(
        [
          '## Permissions',
          '',
          `⚠️ Could not compute a permission diff against \`${args.previousRef}\`: ${(error as Error).message}`,
          '',
          'Reporting no diff rather than a potentially misleading one — see ADR 0001 §4 for why comparisons are',
          'always repo-vs-repo, never repo-vs-live-store.',
        ].join('\n'),
      );
    }
  } else {
    sections.push('## Permissions\n\n_No `--previous-ref` given — permission diff skipped._');
  }

  const report = sections.join('\n\n');
  console.log(report);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, `${report}\n`);
  }

  const failed = !versionReport.ok || !listingResult.success;
  return failed ? 1 : 0;
}

process.exit(main());
