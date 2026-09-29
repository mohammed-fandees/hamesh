import { useCallback, useEffect, useState } from 'react';
import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import type { Lang } from '../i18n';
import type { TeamsClient } from '@/teams/client';
import { newRequestId } from '@/teams/operation-names';
import { getTeamsStrings } from './strings';
import './styles';
import { useTeams } from './useTeams';
import { formatDate } from './format';
import { TeamMembers } from './TeamMembers';
import { TeamNotes } from './TeamNotes';
import { TeamInvitations } from './TeamInvitations';
import { JoinTeam } from './JoinTeam';
import { BillingPanel } from './BillingPanel';
import { MentionsInbox } from './MentionsInbox';
import type { PersonalNotes } from './personal-notes';

interface TeamsViewProps {
  lang: Lang;
  client: TeamsClient;
  /** Sends the reader to Settings, where Teams is turned on and signed into. */
  onOpenSettings: () => void;
  /** How a note moves between this device and a team — see `PersonalNotes`. */
  personal: PersonalNotes;
}

/**
 * The Teams page: your teams, who is in them, invitations, and the plan that
 * pays for them.
 *
 * It decides nothing. Which teams exist, what this reader may do in each, and
 * whether a team is active, read-only or locked all arrive from the server on
 * every visit, and the page is redrawn from that answer after anything it
 * changes. Signing in stays in Settings, so there is one place that holds the
 * account and one that uses it.
 */
export function TeamsView({ lang, client, onOpenSettings, personal }: TeamsViewProps) {
  const strings = getTeamsStrings(lang);
  const page = useTeams(client);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamResponse | null>(null);
  /** Fetched here, not in the panel that lists them: the notes and their
   *  comments need the same names, and one answer serves all three. */
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState('');

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

  // The await is inlined rather than calling `loadTeam()` for the same reason
  // as in useTeams: state set on an effect's synchronous path cascades a
  // render. `loadTeam` stays for the reloads that follow a change.
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
    const result = await page.run('team.create', { name: newName, requestId: newRequestId() });
    if (!result) return;
    setNewName('');
    setCreating(false);
    setChosenId(result.team.id);
    await page.refresh();
  }

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!team || renaming.trim() === team.team.name) return;
    await page.run('team.rename', { teamId: team.team.id, name: renaming });
    await reload();
  }

  async function leave() {
    if (!team || !me || !confirm(strings.leaveConfirm(team.team.name))) return;
    const left = await page.run('members.remove', {
      teamId: team.team.id,
      userId: me.user.id,
    });
    if (left !== null) {
      setChosenId(null);
      await page.refresh();
    }
  }

  async function remove() {
    if (!team || !confirm(strings.deleteConfirm(team.team.name))) return;
    const gone = await page.run('team.delete', { teamId: team.team.id });
    if (gone !== null) {
      setChosenId(null);
      await page.refresh();
    }
  }

  function stateLine(t: TeamResponse): string {
    switch (t.team.state) {
      case 'active':
        return strings.stateActive;
      case 'read_only':
        return t.team.readOnlyUntil
          ? strings.stateReadOnly(formatDate(t.team.readOnlyUntil, lang))
          : strings.stateReadOnlyNoDate;
      case 'locked':
        return strings.stateLocked;
    }
  }

  const body = () => {
    if (!page.status) return <p className="hm-setting-row__hint">{strings.working}</p>;

    // Signing in belongs to Settings; this page only ever points at it.
    if (page.status.state !== 'signed_in') {
      return (
        <div className="hm-settings__body">
          <p className="hm-settings__intro">{strings.signedOutBody}</p>
          <button type="button" className="hm-btn hm-btn-primary" onClick={onOpenSettings}>
            {strings.goToSettings}
          </button>
        </div>
      );
    }

    if (!me) {
      // Signed in, but the server could not be reached just now.
      return (
        <div className="hm-settings__body">
          <p className="hm-settings__intro">{strings.error(page.error ?? 'network')}</p>
          <button type="button" className="hm-btn hm-btn-ghost" onClick={() => void page.refresh()}>
            {strings.retry}
          </button>
        </div>
      );
    }

    return (
      <>
        <h2 className="hm-settings__subheading">{strings.yourTeams}</h2>
        {teams.length === 0 && <p className="hm-settings__intro">{strings.noTeams}</p>}
        {teams.length > 0 && (
          <ul className="hm-team-switcher">
            {teams.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="hm-team-switcher__item"
                  aria-current={t.id === selectedId ? 'true' : undefined}
                  onClick={() => setChosenId(t.id)}
                >
                  <bdi>{t.name}</bdi>
                  <span className="hm-team-member__meta">{strings.role(t.role)}</span>
                </button>
              </li>
            ))}
          </ul>
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
            <button type="submit" className="hm-btn hm-btn-primary" disabled={page.busy}>
              {strings.create}
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
          <button type="button" className="hm-link" onClick={() => setCreating(true)}>
            {strings.createTeam}
          </button>
        )}

        {team && (
          <section className="hm-team-detail">
            <h2 className="hm-settings__subheading">
              <bdi>{team.team.name}</bdi> · {stateLine(team)}
            </h2>

            <h3 className="hm-settings__subheading">{strings.members}</h3>
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

            <h3 className="hm-settings__subheading">{strings.sharedNotes}</h3>
            <TeamNotes
              strings={strings}
              lang={lang}
              page={page}
              team={team}
              myUserId={me.user.id}
              members={members}
              personal={personal}
            />

            <h3 className="hm-settings__subheading">{strings.dangerZone}</h3>
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
                <button type="submit" className="hm-btn hm-btn-ghost" disabled={page.busy}>
                  {strings.rename}
                </button>
              </form>
            )}
            <div className="hm-team-invite">
              {team.capabilities.includes('team.leave') && (
                <button
                  type="button"
                  className="hm-btn hm-btn-ghost"
                  disabled={page.busy}
                  onClick={() => void leave()}
                >
                  {strings.leaveTeam}
                </button>
              )}
              {team.capabilities.includes('team.delete') && (
                <button
                  type="button"
                  className="hm-btn hm-btn-ghost"
                  disabled={page.busy}
                  onClick={() => void remove()}
                >
                  {strings.deleteTeam}
                </button>
              )}
            </div>
          </section>
        )}

        <h2 className="hm-settings__subheading">{strings.mentions}</h2>
        <MentionsInbox strings={strings} lang={lang} page={page} myUserId={me.user.id} />

        <h2 className="hm-settings__subheading">{strings.joinTeam}</h2>
        <JoinTeam
          strings={strings}
          page={page}
          onJoined={(teamId) => {
            setChosenId(teamId);
            void page.refresh();
          }}
        />

        <h2 className="hm-settings__subheading">{strings.billing}</h2>
        <BillingPanel strings={strings} lang={lang} page={page} me={me} />
      </>
    );
  };

  return (
    <div className="hm-notes-main">
      <div className="hm-notes-page__inner">
        <header className="hm-notes-page__header">
          <h1 className="hm-notes-page__title">{strings.teams}</h1>
        </header>

        {/* Said once, here, rather than by relabelling whichever button was
            pressed — every control shares one connection to the worker. */}
        {page.busy && (
          <p className="hm-setting-row__hint" role="status">
            {strings.working}
          </p>
        )}

        {page.error && (
          <p className="hm-status hm-status--warning" role="status">
            <span className="hm-dot" />
            {strings.error(page.error)}
          </p>
        )}

        {body()}
      </div>
    </div>
  );
}
