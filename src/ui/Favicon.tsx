import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

interface FaviconProps {
  domain: string;
  size?: number;
}

function faviconUrl(pageUrl: string, size: number): string {
  return `chrome-extension://${browser.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}

function bytesEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const ua = new Uint8Array(a);
  const ub = new Uint8Array(b);
  for (let i = 0; i < ua.length; i++) {
    if (ua[i] !== ub[i]) return false;
  }
  return true;
}

// Chrome's `_favicon` endpoint returns HTTP 200 with a generic placeholder
// image when it has no cached favicon for the requested page — it never
// errors, so `<img onError>` can't tell "no favicon" apart from a real one
// (https://developer.chrome.com/docs/extensions/how-to/ui/favicons). The
// placeholder is deterministic for a given size, so it's identified by
// byte-comparing against a request for a domain guaranteed to have no cached
// favicon — derived live per size (not a hardcoded byte constant), so this
// keeps working across Chrome versions and pixel densities. Cached forever
// per size: at most a handful of one-time probe requests per app lifetime.
const placeholderCache = new Map<number, Promise<ArrayBuffer>>();

function getPlaceholderBytes(size: number): Promise<ArrayBuffer> {
  let bytes = placeholderCache.get(size);
  if (!bytes) {
    const probeUrl = `https://hamesh-favicon-probe-${crypto.randomUUID()}.invalid/`;
    bytes = fetch(faviconUrl(probeUrl, size)).then((res) => res.arrayBuffer());
    // A transient failure (e.g. a momentary extension-runtime hiccup) would
    // otherwise cache a permanently-rejected promise, forcing every future
    // favicon at this size into the globe fallback for the rest of the
    // session. Evict on rejection so the next call retries instead. This
    // `.catch` runs on a separate chain — it doesn't swallow the rejection
    // callers see from the `bytes` promise returned below.
    bytes.catch(() => placeholderCache.delete(size));
    placeholderCache.set(size, bytes);
  }
  return bytes;
}

type LoadState = { status: 'pending' } | { status: 'real'; objectUrl: string } | { status: 'none' };

/**
 * A website's favicon, read from Chrome's own local favicon cache via the
 * `favicon` permission (see wxt.config.ts and PERMISSION_JUSTIFICATIONS.md) —
 * no network request is made. Renders a brand-colored globe icon when Chrome
 * has no real cached favicon for the domain, detected via `getPlaceholderBytes`
 * above rather than `<img onError>` (which can't see this case at all).
 */
export function Favicon({ domain, size = 20 }: FaviconProps) {
  const [state, setState] = useState<LoadState>({ status: 'pending' });

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    (async () => {
      try {
        const [realBuf, placeholderBuf] = await Promise.all([
          fetch(faviconUrl(`https://${domain}`, size)).then((res) => res.arrayBuffer()),
          getPlaceholderBytes(size),
        ]);
        if (cancelled) return;
        if (bytesEqual(realBuf, placeholderBuf)) {
          setState({ status: 'none' });
        } else {
          const objectUrl = URL.createObjectURL(new Blob([realBuf]));
          if (cancelled) {
            // Unmounted/deps-changed between the check above and here —
            // nothing awaited in between so this shouldn't be reachable
            // today, but avoids ever setting state after unmount or leaking
            // this object URL if that ever changes.
            URL.revokeObjectURL(objectUrl);
            return;
          }
          createdUrl = objectUrl;
          setState({ status: 'real', objectUrl: createdUrl });
        }
      } catch {
        if (!cancelled) setState({ status: 'none' });
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [domain, size]);

  if (state.status === 'real') {
    return <img className="hm-favicon" src={state.objectUrl} width={size} height={size} alt="" />;
  }

  if (state.status === 'none') {
    return <GlobeIcon size={size} />;
  }

  // Pending — a same-size empty slot avoids layout shift while the
  // placeholder-vs-real byte comparison above is in flight.
  return (
    <span
      className="hm-favicon hm-favicon--pending"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

function GlobeIcon({ size }: { size: number }) {
  return (
    <svg
      className="hm-favicon hm-favicon--globe"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <ellipse cx="8" cy="8" rx="3" ry="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <line x1="1.5" y1="8" x2="14.5" y2="8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
