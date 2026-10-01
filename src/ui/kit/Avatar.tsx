/**
 * A person, as a round monogram — the first letter of their name. A list of
 * people scans as people; there is no picture, and none is worth a request.
 * Someone no longer known (a former member, a deleted comment's author) is a
 * quiet dot. Decorative: the name beside it is what is read out.
 */
export function Avatar({ name }: { name?: string | null }) {
  const initial = name?.trim().slice(0, 1).toLocaleUpperCase();
  return (
    <span className="hm-avatar" data-unknown={initial ? undefined : true} aria-hidden="true">
      {initial || '·'}
    </span>
  );
}
