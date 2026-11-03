import { useMemo, useState } from 'react';
import { isSharedNote, type Note } from '@/domain/note';
import { extractDomain, filterNotesByQuery, pageLabelFrom } from '@/domain/notes-grouping';
import type { TeamsErrorCode } from '@/teams/errors';
import { failureOf, useWork } from '../hooks/useWork';
import { InlineError } from '../kit/Feedback';
import type { TeamsStrings } from './strings';

/** Enough to scroll through; searching is how anyone finds an older one. */
const SHOWN = 30;

interface ShareFromDeviceProps {
  strings: TeamsStrings;
  /** This device's notes. A team's own are filtered out here. */
  notes: readonly Note[];
  /** Shares one; `false` if the reader declined the consent question. */
  onShare: (note: Note) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Picking one of this device's notes to share, without leaving the team.
 * Sharing moves a note, so a row leaves this list the moment it is in the team.
 */
export function ShareFromDevice({ strings, notes, onShare, onClose }: ShareFromDeviceProps) {
  const [query, setQuery] = useState('');
  const work = useWork((error) => failureOf<TeamsErrorCode>(error, 'internal'));

  const mine = useMemo(() => notes.filter((note) => !isSharedNote(note)), [notes]);
  const found = useMemo(
    () =>
      filterNotesByQuery(mine, query)
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, SHOWN),
    [mine, query],
  );

  return (
    <div className="hm-share-pick">
      <div className="hm-share-pick__head">
        <p className="hm-share-pick__title">{strings.sharePickTitle}</p>
        <button type="button" className="hm-link" onClick={onClose}>
          {strings.cancel}
        </button>
      </div>
      {mine.length === 0 ? (
        <p className="hm-supporting">{strings.sharePickEmpty}</p>
      ) : (
        <>
          <input
            type="search"
            className="hm-input"
            placeholder={strings.sharePickSearch}
            aria-label={strings.sharePickSearch}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="hm-share-pick__list">
            {found.map((note) => {
              const key = `share:${note.id}`;
              const failed = work.failed(key);
              return (
                <li key={note.id} className="hm-share-pick__row">
                  <div className="hm-share-pick__text">
                    <p className="hm-share-pick__content hm-prose" dir="auto">
                      {note.content}
                    </p>
                    <p className="hm-share-pick__meta">
                      <bdi>{pageLabelFrom(note.pageContext?.title ?? null, note.originalUrl)}</bdi>
                      <span aria-hidden="true"> · </span>
                      <span>{extractDomain(note.originalUrl)}</span>
                    </p>
                    {failed && <InlineError>{strings.error(failed)}</InlineError>}
                  </div>
                  <button
                    type="button"
                    className="hm-btn hm-btn-ghost hm-btn--compact"
                    disabled={work.working(key)}
                    aria-busy={work.working(key)}
                    onClick={() => void work.run(key, () => onShare(note))}
                  >
                    {strings.sharePickAction}
                  </button>
                </li>
              );
            })}
          </ul>
          {found.length === 0 && (
            <p className="hm-supporting">{strings.sharePickNoMatches(query.trim())}</p>
          )}
        </>
      )}
    </div>
  );
}
