import { useState } from 'react';
import type { Note } from '@/domain/note';
import type { TeamsClient } from '@/teams/client';
import type { TeamsErrorCode } from '@/teams/errors';
import type { Lang } from '../i18n';
import { getTeamsStrings } from './strings';

interface ShareNoteActionProps {
  note: Note;
  lang: Lang;
  client: TeamsClient;
  /** The teams this account is in, as the server last listed them. */
  teams: readonly { id: string; name: string }[];
  /** Closes the menu this sits in, once there is nothing left to say. */
  onDone: () => void;
}

/**
 * "Share with team", inside a note's own actions menu in the Notes Library.
 *
 * Sharing happens here rather than on the page: the background worker answers
 * Teams messages only from Hamesh's own pages, and a content script runs inside
 * whatever web page it is on. So the page draws shared notes, and this is where
 * one is handed over.
 *
 * The note itself is unchanged by sharing — it stays on this device exactly as
 * it was. What goes up is a copy the team now has, and the note's own id travels
 * as the idempotency key, so sharing the same note twice is the same share, not
 * a second copy of it.
 */
export function ShareNoteAction({ note, lang, client, teams, onDone }: ShareNoteActionProps) {
  const strings = getTeamsStrings(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TeamsErrorCode | null>(null);

  if (teams.length === 0) return null;

  async function share(teamId: string) {
    setBusy(true);
    setError(null);
    const result = await client.request('notes.share', {
      teamId,
      // The note's own id: a retry of the same share returns the one team note.
      requestId: note.id,
      originalUrl: note.originalUrl,
      ...(note.pageContext?.title ? { pageTitle: note.pageContext.title } : {}),
      content: note.content,
      anchor: note.anchor,
    });
    setBusy(false);
    // Only a success closes the menu: a refusal has to stay on screen long
    // enough to be read.
    if (result.ok) onDone();
    else setError(result.error);
  }

  return (
    <>
      <div className="hm-folder-menu__divider" role="separator" />
      <div className="hm-folder-menu__section-label">{strings.shareWithTeam}</div>
      {teams.map((team) => (
        <button
          key={team.id}
          type="button"
          role="menuitem"
          className="hm-folder-menu__item"
          disabled={busy}
          onClick={() => void share(team.id)}
        >
          <bdi>{team.name}</bdi>
        </button>
      ))}
      {busy && <div className="hm-folder-menu__section-label">{strings.sharingNote}</div>}
      {error && (
        <div className="hm-folder-menu__section-label" role="alert">
          {strings.error(error)}
        </div>
      )}
    </>
  );
}
