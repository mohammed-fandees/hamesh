import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import type { Lang } from '../i18n';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import type { TeamsRoute } from './route';
import { TeamsBreadcrumb } from './TeamsBreadcrumb';
import { TeamMembers } from './TeamMembers';
import { TeamInvitations } from './TeamInvitations';

interface TeamPeopleProps {
  strings: TeamsStrings;
  lang: Lang;
  page: TeamsPage;
  team: TeamResponse;
  myUserId: string;
  members: TeamMember[] | null;
  /** Called after anything that changes who is in the team, or my own role. */
  onChanged: () => void;
  onRoute: (route: TeamsRoute) => void;
}

/**
 * Who is in a team, and how someone new gets in.
 *
 * A page of its own rather than a panel on the overview: a row here can ask a
 * question, show it is working, and say why it failed, and an invitation link is
 * shown once and wants room to be read. All of that in a panel would put the
 * long column back on the overview that the rest of the redesign took it off.
 */
export function TeamPeople({
  strings,
  lang,
  page,
  team,
  myUserId,
  members,
  onChanged,
  onRoute,
}: TeamPeopleProps) {
  const teamId = team.team.id;
  return (
    <>
      <TeamsBreadcrumb
        strings={strings}
        items={[
          { label: strings.teams, onClick: () => onRoute({ page: 'overview', teamId: null }) },
          { label: team.team.name, onClick: () => onRoute({ page: 'overview', teamId }) },
          { label: strings.whoIsInIt },
        ]}
      />
      <header className="hm-notes-page__header hm-notes-page__header--sub">
        <h1 className="hm-notes-page__title">{strings.whoIsIn(team.team.name)}</h1>
        {members && <span className="hm-section__meta">{strings.seatsUsed(members.length)}</span>}
      </header>

      <section className="hm-section hm-section--flush" aria-label={strings.members}>
        <TeamMembers
          strings={strings}
          lang={lang}
          page={page}
          team={team}
          myUserId={myUserId}
          members={members}
          onChanged={onChanged}
        />
      </section>

      <section className="hm-section" aria-labelledby="hm-team-invitations-title">
        <h2 className="hm-section__title" id="hm-team-invitations-title">
          {strings.invitations}
        </h2>
        <TeamInvitations strings={strings} lang={lang} page={page} team={team} />
      </section>
    </>
  );
}
