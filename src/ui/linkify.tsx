import type { ReactNode } from 'react';

const URL_RE = /https?:\/\/[^\s<>'")\]]+|www\.[^\s<>'")\]]+\.[^\s<>'")\]]+/g;

function wrapUrl(url: string, key: number): ReactNode {
  const href = url.startsWith('www.') ? `https://${url}` : url;
  return (
    <a
      key={key}
      className="hm-link-url"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {url}
    </a>
  );
}

/**
 * Splits plain text by detected URLs and wraps them in clickable <a> tags.
 * Non-URL segments are returned as plain strings.
 */
export function linkify(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    parts.push(wrapUrl(match[0], start));
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
