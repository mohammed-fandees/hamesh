import { useEffect, useRef } from 'react';
import type { ElementAnchor, Note } from '@/domain/note';
import { firstLineOf } from '@/domain/video-markers';
import { AttachedText } from '../AttachedText';
import { InlineError } from '../kit/Feedback';
import { CloseIcon } from '../kit/icons';
import { escapeLayer } from '../kit/keys';
import type { LostNotesStrings } from '../i18n';

const WHAT_MAX = 60;

/** What an element note was on, in a few words: its tag and the words it showed. */
export function describeElement(anchor: ElementAnchor): string {
  const { tagName, textSnippet, alt, ariaLabel } = anchor.signals;
  const words = (textSnippet ?? alt ?? ariaLabel ?? '').replace(/\s+/g, ' ').trim();
  const cut = words.length > WHAT_MAX ? `${words.slice(0, WHAT_MAX - 1)}…` : words;
  const tag = tagName.toLowerCase();
  return cut ? `${tag} · “${cut}”` : tag;
}

interface LostNotesListProps {
  /** Notes that lost their place: put back, or keep without one. */
  notes: readonly Note[];
  /** Notes kept without a place: read here, as the page's own notes, or put back. */
  kept?: readonly Note[];
  strings: LostNotesStrings;
  /** Said under the list when the last action could not be saved. */
  error: string | null;
  onPutBack: (note: Note) => void;
  onKeep: (note: Note) => void;
  onClose: () => void;
  /** What this reader may do with a note. A team's note is its author's to put back; everyone
   *  else is told whose it is. Every action is allowed when absent. */
  actionsFor?: (note: Note) => NoteActions;
}

/** What may be done with one note in the list, and, when nothing, why. */
export interface NoteActions {
  putBack: boolean;
  keep: boolean;
  /** Said in place of the actions when there are none. */
  whyNot?: string;
}

const NONE: readonly Note[] = [];
const ALL: NoteActions = { putBack: true, keep: true };
const allActions = () => ALL;

/**
 * The notes on this page with no place on it: what each was on (its words, or the element), its
 * words, and the ways forward. Lost notes come first, each with "Put it back" and "Keep without a
 * place"; notes already kept follow, whole, with "Put it back" alone. A card like the page's
 * other cards; the first action takes focus so Escape and Tab work from the moment it opens.
 */
export function LostNotesList({
  notes,
  kept = NONE,
  strings,
  error,
  onPutBack,
  onKeep,
  onClose,
  actionsFor = allActions,
}: LostNotesListProps) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
  }, []);
  const onlyKept = notes.length === 0;
  const items = [
    ...notes.map((note) => ({ note, isKept: false, can: actionsFor(note) })),
    ...kept.map((note) => ({ note, isKept: true, can: actionsFor(note) })),
  ];
  // Focus goes to the first action there is: a list of others' notes may have none.
  const firstActionAt = items.findIndex(({ can }) => can.putBack);

  return (
    <div
      className="hm-card hm-lost-list"
      role="dialog"
      aria-label={onlyKept ? strings.keptTitle : strings.title}
      onKeyDown={escapeLayer(onClose)}
    >
      <div className="hm-lost-list__head">
        <p className="hm-lost-list__title">{onlyKept ? strings.keptTitle : strings.title}</p>
        <button
          type="button"
          className="hm-icon-btn hm-icon-btn--small"
          aria-label={strings.close}
          onClick={onClose}
        >
          <CloseIcon size={10} />
        </button>
      </div>
      <p className="hm-lost-list__intro">{onlyKept ? strings.keptIntro : strings.intro}</p>
      <ul className="hm-lost-list__items">
        {items.map(({ note, isKept, can }, i) => (
          <li key={note.id} className="hm-lost-list__item" aria-label={firstLineOf(note.content)}>
            {note.anchor.type === 'text' ? (
              <AttachedText label="" text={note.anchor.exact} compact />
            ) : note.anchor.type === 'video' ? null : (
              <p className="hm-lost-list__on">
                {strings.onElement}: <bdi>{describeElement(note.anchor)}</bdi>
              </p>
            )}
            {isKept ? (
              <p className="hm-lost-list__note hm-lost-list__note--whole hm-prose" dir="auto">
                {note.content}
              </p>
            ) : (
              <p className="hm-lost-list__note hm-prose" dir="auto">
                {firstLineOf(note.content)}
              </p>
            )}
            <div className="hm-lost-list__actions">
              {can.putBack && (
                <button
                  ref={i === firstActionAt ? firstRef : undefined}
                  type="button"
                  className={
                    isKept
                      ? 'hm-btn hm-btn-ghost hm-btn--compact'
                      : 'hm-btn hm-btn-primary hm-btn--compact'
                  }
                  onClick={() => onPutBack(note)}
                >
                  {strings.putBack}
                </button>
              )}
              {isKept ? (
                <span className="hm-lost-list__kept">{strings.keptLabel}</span>
              ) : (
                can.keep && (
                  <button
                    type="button"
                    className="hm-btn hm-btn-ghost hm-btn--compact"
                    onClick={() => onKeep(note)}
                  >
                    {strings.keep}
                  </button>
                )
              )}
              {!can.putBack && can.whyNot && (
                <span className="hm-lost-list__kept">{can.whyNot}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <InlineError>{error}</InlineError>}
    </div>
  );
}
