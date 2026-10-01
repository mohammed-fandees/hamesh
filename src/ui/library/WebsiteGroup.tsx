import { useId, type CSSProperties } from 'react';
import type { WebsiteGroup as WebsiteGroupData } from '@/domain/notes-grouping';
import { Favicon } from '../Favicon';
import { ChevronIcon } from '../kit/icons';
import type { Lang, Strings } from '../i18n';
import { NoteRow } from './NoteRow';

interface WebsiteGroupProps {
  group: WebsiteGroupData;
  expanded: boolean;
  onToggle: () => void;
  strings: Strings;
  lang: Lang;
  /** The list's staggered entrance (`stagger()`). */
  style?: CSSProperties;
}

/**
 * One site's notes, as a card: its favicon, name and count as the header, and
 * — once opened — its notes as rows inside, a hairline between each.
 *
 * The opening animates height through CSS grid rows (`hm-group__body`), not
 * measurement, so it is cheap and switched off with the rest of Hamesh's
 * motion under `prefers-reduced-motion`. A closed group is `inert` as well as
 * hidden, so nothing inside it can be tabbed to.
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
    <div className="hm-group hm-fade-in" style={style} data-expanded={expanded}>
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
        <ChevronIcon className="hm-group__chevron" />
      </button>
      <div
        id={panelId}
        className="hm-group__body"
        data-expanded={expanded}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        {/* The `0fr` row is sized from its one grid item's minimum, padding
            included, so the item is this padding-less wrapper; the list's own
            spacing overflows it and is clipped while closed. */}
        <div className="hm-group__body-inner">
          <ul className="hm-rows">
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
