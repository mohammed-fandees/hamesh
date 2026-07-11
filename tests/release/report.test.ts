import { describe, it, expect } from 'vitest';
import {
  renderVersionConsistencyMarkdown,
  renderPermissionDiffMarkdown,
  renderMetadataValidationMarkdown,
} from '../../tooling/release/report';
import type { PermissionDiffResult, VersionConsistencyReport } from '../../tooling/release/types';
import type { ListingValidationResult } from '../../tooling/release/metadata-schema';

describe('renderVersionConsistencyMarkdown', () => {
  it('renders a passing report', () => {
    const report: VersionConsistencyReport = { ok: true, tagVersion: '0.2.0', issues: [] };
    const markdown = renderVersionConsistencyMarkdown(report);
    expect(markdown).toContain('✅');
    expect(markdown).toContain('0.2.0');
  });

  it('renders every issue in a failing report', () => {
    const report: VersionConsistencyReport = {
      ok: false,
      tagVersion: '0.2.0',
      issues: [
        { field: 'package.json', message: 'mismatch A' },
        { field: 'wxt.config.ts', message: 'mismatch B' },
      ],
    };
    const markdown = renderVersionConsistencyMarkdown(report);
    expect(markdown).toContain('❌');
    expect(markdown).toContain('mismatch A');
    expect(markdown).toContain('mismatch B');
  });
});

describe('renderPermissionDiffMarkdown', () => {
  const noChange: PermissionDiffResult = {
    addedPermissions: [],
    removedPermissions: [],
    unchangedPermissions: ['storage'],
    addedHostPermissions: [],
    removedHostPermissions: [],
    unchangedHostPermissions: [],
    isExpansion: false,
  };

  it('does not show the expansion warning banner when nothing was added', () => {
    const markdown = renderPermissionDiffMarkdown(noChange);
    expect(markdown).not.toContain('⚠️');
    expect(markdown).toContain('storage');
  });

  it('prominently flags an expansion', () => {
    const expansion: PermissionDiffResult = {
      ...noChange,
      addedPermissions: ['tabs'],
      isExpansion: true,
    };
    const markdown = renderPermissionDiffMarkdown(expansion);
    expect(markdown).toContain('⚠️');
    expect(markdown).toContain('broader access');
    expect(markdown).toContain('tabs');
  });

  it('prefixes added host permissions distinctly from regular permissions', () => {
    const expansion: PermissionDiffResult = {
      ...noChange,
      addedHostPermissions: ['https://example.com/*'],
      isExpansion: true,
    };
    const markdown = renderPermissionDiffMarkdown(expansion);
    expect(markdown).toContain('host: https://example.com/*');
  });
});

describe('renderMetadataValidationMarkdown', () => {
  it('labels the comparison limitation regardless of outcome', () => {
    const result: ListingValidationResult = { success: true, errors: [], warnings: [] };
    const markdown = renderMetadataValidationMarkdown(result);
    expect(markdown).toContain('cannot be a diff');
  });

  it('renders validation errors', () => {
    const result: ListingValidationResult = {
      success: false,
      errors: ['productName: too long'],
      warnings: [],
    };
    const markdown = renderMetadataValidationMarkdown(result);
    expect(markdown).toContain('❌');
    expect(markdown).toContain('productName: too long');
  });

  it('renders warnings as non-blocking', () => {
    const result: ListingValidationResult = {
      success: true,
      errors: [],
      warnings: ['some soft warning'],
    };
    const markdown = renderMetadataValidationMarkdown(result);
    expect(markdown).toContain('advisory only');
    expect(markdown).toContain('some soft warning');
  });
});
