import { useState } from 'react';
import type { Announcement, AnnouncementDestination } from '@/domain/announcements';
import type { Lang } from '../i18n';
import { MarginMark } from '../kit/MarginMark';
import { ChevronIcon, CloseIcon } from '../kit/icons';
import { getTeamsStrings } from './strings';
import './styles';

interface AnnouncementBannerProps {
  lang: Lang;
  /** What is waiting, most important first; one shows at a time. */
  items: readonly Announcement[];
  onOpen: (to: AnnouncementDestination) => void;
  /** The "×": not now. */
  onClose: (id: string) => void;
  /** "Don't show again": not ever. */
  onDismiss: (id: string) => void;
}

/**
 * Something Hamesh wants to say, over its own pages and never over anyone's web
 * page. One slot, however many are waiting: closing one brings up the next, and
 * arrows walk them, so the notes below stay where the reader left them.
 */
export function AnnouncementBanner({
  lang,
  items,
  onOpen,
  onClose,
  onDismiss,
}: AnnouncementBannerProps) {
  const strings = getTeamsStrings(lang);
  const [wanted, setWanted] = useState(0);
  if (items.length === 0) return null;
  // Whatever just closed may have been the last one in the list.
  const index = Math.min(wanted, items.length - 1);
  const item = items[index];
  const action = item.action;

  return (
    <aside className="hm-announcement hm-fade-in" aria-label={strings.announcementLabel}>
      <MarginMark size={16} strokeWidth={3.5} className="hm-announcement__mark" />
      <div className="hm-announcement__text">
        <p className="hm-announcement__title">{item.title[lang]}</p>
        {item.body && <p className="hm-announcement__body">{item.body[lang]}</p>}
      </div>
      <div className="hm-announcement__actions">
        {action &&
          ('open' in action.to ? (
            <button
              type="button"
              className="hm-btn hm-btn-primary hm-btn--compact"
              onClick={() => {
                if ('open' in action.to) onOpen(action.to.open);
              }}
            >
              {action.label[lang]}
            </button>
          ) : (
            <a
              className="hm-btn hm-btn-primary hm-btn--compact"
              href={action.to.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {action.label[lang]}
            </a>
          ))}
        <button type="button" className="hm-link" onClick={() => onDismiss(item.id)}>
          {strings.announcementDismiss}
        </button>
        {items.length > 1 && (
          <span className="hm-announcement__pager">
            <button
              type="button"
              className="hm-icon-btn"
              aria-label={strings.announcementPrevious}
              disabled={index === 0}
              onClick={() => setWanted(index - 1)}
            >
              <ChevronIcon direction="back" />
            </button>
            <span>{strings.announcementPosition(index + 1, items.length)}</span>
            <button
              type="button"
              className="hm-icon-btn"
              aria-label={strings.announcementNext}
              disabled={index === items.length - 1}
              onClick={() => setWanted(index + 1)}
            >
              <ChevronIcon direction="forward" />
            </button>
          </span>
        )}
        <button
          type="button"
          className="hm-icon-btn"
          aria-label={strings.announcementClose}
          title={strings.announcementClose}
          onClick={() => onClose(item.id)}
        >
          <CloseIcon size={11} />
        </button>
      </div>
    </aside>
  );
}
