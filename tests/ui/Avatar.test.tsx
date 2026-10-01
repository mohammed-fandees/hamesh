// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AVATAR_TONES, Avatar, toneOf } from '@/ui/kit/Avatar';

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

  it('gives each person one tone, the same wherever they appear', () => {
    const { container, rerender } = render(
      <Avatar name="Sara" seed="01J0000000000000000000000S" />,
    );
    const tone = container.querySelector('.hm-avatar')!.getAttribute('data-tone');
    expect(tone).toBe(String(toneOf('01J0000000000000000000000S')));
    rerender(<Avatar name="Sara" seed="01J0000000000000000000000S" />);
    expect(container.querySelector('.hm-avatar')).toHaveAttribute('data-tone', tone);
    // Spread across the tones rather than all landing on one.
    const tones = new Set(Array.from({ length: 40 }, (_, i) => toneOf(`user-${i}`)));
    expect(tones.size).toBe(AVATAR_TONES);
  });

  it('takes no tone for someone unknown', () => {
    const { container } = render(<Avatar name={null} seed="01J0000000000000000000000S" />);
    expect(container.querySelector('.hm-avatar')).not.toHaveAttribute('data-tone');
  });
});
