import type { Lang } from '../i18n';
import type { TeamsClient } from '@/teams/client';
import { getTeamsStrings } from './strings';
import './styles';
import { useTeams } from './useTeams';
import { JoinTeam } from './JoinTeam';
import { BillingPanel } from './BillingPanel';
import { Panel } from '../kit/Section';

interface TeamsAccountProps {
  lang: Lang;
  client: TeamsClient;
  /** Called with the team just joined, so the page can open it. */
  onJoined: (teamId: string) => void;
  /** Open the plan and bring it into view — the reader came here to subscribe. */
  revealPlan?: boolean;
}

/**
 * Joining a team, and paying for one — in Settings, beside the account they
 * belong to.
 *
 * Neither is about any one team, which is why neither is on the Teams page any
 * more: a subscription is the reader's, and a join link is how they come to
 * have a team at all. Settings already holds the account — signing in, signing
 * out, turning Teams off — so this is where the rest of it goes.
 *
 * Nothing here until someone is signed in: there is no plan to show and no
 * invitation anyone could accept.
 */
export function TeamsAccount({ lang, client, onJoined, revealPlan = false }: TeamsAccountProps) {
  const strings = getTeamsStrings(lang);
  const page = useTeams(client);
  const me = page.me;
  if (page.status?.state !== 'signed_in' || !me) return null;

  return (
    <>
      <Panel title={strings.joinTeam}>
        <JoinTeam
          strings={strings}
          page={page}
          onJoined={(teamId) => {
            void page.refresh();
            onJoined(teamId);
          }}
        />
      </Panel>

      <Panel title={strings.plan} reveal={revealPlan}>
        <BillingPanel strings={strings} lang={lang} page={page} me={me} />
      </Panel>
    </>
  );
}
