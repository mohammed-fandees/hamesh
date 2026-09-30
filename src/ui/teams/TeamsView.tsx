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
import { TeamOverview } from './TeamOverview';
import { TeamPeople } from './TeamPeople';
import { TeamNotePage } from './TeamNotePage';
import { TeamSettings } from './TeamSettings';
import type { NoteOwner } from './NoteFilter';
import type { PersonalNotes } from './personal-notes';
import type { TeamsRoute } from './route';

interface TeamsViewProps {
  lang: Lang;
  client: TeamsClient;
  /** Sends the reader to Settings, where Teams is turned on and signed into. */
  onOpenSettings: () => void;
  /** Sends the reader to the Notes Library, narrowed to what they opened. */
  onOpenLibrary: (owner: NoteOwner) => void;
  /** How a note moves between this device and a team — see `PersonalNotes`. */
  personal: PersonalNotes;
  /** Where inside Teams the reader is. Owned by the page above, so the browser's
   *  back button can walk it. */
  route: TeamsRoute;
  onRoute: (route: TeamsRoute) => void;
}

/**
 * The Teams page: a team at a glance, and the two pages it leads to.
 *
 * The overview says how a team's notes are filed and who is in it, and nothing
 * more — the notes themselves are read in the Library, where a team's sit
 * beside the reader's own. Who is in a team, and one shared note with its
 * discussion, are pages of their own; the handful of things that end a team are
 * folded away until they are wanted.
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
  route,
  onRoute,
}: TeamsViewProps) {
  const strings = getTeamsStrings(lang);
  const page = useTeams(client);
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const me = page.me;
  const teams = me?.teams ?? [];

  // Derived, not synchronised: whichever team the route names, as long as the
  // server still lists it, and otherwise the first one. Nothing to keep in
  // step, so there is no effect here to get out of step.
  const selectedId =
    route.teamId && teams.some((t) => t.id === route.teamId)
      ? route.teamId
      : (teams[0]?.id ?? null);

  const loadTeam = useCallback(async () => {
    if (!selectedId) {
      setTeam(null);
      setMembers(null);
      return;
    }
    const result = await page.run('team.get', { teamId: selectedId });
    setTeam(result);
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

  const toOverview = (teamId: string | null) => onRoute({ page: 'overview', teamId });

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
    toOverview(result.team.id);
    await page.refresh();
  }

  /** After the reader left the team or it was deleted: it is no longer theirs to show. */
  async function gone() {
    toOverview(null);
    await page.refresh();
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

    // Who is in a team, and one of its notes, each have a page of their own.
    // Until the team they belong to has loaded there is only the skeleton: a
    // page for a team this reader has since left says nothing rather than
    // something stale.
    if (route.page !== 'overview' && selectedId === route.teamId) {
      if (!team) return skeleton;
      if (route.page === 'members') {
        return (
          <TeamPeople
            strings={strings}
            lang={lang}
            page={page}
            team={team}
            myUserId={me.user.id}
            members={members}
            onChanged={() => void reload()}
            onRoute={onRoute}
          />
        );
      }
      return (
        <TeamNotePage
          strings={strings}
          lang={lang}
          page={page}
          team={team}
          myUserId={me.user.id}
          members={members}
          noteId={route.noteId}
          personal={personal}
          onGone={() => toOverview(team.team.id)}
          onRoute={onRoute}
        />
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
              onChange={toOverview}
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
                aria-busy={page.working('team.create')}
              >
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

            <TeamOverview
              strings={strings}
              lang={lang}
              page={page}
              team={team}
              myUserId={me.user.id}
              members={members}
              onOpenLibrary={onOpenLibrary}
              onRoute={onRoute}
            />

            <TeamSettings
              strings={strings}
              page={page}
              team={team}
              myUserId={me.user.id}
              onRenamed={() => void reload()}
              onGone={() => void gone()}
            />
          </>
        )}
      </>
    );
  };

  const onOverview = route.page === 'overview' || selectedId !== route.teamId;

  return (
    <div className="hm-notes-main">
      <div className="hm-notes-page__inner hm-notes-page__inner--wide">
        {onOverview && (
          <header className="hm-notes-page__header">
            <MarginMark size={20} strokeWidth={3.5} style={{ color: 'var(--hm-accent)' }} />
            <h1 className="hm-notes-page__title">{strings.teams}</h1>
          </header>
        )}

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
