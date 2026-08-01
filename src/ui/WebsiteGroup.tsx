import { useId } from 'react';
import { Favicon } from './Favicon';
import { NoteRow } from './NoteRow';
import type { WebsiteGroup as WebsiteGroupData } from '@/domain/notes-grouping';
import type { Lang, Strings } from './i18n';

interface WebsiteGroupProps {
  group: WebsiteGroupData;
  expanded: boolean;
  onToggle: () => void;
  strings: Strings;
  lang: Lang;
  /** Passed through for the initial staggered fade-in (see App.tsx) — kept
   *  here rather than an extra wrapper element so `.hm-groups > li + li`'s
   *  separator rule still sees plain, unwrapped siblings. */
  style?: React.CSSProperties;
}

/**
 * A collapsible website group — favicon, hostname, note count, and (when
 * expanded) each note's preview. The expand/collapse panel animates height
 * via a CSS grid-rows transition (`hm-group__body`, see notes-library.css)
 * rather than JS height measurement, so it's cheap and automatically
 * disabled by the existing `prefers-reduced-motion` override in tokens.css.
 */
export function WebsiteGroup({
  group,
  expanded,
  onToggle,
  strings,
  lang,
  style,
}: WebsiteGroupProps) {
  const panelId = useId();
  return (
    <div className="hm-group hm-fade-in" style={style}>
      <button
        type="button"
        className="hm-group__header"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <Favicon domain={group.domain} />
        <span className="hm-group__domain">{group.domain}</span>
        <span className="hm-group__count">{strings.notesCount(group.count)}</span>
        <svg
          className="hm-group__chevron"
          data-expanded={expanded}
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
        >
          <path
            d="M2 3.5 L5 6.5 L8 3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </button>
      <div
        id={panelId}
        className="hm-group__body"
        data-expanded={expanded}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        {/* `.hm-group__body`'s `grid-template-rows: 0fr` collapse trick sizes
         *  its row track from its direct grid item's own required minimum —
         *  which includes that item's own padding, since padding is never
         *  shrunk. A `min-height: 0` override doesn't cancel that: it only
         *  cancels the item's *content* driving a larger minimum, not its
         *  padding. `.hm-group__list` has vertical padding (see CSS), so it
         *  can't be the direct grid item itself, or the row (and the
         *  collapsed panel) settles at that padding's height instead of 0
         *  (same bug, same fix as `.hm-folder-node__body-inner`). This
         *  wrapper has no padding of its own, so the row genuinely
         *  collapses to 0 — the list's padding then simply overflows *this*
         *  wrapper's own box, where its own `overflow: hidden` clips it. */}
        <div className="hm-group__body-inner">
          <ul className="hm-group__list">
            {group.notes.map((note) => (
              <li key={note.id}>
                <NoteRow note={note} strings={strings} lang={lang} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
