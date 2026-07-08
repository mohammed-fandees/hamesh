import { describe, it, expect } from 'vitest';
import { normalizeUrl, generatePageKey } from '@/domain/page-key';

describe('normalizeUrl', () => {
  it('normalizes http to https', () => {
    expect(normalizeUrl('http://example.com/page')).toBe('https://example.com/page');
  });

  it('keeps https unchanged', () => {
    expect(normalizeUrl('https://example.com/page')).toBe('https://example.com/page');
  });

  it('removes hash by default', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });

  it('keeps hash when removeHash is false', () => {
    expect(
      normalizeUrl('https://example.com/page#section', {
        removeHash: false,
        keepQueryParams: new Set(),
        normalizeProtocol: true,
        normalizeTrailingSlash: true,
      }),
    ).toBe('https://example.com/page#section');
  });

  it('filters query parameters (empty keep set removes all)', () => {
    expect(normalizeUrl('https://example.com/page?a=1&b=2')).toBe('https://example.com/page');
  });

  it('keeps only whitelisted query params', () => {
    const result = normalizeUrl('https://example.com/page?a=1&b=2&c=3', {
      removeHash: true,
      keepQueryParams: new Set(['b']),
      normalizeProtocol: true,
      normalizeTrailingSlash: true,
    });
    expect(result).toBe('https://example.com/page?b=2');
  });

  it('sorts kept query params alphabetically', () => {
    const result = normalizeUrl('https://example.com/page?z=1&a=2', {
      removeHash: true,
      keepQueryParams: new Set(['a', 'z']),
      normalizeProtocol: true,
      normalizeTrailingSlash: true,
    });
    expect(result).toBe('https://example.com/page?a=2&z=1');
  });

  it('removes trailing slash from path', () => {
    expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page');
  });

  it('keeps root path slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('lowercases hostname', () => {
    expect(normalizeUrl('https://EXAMPLE.COM/Page')).toBe('https://example.com/Page');
  });

  it('strips default port 443 for https', () => {
    expect(normalizeUrl('https://example.com:443/page')).toBe('https://example.com/page');
  });

  it('strips default port 80 for http', () => {
    expect(normalizeUrl('http://example.com:80/page')).toBe('https://example.com/page');
  });

  it('keeps non-default port', () => {
    expect(normalizeUrl('https://example.com:8080/page')).toBe('https://example.com:8080/page');
  });

  it('returns invalid URL as-is', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });

  it('returns empty string as-is', () => {
    expect(normalizeUrl('')).toBe('');
  });
});

describe('generatePageKey', () => {
  it('generates same key for http and https of same host', () => {
    expect(generatePageKey('http://example.com/page')).toBe(
      generatePageKey('https://example.com/page'),
    );
  });

  it('generates same key regardless of hash', () => {
    expect(generatePageKey('https://example.com/page#section1')).toBe(
      generatePageKey('https://example.com/page#section2'),
    );
  });

  it('generates same key regardless of trailing slash', () => {
    expect(generatePageKey('https://example.com/page/')).toBe(
      generatePageKey('https://example.com/page'),
    );
  });

  it('generates same key regardless of default port', () => {
    expect(generatePageKey('https://example.com:443/page')).toBe(
      generatePageKey('https://example.com/page'),
    );
  });

  it('strips all query parameters', () => {
    expect(generatePageKey('https://example.com/page?foo=bar')).toBe(
      generatePageKey('https://example.com/page'),
    );
  });

  it('lowercases hostname', () => {
    expect(generatePageKey('https://EXAMPLE.COM/Page')).toBe('https://example.com/Page');
  });

  it('handles URL with path, query, hash, and port', () => {
    const key = generatePageKey('http://Example.COM:443/path/to/page?a=1&b=2#hash');
    expect(key).toBe('https://example.com/path/to/page');
  });
});
