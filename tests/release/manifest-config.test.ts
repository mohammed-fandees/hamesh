import { describe, it, expect } from 'vitest';
import { extractManifestConfig } from '../../tooling/release/manifest-config';

describe('extractManifestConfig', () => {
  it('extracts version and permissions from a real-shaped wxt.config.ts', () => {
    const source = `
      import { defineConfig } from 'wxt';

      export default defineConfig({
        modules: ['@wxt-dev/module-react'],
        srcDir: 'src',
        manifest: {
          name: 'Hamesh — هامش',
          version: '0.2.0',
          description: 'Leave a note.',
          permissions: ['storage', 'activeTab'],
          action: { default_title: 'Hamesh' },
        },
      });
    `;

    expect(extractManifestConfig(source)).toEqual({
      version: '0.2.0',
      permissions: ['storage', 'activeTab'],
      hostPermissions: [],
    });
  });

  it('extracts host_permissions when present', () => {
    const source = `
      import { defineConfig } from 'wxt';
      export default defineConfig({
        manifest: {
          version: '0.3.0',
          permissions: ['storage'],
          host_permissions: ['https://example.com/*'],
        },
      });
    `;

    expect(extractManifestConfig(source)).toEqual({
      version: '0.3.0',
      permissions: ['storage'],
      hostPermissions: ['https://example.com/*'],
    });
  });

  it('returns empty defaults when there is no manifest object', () => {
    const source = `export default defineConfig({ srcDir: 'src' });`;
    expect(extractManifestConfig(source)).toEqual({
      version: undefined,
      permissions: [],
      hostPermissions: [],
    });
  });

  it('returns empty defaults when there is no defineConfig call at all', () => {
    expect(extractManifestConfig('export const x = 1;')).toEqual({
      version: undefined,
      permissions: [],
      hostPermissions: [],
    });
  });

  it('tolerates missing permissions/host_permissions arrays', () => {
    const source = `
      import { defineConfig } from 'wxt';
      export default defineConfig({ manifest: { version: '1.0.0' } });
    `;
    expect(extractManifestConfig(source)).toEqual({
      version: '1.0.0',
      permissions: [],
      hostPermissions: [],
    });
  });

  it('ignores non-string array elements without throwing', () => {
    const source = `
      import { defineConfig } from 'wxt';
      export default defineConfig({
        manifest: { version: '1.0.0', permissions: ['storage', 1 as any, activeTabVar] },
      });
    `;
    expect(extractManifestConfig(source).permissions).toEqual(['storage']);
  });
});
