import { useId, type ReactNode } from 'react';

interface SettingsGroupProps {
  /** Absent for the first card, which needs no name to say what it holds. */
  title?: string;
  /** A line under the title, for what the group is about. */
  intro?: string;
  /** Kept shut until wanted — for what is looked for rarely, so the page is not
   *  one long column with everything in it open. */
  collapsed?: boolean;
  /** Said beside a collapsed group's title, so it can be judged without opening. */
  hint?: string;
  children: ReactNode;
}

/**
 * One box of related settings.
 *
 * Every settings page is a stack of these rather than a single run of rows, so
 * the page reads as a handful of things and the rare ones can stay closed. The
 * box is the same card the Teams pages use — hairline, radius, padding all come
 * from the card tokens — and a collapsed one is the same panel.
 */
export function SettingsGroup({ title, intro, collapsed, hint, children }: SettingsGroupProps) {
  const titleId = useId();

  if (collapsed && title) {
    return (
      <details className="hm-panel">
        <summary className="hm-panel__summary">
          <span className="hm-panel__title">{title}</span>
          {hint && <span className="hm-panel__hint">{hint}</span>}
        </summary>
        <div className="hm-panel__body">
          {intro && <p className="hm-settings__intro">{intro}</p>}
          {children}
        </div>
      </details>
    );
  }

  return (
    <section className="hm-section" aria-labelledby={title ? titleId : undefined}>
      {title && (
        <h2 className="hm-section__title" id={titleId}>
          {title}
        </h2>
      )}
      {intro && <p className="hm-settings__intro">{intro}</p>}
      {children}
    </section>
  );
}
