import { useState } from 'react';

/** How many tones a monogram may take — see `.hm-avatar[data-tone]`. */
export const AVATAR_TONES = 4;

/** A person's tone: the same for the same id, everywhere and always. */
export function toneOf(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % AVATAR_TONES;
}

/**
 * A person: their profile picture when they have one, else a round monogram —
 * the first letter of their name. Someone no longer known (a former member, a
 * deleted comment's author) is a quiet dot. Decorative: the name beside it is
 * what is read out.
 *
 * The picture is Google's, and is asked for without a referrer, so Google is
 * not told which page of Hamesh showed it. A picture that fails to load — gone,
 * or blocked by the page it would be drawn over — leaves the monogram.
 *
 * Given `seed` (the person's id), the monogram takes one of a few tones, always
 * the same one for the same person, so people can be told apart at a glance.
 */
export function Avatar({
  name,
  src,
  seed,
}: {
  name?: string | null;
  src?: string | null;
  seed?: string | null;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const initial = name?.trim().slice(0, 1).toLocaleUpperCase();
  const picture = src && src !== failed ? src : null;
  return (
    <span
      className="hm-avatar"
      data-unknown={initial || picture ? undefined : true}
      data-tone={initial && seed ? toneOf(seed) : undefined}
      aria-hidden="true"
    >
      {picture ? (
        <img
          className="hm-avatar__picture"
          src={picture}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(picture)}
        />
      ) : (
        initial || '·'
      )}
    </span>
  );
}
