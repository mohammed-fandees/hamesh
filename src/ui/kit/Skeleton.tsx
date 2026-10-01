/**
 * The shape of what is loading, pulsing — never a blank, and never a spinner
 * over the whole page. `rows` for a list, `tiles` for a grid of folders,
 * `chips` for a line of people. Hidden from assistive tech: whoever owns the
 * loading says so in words (a `role="status"`), once.
 */
export function Skeleton({
  rows = 3,
  shape = 'rows',
}: {
  rows?: number;
  shape?: 'rows' | 'tiles' | 'chips';
}) {
  return (
    <div className={`hm-skeleton hm-skeleton--${shape}`} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="hm-skeleton__row" />
      ))}
    </div>
  );
}
