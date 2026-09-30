import { useCallback, useEffect, useState } from 'react';
import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import type { Lang } from '../i18n';
import type { TeamsClient } from '@/teams/client';
import { newRequestId } from '@/teams/operation-names';
import { MarginMark } from '../MarginMark';
import { SegmentedControl } from '../SegmentedControl';
import { getTeamsStrings } from './strings';
import './styles';
import { useTeams } from './useTeams';
import { formatDate } from './format';
import { InlineConfirm } from './InlineConfirm';
import { TeamMembers } from './TeamMembers';
import { TeamInvitations } from './TeamInvitations';
import { TeamNotes } from './TeamNotes';
import type { PersonalNotes } from './personal-notes';

interface TeamsViewProps {
  lang: Lang;
  client: TeamsClient;
  /** Sends the reader to Settings, where Teams is turned on and signed into. */
  onOpenSettings: () => void;
  /** Sends the reader to the Notes Library, where notes are shared from. */
  onOpenLibrary: () => void;
  /** How a note moves between this device and a team — see `PersonalNotes`. */
  personal: PersonalNotes;
}

/**
 * The Teams page: the notes a team keeps, who is in it, and what can be done
 * about either.
 *
 * Notes come first, because that is what a team is for. Who is in it, and the
 * handful of things that end a team, are folded away until they are wanted —
 * the same progressive disclosure the rest of the library is built on, rather
 * than one long column with everything open at once.
 *
 * Joining a team and paying for one are not here: they belong to the account,
 * and the account lives in Settings. Mentions are their own destination, for
 * the same reason.
 *
 * The page decides nothing. Which teams exist, what this reader may do in each,
 * and whether a team is active, read-only or locked all arrive from the server
 * on every visit, and the page is redrawn from that answer after anything it
 * changes.
 */
export function TeamsView({
  lang,
  client,
  onOpenSettings,
  onOpenLibrary,
  personal,
}: TeamsViewProps) {
  const strings = getTeamsStrings(lang);
  const page = useTeams(client);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState('');
  /** Which irreversible thing is waiting to be confirmed, if any. */
  const [confirming, setConfirming] = useState<'leave' | 'delete' | null>(null);

  const me = page.me;
  const teams = me?.teams ?? [];

  // Derived, not synchronised: whichever team was chosen, as long as the
  // server still lists it, and otherwise the first one. Nothing to keep in
  // step, so there is no effect here to get out of step.
  const selectedId =
    chosenId && teams.some((t) => t.id === chosenId) ? chosenId : (teams[0]?.id ?? null);

  const loadTeam = useCallback(async () => {
    if (!selectedId) {
      setTeam(null);
      setMembers(null);
      return;
    }
    const result = await page.run('team.get', { teamId: selectedId });
    setTeam(result);
    if (result) setRenaming(result.team.name);
    const who = await page.run('members.list', { teamId: selectedId });
    setMembers(who?.members ?? null);
    // `page` is rebuilt on every render; the chosen team is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // The await is inlined rather than calling `loadTeam()`: state set on an
  // effect's synchronous path cascades a render. `loadTeam` stays for the
  // reloads that follow a change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedId) {
        setTeam(null);
        setMembers(null);
        return;
      }
      const result = await page.run('team.get', { teamId: selectedId });
      if (cancelled) return;
      setTeam(result);
      if (result) setRenaming(result.team.name);
      const who = await page.run('members.list', { teamId: selectedId });
      if (cancelled) return;
      setMembers(who?.members ?? null);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  /** After anything that changes the team or my membership of it. */
  const reload = useCallback(async () => {
    await page.refresh();
    await loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTeam]);

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    // A retry of the same create returns the original team rather than a second one.
    const result = await page.run(
      'team.create',
      { name: newName, requestId: newRequestId() },
      'team.create',
    );
    if (!result) return;
    setNewName('');
    setCreating(false);
    setChosenId(result.team.id);
    await page.refresh();
  }

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!team || renaming.trim() === team.team.name) return;
    await page.run('team.rename', { teamId: team.team.id, name: renaming }, 'team.rename');
    await reload();
  }

  async function leave() {
    if (!team || !me) return;
    const left = await page.run(
      'members.remove',
      { teamId: team.team.id, userId: me.user.id },
      'team.leave',
    );
    setConfirming(null);
    if (left !== null) {
      setChosenId(null);
      await page.refresh();
    }
  }

  async function remove() {
    if (!team) return;
    const gone = await page.run('team.delete', { teamId: team.team.id }, 'team.delete');
    setConfirming(null);
    if (gone !== null) {
      setChosenId(null);
      await page.refresh();
    }
  }

  /** Said only when it is not the ordinary state — a working team says nothing. */
  function stateLine(t: TeamResponse): string | null {
    switch (t.team.state) {
      case 'active':
        return null;
      case 'read_only':
        return t.team.readOnlyUntil
          ? strings.stateReadOnly(formatDate(t.team.readOnlyUntil, lang))
          : strings.stateReadOnlyNoDate;
      case 'locked':
        return strings.stateLocked;
    }
  }

  const skeleton = (
    <div className="hm-skeleton" aria-hidden="true">
      <div className="hm-skeleton__row" />
      <div className="hm-skeleton__row" />
      <div className="hm-skeleton__row" />
    </div>
  );

  const body = () => {
    if (!page.status) return skeleton;

    // Signing in belongs to Settings; this page only ever points at it.
    if (page.status.state !== 'signed_in') {
      return (
        <div className="hm-empty hm-fade-in">
          <MarginMark size={28} strokeWidth={3} />
          <p className="hm-empty__title">{strings.signedOutTitle}</p>
          <p className="hm-empty__body">{strings.signedOutBody}</p>
          <button
            type="button"
            className="hm-btn hm-btn-primary hm-empty__action"
            onClick={onOpenSettings}
          >
            {strings.goToSettings}
          </button>
        </div>
      );
    }

    if (!me) {
      // Signed in, but the server could not be reached just now.
      return (
        <div className="hm-empty hm-fade-in">
          <MarginMark size={28} strokeWidth={3} />
          <p className="hm-empty__title">{strings.error(page.failure?.code ?? 'network')}</p>
          <button
            type="button"
            className="hm-btn hm-btn-ghost hm-empty__action"
            onClick={() => void page.refresh()}
          >
            {strings.retry}
          </button>
        </div>
      );
    }

    if (teams.length === 0 && !creating) {
      return (
        <div className="hm-empty hm-fade-in">
          <MarginMark size={28} strokeWidth={3} />
          <p className="hm-empty__title">{strings.emptyTeamsTitle}</p>
          <p className="hm-empty__body">{strings.emptyTeamsBody}</p>
          <button
            type="button"
            className="hm-btn hm-btn-primary hm-empty__action"
            onClick={() => setCreating(true)}
          >
            {strings.createTeam}
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="hm-team-bar">
          {teams.length > 0 && (
            <SegmentedControl<string>
              value={selectedId ?? ''}
              name="hm-team-switcher"
              groupLabel={strings.yourTeams}
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
              onChange={setChosenId}
            />
          )}
          {creating ? (
            <form className="hm-team-invite" onSubmit={createTeam}>
              <input
                type="text"
                required
                autoFocus
                className="hm-input"
                placeholder={strings.teamNamePlaceholder}
                aria-label={strings.createTeam}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button
                type="submit"
                className="hm-btn hm-btn-primary"
                disabled={page.working('team.create')}
              >
                {page.working('team.create') ? strings.working : strings.create}
              </button>
              <button
                type="button"
                className="hm-btn hm-btn-ghost"
                onClick={() => setCreating(false)}
              >
                {strings.cancel}
              </button>
            </form>
          ) : (
            <button type="button" className="hm-chip-add" onClick={() => setCreating(true)}>
              + {strings.createTeam}
            </button>
          )}
          {team && (
            <span className="hm-team-bar__meta">
              {strings.role(team.team.role)}
              {members ? ` · ${strings.seatsUsed(members.length)}` : ''}
            </span>
          )}
        </div>
        {page.failed('team.create') && (
          <p className="hm-status hm-status--warning" role="alert">
            <span className="hm-dot" />
            {strings.error(page.failed('team.create')!)}
          </p>
        )}

        {team && (
          <>
            {stateLine(team) && (
              <p className="hm-status hm-status--warning" role="status">
                <span className="hm-dot" />
                {stateLine(team)}
              </p>
            )}

            <TeamNotes
              strings={strings}
              lang={lang}
              page={page}
              team={team}
              myUserId={me.user.id}
              members={members}
              personal={personal}
              onOpenLibrary={onOpenLibrary}
            />

            <details className="hm-panel">
              <summary className="hm-panel__summary">
                <span className="hm-panel__title">{strings.whoIsIn(team.team.name)}</span>
                <span className="hm-panel__hint">
                  {members ? strings.seatsUsed(members.length) : ''}
                </span>
              </summary>
              <div className="hm-panel__body">
                <TeamMembers
                  strings={strings}
                  lang={lang}
                  page={page}
                  team={team}
                  myUserId={me.user.id}
                  members={members}
                  onChanged={() => void reload()}
                />
                <h3 className="hm-settings__subheading">{strings.invitations}</h3>
                <TeamInvitations strings={strings} lang={lang} page={page} team={team} />
              </div>
            </details>

            <details className="hm-panel">
              <summary className="hm-panel__summary">
                <span className="hm-panel__title">{strings.teamSettings}</span>
                <span className="hm-panel__hint">{strings.teamSettingsHint}</span>
              </summary>
              <div className="hm-panel__body">
                {team.capabilities.includes('team.rename') && (
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
                    >
                      {page.working('team.rename') ? strings.working : strings.rename}
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
                    {team.capabilities.includes('team.leave') && (
                      <button
                        type="button"
                        className="hm-btn hm-btn-ghost"
                        onClick={() => setConfirming('leave')}
                      >
                        {strings.leaveTeam}
                      </button>
                    )}
                    {team.capabilities.includes('team.delete') && (
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
          </>
        )}
      </>
    );
  };

  return (
    <div className="hm-notes-main">
      <div className="hm-notes-page__inner">
        <header className="hm-notes-page__header">
          <MarginMark size={20} strokeWidth={3.5} style={{ color: 'var(--hm-accent)' }} />
          <h1 className="hm-notes-page__title">{strings.teams}</h1>
        </header>

        {/* Only what the page itself failed at. Everything a row did says so on
            that row, beside the control that did it. */}
        {page.failure?.key === null && (
          <p className="hm-status hm-status--warning" role="status">
            <span className="hm-dot" />
            {strings.error(page.failure.code)}
          </p>
        )}

        {body()}
      </div>
    </div>
  );
}
