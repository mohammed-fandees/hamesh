import { describe, it, expect } from 'vitest';
import { diffPermissions } from '../../tooling/release/permission-diff';

describe('diffPermissions', () => {
  it('reports no changes when both sides are identical', () => {
    const result = diffPermissions(
      { permissions: ['storage', 'activeTab'], hostPermissions: [] },
      { permissions: ['storage', 'activeTab'], hostPermissions: [] },
    );

    expect(result).toEqual({
      addedPermissions: [],
      removedPermissions: [],
      unchangedPermissions: ['activeTab', 'storage'],
      addedHostPermissions: [],
      removedHostPermissions: [],
      unchangedHostPermissions: [],
      isExpansion: false,
    });
  });

  it('classifies an added permission as an expansion', () => {
    const result = diffPermissions(
      { permissions: ['storage'], hostPermissions: [] },
      { permissions: ['storage', 'tabs'], hostPermissions: [] },
    );

    expect(result.addedPermissions).toEqual(['tabs']);
    expect(result.unchangedPermissions).toEqual(['storage']);
    expect(result.isExpansion).toBe(true);
  });

  it('classifies a removed permission without flagging it as an expansion', () => {
    const result = diffPermissions(
      { permissions: ['storage', 'activeTab'], hostPermissions: [] },
      { permissions: ['storage'], hostPermissions: [] },
    );

    expect(result.removedPermissions).toEqual(['activeTab']);
    expect(result.isExpansion).toBe(false);
  });

  it('diffs host permissions independently of regular permissions', () => {
    const result = diffPermissions(
      { permissions: ['storage'], hostPermissions: ['https://a.example/*'] },
      { permissions: ['storage'], hostPermissions: ['https://a.example/*', 'https://b.example/*'] },
    );

    expect(result.addedHostPermissions).toEqual(['https://b.example/*']);
    expect(result.isExpansion).toBe(true);
  });

  it('handles the first-ever release (empty previous manifest)', () => {
    const result = diffPermissions(
      { permissions: [], hostPermissions: [] },
      { permissions: ['storage', 'activeTab'], hostPermissions: [] },
    );

    expect(result.addedPermissions).toEqual(['activeTab', 'storage']);
    expect(result.isExpansion).toBe(true);
  });

  it('treats simultaneous add and remove as an expansion (the add dominates)', () => {
    const result = diffPermissions(
      { permissions: ['activeTab'], hostPermissions: [] },
      { permissions: ['tabs'], hostPermissions: [] },
    );

    expect(result.addedPermissions).toEqual(['tabs']);
    expect(result.removedPermissions).toEqual(['activeTab']);
    expect(result.isExpansion).toBe(true);
  });
});
