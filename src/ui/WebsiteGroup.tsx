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
 * A collapsible website group. The header is two lines even while
 * collapsed — domain/count on top, a one-line preview of the group's most
 * recently edited note beneath it — so the row communicates something real
 * before the user ever expands it, rather than reading as an inert list
 * item. Expanding reveals each note's full preview. The panel animates via
 * a CSS grid-rows + opacity transition (`hm-group__body`, see
 * notes-library.css) rather than JS height measurement, so it's cheap and
 * automatically disabled by the existing `prefers-reduced-motion` override
 * in tokens.css.
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
        <span className="hm-group__header-main">
          <span className="hm-group__header-top">
            <span className="hm-group__domain">{group.domain}</span>
            <span className="hm-group__count">{strings.notesCount(group.count)}</span>
          </span>
          <span className="hm-group__preview">{group.latestNotePreview}</span>
        </span>
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
        <ul className="hm-group__list">
          {group.notes.map((note) => (
            <li key={note.id}>
              <NoteRow note={note} strings={strings} lang={lang} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
