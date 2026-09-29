import { describe, it, expect } from 'vitest';
import { hostPermissionFor, parseTeamsConfig, teamsPermissions } from '@/teams/config';

const CLIENT_ID = '1234-abc.apps.googleusercontent.com';

describe('parseTeamsConfig', () => {
  it('treats a build with neither value as having no Teams', () => {
    expect(parseTeamsConfig({})).toBeNull();
    expect(parseTeamsConfig({ apiOrigin: '  ', googleClientId: '' })).toBeNull();
  });

  it('accepts an https origin and a Google client id', () => {
    expect(
      parseTeamsConfig({ apiOrigin: 'https://api.example.com', googleClientId: CLIENT_ID }),
    ).toEqual({ apiOrigin: 'https://api.example.com', googleClientId: CLIENT_ID });
  });

  it('allows plain http only for a server on this machine', () => {
    for (const origin of ['http://localhost:8787', 'http://127.0.0.1:8787', 'http://[::1]:8787']) {
      expect(parseTeamsConfig({ apiOrigin: origin, googleClientId: CLIENT_ID })?.apiOrigin).toBe(
        origin,
      );
    }
    expect(() =>
      parseTeamsConfig({ apiOrigin: 'http://api.example.com', googleClientId: CLIENT_ID }),
    ).toThrow(/https/);
  });

  it('fails the build when only one value is set', () => {
    expect(() => parseTeamsConfig({ apiOrigin: 'https://api.example.com' })).toThrow(/both/);
    expect(() => parseTeamsConfig({ googleClientId: CLIENT_ID })).toThrow(/both/);
  });

  it('refuses anything but a bare origin', () => {
    for (const apiOrigin of [
      'https://api.example.com/',
      'https://api.example.com/v1',
      'https://api.example.com?x=1',
      'https://user@api.example.com',
      'api.example.com',
      'javascript:alert(1)',
    ]) {
      expect(() => parseTeamsConfig({ apiOrigin, googleClientId: CLIENT_ID })).toThrow();
    }
  });

  it('refuses a client id that is not a Google one', () => {
    for (const googleClientId of [
      'abc',
      'x.apps.googleusercontent.com.evil.com',
      'a b.apps.googleusercontent.com',
    ]) {
      expect(() =>
        parseTeamsConfig({ apiOrigin: 'https://api.example.com', googleClientId }),
      ).toThrow(/client id/);
    }
  });

  it('asks for identity and exactly the one API origin', () => {
    const config = { apiOrigin: 'https://api.example.com', googleClientId: CLIENT_ID };
    expect(hostPermissionFor(config)).toBe('https://api.example.com/*');
    expect(teamsPermissions(config)).toEqual({
      permissions: ['identity'],
      origins: ['https://api.example.com/*'],
    });
  });
});
