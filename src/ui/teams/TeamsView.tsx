import { useCallback, useEffect, useState } from 'react';
import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import type { NoteOwner } from '@/domain/note-owner';
import type { TeamsClient } from '@/teams/client';
import { newRequestId } from '@/teams/operation-names';
import { formatDate } from '../format';
import type { Lang } from '../i18n';
import { EmptyState } from '../kit/EmptyState';
import { InlineError, StatusLine } from '../kit/Feedback';
import { NameField } from '../kit/NameField';
import { Page, PageHeader } from '../kit/Page';
import { SegmentedControl } from '../kit/SegmentedControl';
import { Skeleton } from '../kit/Skeleton';
import { PlusIcon } from '../kit/icons';
import type { PersonalNotes } from './personal-notes';
import type { TeamsRoute } from './route';
import { getTeamsStrings, type TeamsStrings } from './strings';
import './styles';
import { TEAM_NAME_MAX } from './limits';
import { TeamNotePage } from './TeamNotePage';
import { TeamOverview } from './TeamOverview';
import { TeamPeople } from './TeamPeople';
import { TeamSettings } from './TeamSettings';
import { PAGE, useTeams } from './useTeams';
import { teamCreation } from './permissions';

interface TeamsViewProps {
  lang: Lang;
  client: TeamsClient;
  /** Sends the reader to Settings, where Teams is turned on and signed into. */
  onOpenSettings: () => void;
  /** Sends the reader to the plan in Settings, opened, to subscribe. */
  onOpenPlan: () => void;
  /** Sends the reader to the Notes Library, narrowed to what they opened. */
  onOpenLibrary: (owner: NoteOwner) => void;
  /** How a note moves between this device and a team — see `PersonalNotes`. */
  personal: PersonalNotes;
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
  onOpenPlan,
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

  const toOverview = (teamId: string | null) => onRoute({ page: 'overview', teamId });

  async function createTeam(name: string) {
    // A retry of the same create returns the original team rather than a second one.
    const result = await page.run(
      'team.create',
      { name, requestId: newRequestId() },
      'team.create',
    );
    if (!result) return;
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

    // Signing in belongs to Settings; this page only ever points at it.
    if (page.status.state !== 'signed_in') {
      return (
        <EmptyState
          title={strings.signedOutTitle}
          body={strings.signedOutBody}
          action={{ label: strings.goToSettings, onClick: onOpenSettings }}
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
      // Founding a team is an owner's, and owners subscribe: say so up front,
      // with the way to the plan, rather than after a team has been named.
      return canCreate === 'needs_plan' ? (
        <EmptyState
          title={strings.needsPlanTitle}
          body={strings.needsPlanBody}
          action={{ label: strings.seePlan, onClick: onOpenPlan }}
        />
      ) : (
        <EmptyState
          title={strings.emptyTeamsTitle}
          body={strings.emptyTeamsBody}
          action={{ label: strings.createTeam, onClick: () => setCreating(true) }}
        />
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
            <SegmentedControl<string>
              value={selectedId ?? ''}
              name="hm-team-switcher"
              groupLabel={strings.yourTeams}
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
              onChange={toOverview}
            />
          )}
          <span className="hm-team-bar__new">{newTeam}</span>
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
