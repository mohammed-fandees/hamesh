const QUERY_PARAMS_KEEP = new Set<string>();

export interface PageKeyOptions {
  removeHash: boolean;
  keepQueryParams: Set<string>;
  normalizeProtocol: boolean;
  normalizeTrailingSlash: boolean;
}

const DEFAULT_OPTIONS: PageKeyOptions = {
  removeHash: true,
  keepQueryParams: QUERY_PARAMS_KEEP,
  normalizeProtocol: true,
  normalizeTrailingSlash: true,
};

export function normalizeUrl(url: string, options: PageKeyOptions = DEFAULT_OPTIONS): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  let protocol = parsed.protocol;
  if (options.normalizeProtocol) {
    protocol = protocol.replace(/^https?:$/, 'https:');
  }

  let hostname = parsed.hostname.toLowerCase();
  let port = parsed.port;
  if ((protocol === 'https:' && port === '443') || (protocol === 'http:' && port === '80')) {
    port = '';
  }

  let pathname = parsed.pathname;
  if (options.normalizeTrailingSlash && pathname !== '/') {
    pathname = pathname.replace(/\/+$/, '');
  }

  let hash = '';
  if (!options.removeHash && parsed.hash) {
    hash = parsed.hash;
  }

  const searchParams = new URLSearchParams(parsed.search);
  const keptParams: string[] = [];
  for (const [key, value] of searchParams.entries()) {
    if (options.keepQueryParams.has(key)) {
      keptParams.push(`${key}=${value}`);
    }
  }
  keptParams.sort();
  const search = keptParams.length > 0 ? `?${keptParams.join('&')}` : '';

  let result = `${protocol}//${hostname}`;
  if (port) result += `:${port}`;
  result += pathname;
  result += search;
  result += hash;
  return result;
}

export function generatePageKey(url: string): string {
  return normalizeUrl(url, {
    removeHash: true,
    keepQueryParams: QUERY_PARAMS_KEEP,
    normalizeProtocol: true,
    normalizeTrailingSlash: true,
  });
}
