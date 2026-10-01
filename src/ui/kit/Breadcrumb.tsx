export interface Crumb {
  label: string;
  /** Absent on the page the reader is on. */
  onClick?: () => void;
}

/**
 * The trail back from a page reached from another — Teams / Alpha / Who's in it.
 *
 * Every step but the last is a control, and the last says where the reader is.
 * The separators are drawn by the stylesheet rather than typed, so a screen
 * reader hears a list of places and not a run of slashes — and they turn with
 * the reading direction.
 */
export function Breadcrumb({ label, items }: { label: string; items: Crumb[] }) {
  return (
    <nav aria-label={label}>
      <ol className="hm-breadcrumb">
        {items.map((item, i) => (
          <li key={i} className="hm-breadcrumb__item">
            {item.onClick ? (
              <button type="button" className="hm-link" onClick={item.onClick}>
                <bdi>{item.label}</bdi>
              </button>
            ) : (
              <span aria-current="page">
                <bdi>{item.label}</bdi>
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
