import { useState } from 'react';
import type { TeamResponse } from '@hamesh/teams-contract';
import { InlineError } from '../kit/Feedback';
import { InlineConfirm } from '../kit/InlineConfirm';
import { NameField } from '../kit/NameField';
import { Panel } from '../kit/Section';
import { SettingRow } from '../kit/SettingRow';
import { TEAM_NAME_MAX } from './limits';
import { teamCan } from './permissions';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';

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

type Asking = 'leave' | 'delete';

/**
 * The few things that rename or end a team, kept shut until they are wanted.
 *
 * Renaming goes through the one name field every name in Hamesh does, so a
 * team's name is trimmed and held to the server's limit before it is sent.
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
  const [renaming, setRenaming] = useState(false);
  const [asking, setAsking] = useState<Asking | null>(null);
  const teamId = team.team.id;

  async function rename(name: string) {
    if (
      name !== team.team.name &&
      !(await page.run('team.rename', { teamId, name }, 'team.rename'))
    ) {
      return;
    }
    setRenaming(false);
    onRenamed();
  }

  async function leave() {
    const left = await page.run('members.remove', { teamId, userId: myUserId }, 'team.leave');
    setAsking(null);
    if (left !== null) onGone();
  }

  async function remove() {
    const gone = await page.run('team.delete', { teamId }, 'team.delete');
    setAsking(null);
    if (gone !== null) onGone();
  }

  const failed =
    page.failed('team.rename') ?? page.failed('team.leave') ?? page.failed('team.delete');

  return (
    <Panel title={strings.teamSettings} hint={strings.teamSettingsHint}>
      {teamCan(team, 'team.rename') && (
        <div className="hm-settings__body">
          {renaming ? (
            <div className="hm-setting-row">
              <NameField
                label={strings.renameTeam}
                initial={team.team.name}
                maxLength={TEAM_NAME_MAX}
                submitLabel={strings.rename}
                cancelLabel={strings.cancel}
                busy={page.working('team.rename')}
                onCancel={() => setRenaming(false)}
                onSubmit={(name) => void rename(name)}
              />
            </div>
          ) : (
            <SettingRow
              label={strings.renameTeam}
              value={
                <>
                  <bdi className="hm-team-settings__name">{team.team.name}</bdi>
                  <button
                    type="button"
                    className="hm-btn hm-btn-ghost hm-btn--compact"
                    onClick={() => setRenaming(true)}
                  >
                    {strings.rename}
                  </button>
                </>
              }
            />
          )}
        </div>
      )}

      <div className="hm-team-settings__end">
        {asking === 'leave' ? (
          <InlineConfirm
            question={strings.leaveConfirm(team.team.name)}
            confirmLabel={strings.leaveTeam}
            cancelLabel={strings.keepIt}
            working={page.working('team.leave')}
            onConfirm={() => void leave()}
            onCancel={() => setAsking(null)}
          />
        ) : asking === 'delete' ? (
          <InlineConfirm
            question={strings.deleteTeamConfirm(team.team.name)}
            confirmLabel={strings.deleteTeam}
            cancelLabel={strings.keepIt}
            working={page.working('team.delete')}
            onConfirm={() => void remove()}
            onCancel={() => setAsking(null)}
          />
        ) : (
          <>
            {teamCan(team, 'team.leave') && (
              <button
                type="button"
                className="hm-btn hm-btn-ghost"
                onClick={() => setAsking('leave')}
              >
                {strings.leaveTeam}
              </button>
            )}
            {teamCan(team, 'team.delete') && (
              <button
                type="button"
                className="hm-btn hm-btn-ghost hm-btn--danger-text"
                onClick={() => setAsking('delete')}
              >
                {strings.deleteTeam}
              </button>
            )}
          </>
        )}
      </div>
      {failed && <InlineError>{strings.error(failed)}</InlineError>}
    </Panel>
  );
}
