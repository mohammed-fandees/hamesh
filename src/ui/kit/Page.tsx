import type { ReactNode } from 'react';
import { MarginMark } from './MarginMark';

/**
 * One of Hamesh's own pages beside the sidebar: the Library, Settings, What's
 * New, Teams, Mentions. A reading column by default; `wide` for the pages whose
 * content is grids of cards rather than lines of text.
 */
export function Page({ wide = false, children }: { wide?: boolean; children: ReactNode }) {
  return (
    <main className="hm-page">
      <div className={wide ? 'hm-page__inner hm-page__inner--wide' : 'hm-page__inner'}>
        {children}
      </div>
    </main>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  /** A quiet line beside the title — a count, a state. */
  meta?: ReactNode;
  /** Controls that act on the whole page, at the header's far end. */
  actions?: ReactNode;
  /**
   * A destination the sidebar opens carries the mark; a page reached from
   * another (a team's people, one shared note) has a breadcrumb above it
   * instead, and sits closer under it.
   */
  level?: 'top' | 'sub';
}

export function PageHeader({ title, meta, actions, level = 'top' }: PageHeaderProps) {
  return (
    <header className={`hm-page-header hm-page-header--${level}`}>
      {level === 'top' && (
        <MarginMark size={20} strokeWidth={3.5} className="hm-mark hm-page-header__mark" />
      )}
      <h1 className="hm-page-header__title">{title}</h1>
      {meta && <span className="hm-page-header__meta">{meta}</span>}
      {actions && <span className="hm-page-header__actions">{actions}</span>}
    </header>
  );
}
