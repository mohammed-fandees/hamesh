import type { Note } from '@/domain/note';
import type { CachedPerson } from '@/teams/people-cache';
import { relativeTime } from '../format';
import type { Lang } from '../i18n';
import { Avatar } from '../kit/Avatar';
import { escapeLayer } from '../kit/keys';
import { getTeamsStrings } from './strings';
import css from './page.css?inline';

interface TeamPinListProps {
  items: { note: Note; person: CachedPerson | undefined }[];
  lang: Lang;
  onSelect: (noteId: string) => void;
  onClose: () => void;
}

/** The shared notes behind one cluster pin: whose each is, and how it begins. */
export function TeamPinList({ items, lang, onSelect, onClose }: TeamPinListProps) {
  const strings = getTeamsStrings(lang);
  return (
    <div
      className="hm-card hm-pin-list"
      role="dialog"
      aria-label={strings.clusterPin(items.length)}
      onKeyDown={escapeLayer(onClose)}
    >
      <style>{css}</style>
      <ul className="hm-pin-list__items">
        {items.map(({ note, person }) => (
          <li key={note.id}>
            <button type="button" className="hm-pin-list__item" onClick={() => onSelect(note.id)}>
              <Avatar name={person?.name ?? null} src={person?.photo} seed={note.team?.authorId} />
              <span className="hm-pin-list__text">
                <span className="hm-pin-list__who">
                  <bdi>{person?.name ?? strings.formerMember}</bdi> ·{' '}
                  {relativeTime(note.updatedAt, lang)}
                </span>
                <span className="hm-pin-list__body" dir="auto">
                  {note.content}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
