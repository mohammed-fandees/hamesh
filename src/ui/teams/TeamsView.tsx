import { useCallback, useEffect, useRef, useState } from 'react';
import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import type { Note } from '@/domain/note';
import type { NoteOwner } from '@/domain/note-owner';
import { nameTaken, nextFreeName } from '@/domain/unique-name';
import type { TeamsClient } from '@/teams/client';
import { newRequestId } from '@/teams/operation-names';
import { formatDate } from '../format';
import type { Lang } from '../i18n';
import { EmptyState } from '../kit/EmptyState';
import { InlineError, StatusLine } from '../kit/Feedback';
import { NameField, type NameConflict } from '../kit/NameField';
import { Page, PageHeader } from '../kit/Page';
import { Skeleton } from '../kit/Skeleton';
import { PlusIcon } from '../kit/icons';
import type { PersonalNotes } from './personal-notes';
import type { TeamsRoute } from './route';
import { getTeamsStrings, type TeamsStrings } from './strings';
import './styles';
import { JoinTeam } from './JoinTeam';
import { TEAM_NAME_MAX } from './limits';
import { TeamNotePage } from './TeamNotePage';
import { TeamOverview } from './TeamOverview';
import { TeamPeople } from './TeamPeople';
import { TeamSettings } from './TeamSettings';
import { TeamsStart } from './TeamsStart';
import { PAGE, useTeams } from './useTeams';
import { teamCreation } from './permissions';

interface TeamsViewProps {
  lang: Lang;
  client: TeamsClient;
  /** Sends the reader to the plan in Settings, opened, to subscribe. */
  onOpenPlan: () => void;
  /** Sends the reader to the Notes Library, narrowed to what they opened. */
  onOpenLibrary: (owner: NoteOwner) => void;
  /** How a note moves between this device and a team — see `PersonalNotes`. */
  personal: PersonalNotes;
  /** This device's notes, to share from without leaving the team. */
  myNotes: readonly Note[];
  /** Shares one into a team, asking for consent first; `false` if declined. */
  onShare: (note: Note, teamId: string, folderId: string | null) => Promise<boolean>;
  /** Where inside Teams the reader is. Owned by the page above, so the browser's
   *  back button can walk it. */
  route: TeamsRoute;
  onRoute: (route: TeamsRoute) => void;
}

/** Said only when it is not the ordinary state — a working team says nothing. */
function stateLine(t: TeamResponse, strings: TeamsStrings, lang: Lang): string | null {
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

/** How often coming back to the page asks the server again. A window can gain
 *  focus many times a minute, and the socket has usually said so already. */
const REFRESH_ON_FOCUS_MS = 30_000;

/**
 * The Teams page: a team's notes and the people in it, and the two pages it leads
 * to. Who is in a team, and one shared note with its discussion, are pages of
 * their own; the handful of things that end a team are folded away until wanted.
 *
 * Starting is here too, however far along the reader is: turning Teams on and
 * signing in, founding a team, or joining one from a link. Paying is the one part
 * of the account that stays in Settings. Mentions are their own destination.
 *
 * The page is live: it follows the worker's notices, and reads again when the
 * reader comes back to it.
 *
 * The page decides nothing. Which teams exist, what this reader may do in each,
 * and whether a team is active, read-only or locked all arrive from the server
 * on every visit, and the page is redrawn from that answer after anything it
 * changes.
 */
export function TeamsView({
  lang,
  client,
  onOpenPlan,
  onOpenLibrary,
  personal,
  myNotes,
  onShare,
  route,
  onRoute,
}: TeamsViewProps) {
  const strings = getTeamsStrings(lang);
  const page = useTeams(client);
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  // Kept for as long as the same name is being tried, so a retry after a dropped
  // connection returns the team the first try made rather than founding a second.
  const creation = useRef<{ name: string; requestId: string } | null>(null);

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
    setTeam(await page.run('team.get', { teamId: selectedId }));
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
    void (async () => {
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

  // A member added, a role changed, a team gone: the worker heard it on the socket
  // and has already asked the server who this account is now.
  useEffect(
    () =>
      page.onEvent((event) => {
        if (event.event === 'account') void reload();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reload],
  );

  // Anything missed while away, such as a plan approved or a socket that dropped.
  const lastAsked = useRef(0);
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastAsked.current < REFRESH_ON_FOCUS_MS) return;
      lastAsked.current = Date.now();
      void reload();
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [reload]);

  const toOverview = (teamId: string | null) => onRoute({ page: 'overview', teamId });

  async function createTeam(name: string) {
    if (creation.current?.name !== name) creation.current = { name, requestId: newRequestId() };
    const result = await page.run('team.create', creation.current, 'team.create');
    if (!result) return;
    creation.current = null;
    setCreating(false);
    toOverview(result.team.id);
    await page.refresh();
  }

  /** After the reader left the team or it was deleted: it is no longer theirs to show. */
  async function gone() {
    toOverview(null);
    await page.refresh();
  }

  /** Asked before the control is offered, so nobody names a team they cannot have. */
  const canCreate = me ? teamCreation(me) : 'needs_plan';

  const teamNames = teams.map((t) => t.name);
  /** Two teams called the same thing can't be told apart anywhere they're listed. */
  const nameConflict = (name: string): NameConflict | null => {
    if (!nameTaken(name, teamNames)) return null;
    const suggestion = nextFreeName(name, teamNames, TEAM_NAME_MAX);
    return {
      message: strings.teamNameTaken(name),
      suggestion,
      useLabel: strings.teamNameUse(suggestion),
    };
  };

  const joinForm = (
    <JoinTeam
      strings={strings}
      page={page}
      onJoined={(teamId) => {
        setJoining(false);
        toOverview(teamId);
        void page.refresh();
      }}
    />
  );

  const newTeam =
    canCreate === 'needs_plan' ? (
      <button type="button" className="hm-add" onClick={onOpenPlan}>
        <PlusIcon size={11} />
        {strings.subscribeToCreate}
      </button>
    ) : canCreate === 'at_limit' ? (
      <span className="hm-supporting">
        {strings.atTeamLimit(me?.entitlement.limits?.ownedTeams ?? 0)}
      </span>
    ) : creating ? (
      <NameField
        label={strings.createTeam}
        placeholder={strings.teamNamePlaceholder}
        maxLength={TEAM_NAME_MAX}
        submitLabel={strings.create}
        cancelLabel={strings.cancel}
        busy={page.working('team.create')}
        conflict={nameConflict}
        onCancel={() => setCreating(false)}
        onSubmit={(name) => void createTeam(name)}
      />
    ) : (
      <button type="button" className="hm-add" onClick={() => setCreating(true)}>
        <PlusIcon size={11} />
        {strings.createTeam}
      </button>
    );

  const body = () => {
    if (!page.status) return <Skeleton />;

    if (page.status.state !== 'signed_in') {
      return (
        <TeamsStart
          strings={strings}
          client={client}
          status={page.status}
          onChanged={() => void page.refresh()}
        />
      );
    }

    if (!me) {
      // Signed in, but the server could not be reached just now.
      return (
        <EmptyState
          title={strings.error(page.failed(PAGE) ?? 'network')}
          action={{ label: strings.retry, onClick: () => void page.refresh(), tone: 'ghost' }}
        />
      );
    }

    if (teams.length === 0 && !creating) {
      // The two ways into a team, side by side: nobody who was sent a link should
      // have to find out that joining lives somewhere else. Founding one is an
      // owner's, and owners subscribe: say so up front, with the way to the plan,
      // rather than after a team has been named.
      return (
        <div className="hm-team-doors">
          {canCreate === 'needs_plan' ? (
            <EmptyState
              size="inline"
              title={strings.needsPlanTitle}
              body={strings.needsPlanBody}
              action={{ label: strings.seePlan, onClick: onOpenPlan }}
            />
          ) : (
            <EmptyState
              size="inline"
              title={strings.emptyTeamsTitle}
              body={strings.emptyTeamsBody}
              action={{ label: strings.createTeam, onClick: () => setCreating(true) }}
            />
          )}
          <section className="hm-section hm-team-doors__join" aria-label={strings.joinTeam}>
            <h2 className="hm-section__title">{strings.joinTeam}</h2>
            {joinForm}
          </section>
        </div>
      );
    }

    // Who is in a team, and one of its notes, each have a page of their own.
    // Until the team they belong to has loaded there is only the skeleton: a
    // page for a team this reader has since left says nothing rather than
    // something stale.
    if (route.page !== 'overview' && selectedId === route.teamId) {
      if (!team) return <Skeleton />;
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

    const state = team && stateLine(team, strings, lang);
    return (
      <>
        <div className="hm-team-bar">
          {teams.length > 0 && (
            <div className="hm-owner-filter" role="group" aria-label={strings.yourTeams}>
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="hm-owner-filter__pill"
                  aria-pressed={t.id === selectedId}
                  onClick={() => toOverview(t.id)}
                >
                  <bdi>{t.name}</bdi>
                </button>
              ))}
            </div>
          )}
          <span className="hm-team-bar__new">{newTeam}</span>
          {!creating && (
            <button
              type="button"
              className="hm-link"
              aria-expanded={joining}
              onClick={() => setJoining((open) => !open)}
            >
              {strings.joinTeam}
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
          <InlineError>{strings.error(page.failed('team.create')!)}</InlineError>
        )}
        {joining && <section className="hm-section">{joinForm}</section>}

        {team && (
          <>
            {state && <StatusLine tone="warning">{state}</StatusLine>}
            <TeamOverview
              strings={strings}
              lang={lang}
              page={page}
              team={team}
              myUserId={me.user.id}
              members={members}
              myNotes={myNotes}
              onShare={onShare}
              personal={personal}
              onOpenLibrary={onOpenLibrary}
              onRoute={onRoute}
            />
            <TeamSettings
              strings={strings}
              page={page}
              team={team}
              myUserId={me.user.id}
              teamNames={teamNames}
              onRenamed={() => void reload()}
              onGone={() => void gone()}
            />
          </>
        )}
      </>
    );
  };

  const onOverview = route.page === 'overview' || selectedId !== route.teamId;
  // Only what the page itself failed at, and only once there is a page to say
  // it on. Everything a row did says so on that row, beside the control that
  // did it.
  const pageFailure = me ? page.failed(PAGE) : null;

  return (
    <Page wide>
      {onOverview && <PageHeader title={strings.teams} meta={strings.tagline} />}
      {pageFailure && <InlineError>{strings.error(pageFailure)}</InlineError>}
      {body()}
    </Page>
  );
}
