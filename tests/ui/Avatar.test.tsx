// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Avatar } from '@/ui/kit/Avatar';

const PHOTO = 'https://lh3.googleusercontent.com/a/photo';

afterEach(cleanup);

describe('a person, as a picture or a monogram', () => {
  it('shows their picture, asked for without a referrer', () => {
    const { container } = render(<Avatar name="Sara" src={PHOTO} />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', PHOTO);
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(img).toHaveAttribute('alt', '');
  });

  it('falls back to their first letter when the picture will not load', () => {
    const { container } = render(<Avatar name="sara" src={PHOTO} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.hm-avatar')).toHaveTextContent('S');
  });

  it('is a monogram without a picture, and a quiet dot for someone unknown', () => {
    const { container, rerender } = render(<Avatar name="Omar" />);
    expect(container.querySelector('.hm-avatar')).toHaveTextContent('O');
    rerender(<Avatar name={null} />);
    expect(container.querySelector('.hm-avatar')).toHaveAttribute('data-unknown', 'true');
  });
});
