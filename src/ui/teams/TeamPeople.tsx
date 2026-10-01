import type { TeamMember, TeamResponse } from '@hamesh/teams-contract';
import type { Lang } from '../i18n';
import { Breadcrumb } from '../kit/Breadcrumb';
import { PageHeader } from '../kit/Page';
import { Section } from '../kit/Section';
import { inviteRights } from './permissions';
import type { TeamsRoute } from './route';
import type { TeamsStrings } from './strings';
import { TeamInvitations } from './TeamInvitations';
import { TeamMembers } from './TeamMembers';
import type { TeamsPage } from './useTeams';

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
      <Breadcrumb
        label={strings.breadcrumb}
        items={[
          { label: strings.teams, onClick: () => onRoute({ page: 'overview', teamId: null }) },
          { label: team.team.name, onClick: () => onRoute({ page: 'overview', teamId }) },
          { label: strings.whoIsInIt },
        ]}
      />
      <PageHeader
        level="sub"
        title={strings.whoIsIn(team.team.name)}
        meta={members && strings.seatsUsed(members.length)}
      />

      <Section flush label={strings.members}>
        <TeamMembers
          strings={strings}
          lang={lang}
          page={page}
          team={team}
          myUserId={myUserId}
          members={members}
          onChanged={onChanged}
        />
      </Section>

      <Section title={inviteRights(team).any ? strings.inviteSomeone : strings.invitations}>
        <TeamInvitations strings={strings} lang={lang} page={page} team={team} />
      </Section>
    </>
  );
}
