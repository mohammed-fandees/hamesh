import type { Note } from '@/domain/note';
import type { TeamNotesSource } from '@/teams/page-notes';
import type { PeopleDirectory } from '@/teams/people-cache';
import { relativeTime } from '../format';
import type { Lang } from '../i18n';
import { Avatar } from '../kit/Avatar';
import { StatusLine } from '../kit/Feedback';
import { CloseIcon, SidePanelIcon } from '../kit/icons';
import { escapeLayer } from '../kit/keys';
import { Menu, MenuItem } from '../kit/Menu';
import { NoteDiscussion } from './NoteDiscussion';
import { getTeamsStrings } from './strings';
import css from './page.css?inline';

interface SharedNotePopupProps {
  note: Note & { team: NonNullable<Note['team']> };
  lang: Lang;
  source: TeamNotesSource;
  people: PeopleDirectory;
  /** Whether what the note is attached to was found on the page. */
  anchorAvailable: boolean;
  /** What to say when it was not. */
  unavailableLabel: string;
  onClose: () => void;
}

/**
 * A team's note, opened on the page it belongs to: whose it is and where it
 * was shared, what it says, the latest of its discussion and a field to reply.
 * The whole discussion opens beside the page, in the side panel; the note's
 * own page in Hamesh is in its menu.
 *
 * Read-only here, like every shared note on a page: it is changed from
 * Hamesh's own pages, the only ones that may ask the server.
 *
 * Escape closes it — after the menu, which takes the key first when open.
 */
export function SharedNotePopup({
  note,
  lang,
  source,
  people,
  anchorAvailable,
  unavailableLabel,
  onClose,
}: SharedNotePopupProps) {
  const strings = getTeamsStrings(lang);
  const { id: teamId, name: teamName, authorId } = note.team;
  const author = authorId ? people.people[authorId] : undefined;

  return (
    <div
      className="hm-card hm-shared-card"
      role="dialog"
      aria-label={strings.notePin(author?.name ?? null)}
      onKeyDown={escapeLayer(onClose)}
    >
      <style>{css}</style>
      <span className="hm-connector" data-unavailable={!anchorAvailable} aria-hidden="true" />

      <header className="hm-shared-card__head">
        <Avatar name={author?.name ?? null} src={author?.photo} seed={authorId} />
        <span className="hm-shared-card__who">
          <bdi className="hm-shared-card__author">{author?.name ?? strings.formerMember}</bdi>
          <span className="hm-shared-card__meta">
            <bdi className="hm-shared-card__team">{teamName}</bdi>
            {' · '}
            {relativeTime(note.updatedAt, lang)}
          </span>
        </span>
        <span className="hm-shared-card__tools">
          <button
            type="button"
            className="hm-icon-btn"
            aria-label={strings.openBeside}
            title={strings.openBeside}
            onClick={() => void source.openDiscussion(teamId, note.id)}
          >
            <SidePanelIcon />
          </button>
          <Menu label={strings.noteActions}>
            {(close) => (
              <>
                <MenuItem
                  onSelect={() => {
                    close();
                    void source.openInHamesh(teamId, note.id);
                  }}
                >
                  {strings.openInHamesh}
                </MenuItem>
                <MenuItem
                  onSelect={() => {
                    close();
                    void navigator.clipboard?.writeText(note.content).catch(() => {});
                  }}
                >
                  {strings.copyNote}
                </MenuItem>
              </>
            )}
          </Menu>
          <button
            type="button"
            className="hm-icon-btn"
            aria-label={strings.close}
            title={strings.close}
            onClick={onClose}
          >
            <CloseIcon size={14} />
          </button>
        </span>
      </header>

      {!anchorAvailable && (
        <div className="hm-shared-card__status">
          <StatusLine tone="warning">{unavailableLabel}</StatusLine>
        </div>
      )}

      <p className="hm-shared-card__body" dir="auto">
        {note.content}
      </p>

      <NoteDiscussion note={note} lang={lang} source={source} people={people} />
    </div>
  );
}
