import { useId, useState, type ReactNode } from 'react';
import { ChevronIcon } from '../kit/icons';

interface SpaceCardProps {
  /** The space's glyph: a screen for this device, people for a team. */
  icon: ReactNode;
  title: string;
  /** Where its notes live, and how many — the difference between spaces, said. */
  meta: string;
  /** A team's: the glyph takes the accent, so a shared space reads as one. */
  shared?: boolean;
  /** Said under the header, about the space as a whole (a refused change). */
  alert?: ReactNode;
  children: ReactNode;
}

/**
 * One space in the Library's folder view — the reader's own notes, or one
 * team's — as a card that opens and shuts.
 *
 * Every space has the same folders, rows and menus, so the one thing that sets
 * them apart has to be said plainly: the header says whose notes these are and
 * where they live ("on this device only", "shared on the server").
 */
export function SpaceCard({ icon, title, meta, shared, alert, children }: SpaceCardProps) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  return (
    <section className="hm-space" data-shared={shared || undefined} aria-label={title}>
      <button
        type="button"
        className="hm-space__head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="hm-space__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="hm-space__titles">
          <span className="hm-space__title">
            <bdi>{title}</bdi>
          </span>
          <span className="hm-space__meta">{meta}</span>
        </span>
        <ChevronIcon className="hm-space__chevron" />
      </button>
      {alert}
      <div id={bodyId} className="hm-space__body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
