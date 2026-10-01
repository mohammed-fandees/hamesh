import type { ReactNode } from 'react';

/**
 * How Hamesh says something went wrong, is happening, or is so.
 *
 * Three different things, kept apart so each always looks like itself:
 *
 * - `InlineError` — a refusal or a failure, said beside whatever failed, with
 *   the way out when there is one. Never at the top of a page, far from the
 *   control that failed.
 * - `StatusLine` — a standing state: a team that is read-only, a page Hamesh is
 *   active on, a backup that finished. A dot and a line, polite.
 * - `Busy` — this row is acting. An arc and the words, where its controls were,
 *   so the rest of the page stays usable.
 */
export function InlineError({
  children,
  action,
  id,
}: {
  children: ReactNode;
  action?: { label: string; onClick: () => void };
  id?: string;
}) {
  return (
    <div className="hm-alert" role="alert" id={id}>
      <span className="hm-alert__text">{children}</span>
      {action && (
        <button
          type="button"
          className="hm-btn hm-btn-ghost hm-alert__action"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function StatusLine({
  tone,
  children,
}: {
  tone: 'success' | 'warning';
  children: ReactNode;
}) {
  return (
    <p className={`hm-status hm-status--${tone}`} role="status">
      <span className="hm-dot" aria-hidden="true" />
      {children}
    </p>
  );
}

export function Busy({ label }: { label: string }) {
  return (
    <span className="hm-busy" role="status">
      <span className="hm-spinner" aria-hidden="true" />
      {label}
    </span>
  );
}
