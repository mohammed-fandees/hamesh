// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { linkify } from '@/ui/linkify';

describe('linkify', () => {
  it('returns plain text as a single string when no URLs', () => {
    const result = linkify('Hello world');
    expect(result).toEqual(['Hello world']);
  });

  it('wraps an https URL in an anchor tag', () => {
    const { container } = render(<span>{linkify('Visit https://example.com now')}</span>);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveClass('hm-link-url');
  });

  it('prepends https:// to www. URLs', () => {
    const { container } = render(<span>{linkify('Go to www.example.com/path')}</span>);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', 'https://www.example.com/path');
    expect(link!.textContent).toBe('www.example.com/path');
  });

  it('handles multiple URLs in one string', () => {
    const { container } = render(<span>{linkify('See https://a.com and https://b.com')}</span>);
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', 'https://a.com');
    expect(links[1]).toHaveAttribute('href', 'https://b.com');
  });

  it('handles URL at start of string', () => {
    const { container } = render(<span>{linkify('https://start.com is first')}</span>);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', 'https://start.com');
    expect(container.textContent).toContain(' is first');
  });

  it('handles URL at end of string', () => {
    const { container } = render(<span>{linkify('See https://end.com')}</span>);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', 'https://end.com');
  });

  it('handles URL with path, query, and fragment', () => {
    const { container } = render(<span>{linkify('https://example.com/path?q=1#section')}</span>);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', 'https://example.com/path?q=1#section');
  });

  it('returns [""] for empty string', () => {
    const result = linkify('');
    expect(result).toEqual(['']);
  });

  it('handles http:// URLs', () => {
    const { container } = render(<span>{linkify('http://insecure.com')}</span>);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', 'http://insecure.com');
  });
});
