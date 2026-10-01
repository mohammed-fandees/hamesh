import { useState } from 'react';

/**
 * A person: their profile picture when they have one, else a round monogram —
 * the first letter of their name. Someone no longer known (a former member, a
 * deleted comment's author) is a quiet dot. Decorative: the name beside it is
 * what is read out.
 *
 * The picture is Google's, and is asked for without a referrer, so Google is
 * not told which page of Hamesh showed it. A picture that fails to load — gone,
 * or blocked by the page it would be drawn over — leaves the monogram.
 */
export function Avatar({ name, src }: { name?: string | null; src?: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  const initial = name?.trim().slice(0, 1).toLocaleUpperCase();
  const picture = src && src !== failed ? src : null;
  return (
    <span
      className="hm-avatar"
      data-unknown={initial || picture ? undefined : true}
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
