import { useState } from 'react';
import type { TeamResponse } from '@hamesh/teams-contract';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import { InlineConfirm } from './InlineConfirm';

interface TeamSettingsProps {
  strings: TeamsStrings;
  page: TeamsPage;
  team: TeamResponse;
  myUserId: string;
  /** After the team was renamed, so what is shown is the server's version. */
  onRenamed: () => void;
  /** After the reader left the team or it was deleted — it is no longer theirs to show. */
  onGone: () => void;
}

/**
 * The few things that end or rename a team, kept shut until they are wanted.
 *
 * Leaving and deleting are asked about on the spot, in the panel itself, and
 * say what they are doing where they are doing it. Which of them appear is what
 * the server said this caller may do; it checks again on the request.
 */
export function TeamSettings({
  strings,
  page,
  team,
  myUserId,
  onRenamed,
  onGone,
}: TeamSettingsProps) {
  const [renaming, setRenaming] = useState(team.team.name);
  /** Which irreversible thing is waiting to be confirmed, if any. */
  const [confirming, setConfirming] = useState<'leave' | 'delete' | null>(null);
  const can = (action: string) => team.capabilities.includes(action as never);

  // A different team, or the same one renamed elsewhere, starts the field over.
  // Adjusted during render: there is no async work here.
  const [seen, setSeen] = useState(team.team.name);
  if (seen !== team.team.name) {
    setSeen(team.team.name);
    setRenaming(team.team.name);
  }

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (renaming.trim() === team.team.name) return;
    await page.run('team.rename', { teamId: team.team.id, name: renaming }, 'team.rename');
    onRenamed();
  }

  async function leave() {
    const left = await page.run(
      'members.remove',
      { teamId: team.team.id, userId: myUserId },
      'team.leave',
    );
    setConfirming(null);
    if (left !== null) onGone();
  }

  async function remove() {
    const gone = await page.run('team.delete', { teamId: team.team.id }, 'team.delete');
    setConfirming(null);
    if (gone !== null) onGone();
  }

  return (
    <details className="hm-panel">
      <summary className="hm-panel__summary">
        <span className="hm-panel__title">{strings.teamSettings}</span>
        <span className="hm-panel__hint">{strings.teamSettingsHint}</span>
      </summary>
      <div className="hm-panel__body">
        {can('team.rename') && (
          <form className="hm-team-invite" onSubmit={rename}>
            <input
              type="text"
              required
              className="hm-input"
              aria-label={strings.renameTeam}
              value={renaming}
              onChange={(e) => setRenaming(e.target.value)}
            />
            <button
              type="submit"
              className="hm-btn hm-btn-ghost"
              disabled={page.working('team.rename')}
              aria-busy={page.working('team.rename')}
            >
              {strings.rename}
            </button>
          </form>
        )}
        {page.failed('team.rename') && (
          <p className="hm-field-error" role="alert">
            {strings.error(page.failed('team.rename')!)}
          </p>
        )}

        {confirming === 'leave' ? (
          <InlineConfirm
            strings={strings}
            question={strings.leaveConfirm(team.team.name)}
            confirmLabel={strings.leaveTeam}
            working={page.working('team.leave')}
            onConfirm={() => void leave()}
            onCancel={() => setConfirming(null)}
          />
        ) : confirming === 'delete' ? (
          <InlineConfirm
            strings={strings}
            question={strings.deleteConfirm(team.team.name)}
            confirmLabel={strings.deleteTeam}
            working={page.working('team.delete')}
            onConfirm={() => void remove()}
            onCancel={() => setConfirming(null)}
          />
        ) : (
          <div className="hm-team-invite">
            {can('team.leave') && (
              <button
                type="button"
                className="hm-btn hm-btn-ghost"
                onClick={() => setConfirming('leave')}
              >
                {strings.leaveTeam}
              </button>
            )}
            {can('team.delete') && (
              <button
                type="button"
                className="hm-btn hm-btn-ghost"
                onClick={() => setConfirming('delete')}
              >
                {strings.deleteTeam}
              </button>
            )}
          </div>
        )}
        {(page.failed('team.leave') || page.failed('team.delete')) && (
          <p className="hm-field-error" role="alert">
            {strings.error((page.failed('team.leave') ?? page.failed('team.delete'))!)}
          </p>
        )}
      </div>
    </details>
  );
}
