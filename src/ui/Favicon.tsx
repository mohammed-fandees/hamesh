import { useState } from 'react';
import { browser } from 'wxt/browser';
import { deriveMonogram } from '@/domain/notes-grouping';

interface FaviconProps {
  domain: string;
  size?: number;
}

/**
 * A website's favicon, read from Chrome's own local favicon cache via the
 * `favicon` permission (see wxt.config.ts and PERMISSION_JUSTIFICATIONS.md) —
 * no network request is made. Falls back to a deterministic monogram
 * (initial + palette color, styled to match Hamesh) on a genuine load error.
 *
 * Known platform limitation: when a domain has no cached favicon at all,
 * Chrome's `_favicon` endpoint silently returns its own generic globe
 * placeholder image rather than failing, so `onError` can't catch that case
 * specifically — there is no documented way to distinguish it from a real
 * favicon. In practice this rarely matters here: every domain shown in the
 * Notes Library is one the user has personally visited (that's how the note
 * was created), so Chrome has almost always already cached its favicon.
 */
export function Favicon({ domain, size = 20 }: FaviconProps) {
  const [failed, setFailed] = useState(false);
  const monogram = deriveMonogram(domain);

  if (failed) {
    return (
      <span
        className={`hm-favicon hm-favicon--fallback hm-monogram--${monogram.colorIndex}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {monogram.letter}
      </span>
    );
  }

  const pageUrl = encodeURIComponent(`https://${domain}`);
  const src = `chrome-extension://${browser.runtime.id}/_favicon/?pageUrl=${pageUrl}&size=${size}`;

  return (
    <img
      className="hm-favicon"
      src={src}
      width={size}
      height={size}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
