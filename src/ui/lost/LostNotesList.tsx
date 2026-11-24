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
}

const NONE: readonly Note[] = [];

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
}: LostNotesListProps) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
  }, []);
  const onlyKept = notes.length === 0;
  const items = [
    ...notes.map((note) => ({ note, isKept: false })),
    ...kept.map((note) => ({ note, isKept: true })),
  ];

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
        {items.map(({ note, isKept }, i) => (
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
              <button
                ref={i === 0 ? firstRef : undefined}
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
              {isKept ? (
                <span className="hm-lost-list__kept">{strings.keptLabel}</span>
              ) : (
                <button
                  type="button"
                  className="hm-btn hm-btn-ghost hm-btn--compact"
                  onClick={() => onKeep(note)}
                >
                  {strings.keep}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <InlineError>{error}</InlineError>}
    </div>
  );
}
