import { useEffect, useId, useRef, type ReactNode } from 'react';
import { revealElement } from '@/utils/dom';

interface SectionProps {
  /** Absent for a card that needs no name to say what it holds. */
  title?: string;
  /** A quiet line beside the title — a count, when it was last synced. */
  meta?: ReactNode;
  /** Controls for the whole card, at the far end of its heading. */
  actions?: ReactNode;
  /** A line under the title, for what the card is about. */
  intro?: ReactNode;
  /** The card's rows run edge to edge, carrying their own padding. */
  flush?: boolean;
  /** The card's name when it has no visible title. */
  label?: string;
  children: ReactNode;
}

/**
 * A card on one of Hamesh's pages: a hairline, the large radius, the card
 * padding, and a heading row. Every page is a stack of these — Settings' groups,
 * a team's notes and its people, the members list, a shared note — so a page
 * reads as a handful of one kind of thing.
 */
export function Section({ title, meta, actions, intro, flush, label, children }: SectionProps) {
  const titleId = useId();
  const head = title || meta || actions;
  return (
    <section
      className={flush ? 'hm-section hm-section--flush' : 'hm-section'}
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : label}
    >
      {head && (
        <header className="hm-section__head">
          {title && (
            <h2 className="hm-section__title" id={titleId}>
              {title}
            </h2>
          )}
          {meta && <span className="hm-section__meta">{meta}</span>}
          {actions && <span className="hm-section__actions">{actions}</span>}
        </header>
      )}
      {intro && <p className="hm-section__intro">{intro}</p>}
      {children}
    </section>
  );
}

interface PanelProps {
  title: string;
  /** Said beside the title, so the panel can be judged without opening it. */
  hint?: string;
  intro?: ReactNode;
  /** Open it and bring it into view on arrival — the reader was sent here for it. */
  reveal?: boolean;
  children: ReactNode;
}

/**
 * A card that stays shut until it is wanted — for what is looked for rarely
 * (Backup, a team's settings, earlier releases), so a page is not one long
 * column with everything in it open. The same card as `Section`, as a native
 * disclosure: keyboard and screen readers get it for free.
 */
export function Panel({ title, hint, intro, reveal = false, children }: PanelProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const panel = ref.current;
    if (!reveal || !panel) return;
    panel.open = true;
    // Its top, not its middle — and again as what it holds arrives and it grows,
    // for a moment only, and never once the reader has scrolled themselves.
    const align = () => revealElement(panel, 'start');
    align();
    const grows = new ResizeObserver(align);
    grows.observe(panel);
    const stop = () => grows.disconnect();
    const timer = window.setTimeout(stop, 2000);
    window.addEventListener('wheel', stop, { once: true, passive: true });
    window.addEventListener('keydown', stop, { once: true });
    return () => {
      stop();
      window.clearTimeout(timer);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('keydown', stop);
    };
  }, [reveal]);
  return (
    <details ref={ref} className="hm-panel">
      <summary className="hm-panel__summary">
        {/* A heading, as every card's title is, so the page's outline is the
            same whether a card is open or shut. */}
        <h2 className="hm-panel__title">{title}</h2>
        {hint && <span className="hm-panel__hint">{hint}</span>}
      </summary>
      <div className="hm-panel__body">
        {intro && <p className="hm-section__intro">{intro}</p>}
        {children}
      </div>
    </details>
  );
}
