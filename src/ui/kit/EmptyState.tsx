import type { ReactNode } from 'react';
import { MarginMark } from './MarginMark';

interface EmptyStateProps {
  title: string;
  body?: ReactNode;
  /** What to do about it — every empty state that can offer a way out does. */
  action?: { label: string; onClick: () => void; tone?: 'primary' | 'ghost' };
  /** `page` fills a page; `inline` sits inside a card; `compact` is the popup. */
  size?: 'page' | 'inline' | 'compact';
}

/**
 * "Nothing here", said in Hamesh's voice: the mark, what is (or isn't) here,
 * why, and the one control that does something about it.
 *
 * The one empty state — for a Library with no notes, a search with no matches,
 * a team with no notes yet, a note with no comments, a page the popup cannot
 * work on — so each says something different and all of them look like one
 * thing.
 */
export function EmptyState({ title, body, action, size = 'page' }: EmptyStateProps) {
  return (
    <div className={`hm-empty hm-empty--${size} hm-fade-in`}>
      <MarginMark size={size === 'page' ? 28 : 22} strokeWidth={3} />
      <p className="hm-empty__title">{title}</p>
      {body && <p className="hm-empty__body">{body}</p>}
      {action && (
        <button
          type="button"
          className={`hm-btn hm-btn-${action.tone ?? 'primary'} hm-empty__action`}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
