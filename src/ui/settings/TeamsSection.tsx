import { useCallback, useEffect, useState } from 'react';
import { SettingRow } from '../kit/SettingRow';
import { Section } from '../kit/Section';
import { InlineError } from '../kit/Feedback';
import { AccountIcon, PlanIcon, TeamIcon } from '../kit/icons';
import type { Lang } from '../i18n';
import { getTeamsStrings } from '../teams/strings';
import { formatDate } from '../format';
import type { TeamsClient } from '@/teams/client';
import type { TeamsReply } from '@/teams/messages';
import { Failure, failureOf, useWork } from '../hooks/useWork';
import '../teams/styles';

interface TeamsSectionProps {
  lang: Lang;
  client: TeamsClient;
}

/** What the reader can set going here, one at a time — the account is one thing. */
const ACTIONS = ['turn-on', 'sign-in', 'sign-out', 'turn-off'] as const;
type Action = (typeof ACTIONS)[number];
/** Reading the account's state, on arrival and whenever the page comes back. */
const STATUS = 'status';

/**
 * Settings → Teams: turn Teams on, sign in, see the account as the server
 * reports it, sign out, turn Teams off.
 *
 * Everything shown here is what the server said a moment ago. The page holds
 * no plan, role or limit of its own and decides nothing from them; if the
 * server can't be reached, it says so rather than guessing. Busy and failed
 * come from the same `useWork` every surface uses.
 */
export function TeamsSection({ lang, client }: TeamsSectionProps) {
  const strings = getTeamsStrings(lang);
  const [reply, setReply] = useState<TeamsReply | null>(null);
  const work = useWork((error) => failureOf(error, strings.error('internal')));
  const { run: perform } = work;

  /** Takes the worker's answer, and fails with what it refused, if it did. */
  const adopt = useCallback(
    (next: TeamsReply | null) => {
      if (!next) return;
      setReply(next);
      if (next.error) throw new Failure(strings.error(next.error));
    },
    [strings],
  );

  useEffect(() => {
    const refresh = () => void perform(STATUS, async () => adopt(await client.send('status')));
    refresh();
    // Permissions can be removed from the browser's own extension settings;
    // look again whenever the user comes back to this page.
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [client, perform, adopt]);

  const run = (action: Action, task: () => Promise<TeamsReply | null>) =>
    void perform(action, async () => adopt(await task()));

  const busy = ACTIONS.find((action) => work.working(action)) ?? null;
  const notice = [...ACTIONS, STATUS].map((key) => work.failed(key)).find(Boolean) ?? null;

  function turnOn() {
    // The permission prompt must be requested synchronously from the click.
    const granted = client.requestPermissions();
    run('turn-on', async () => {
      if (!(await granted)) throw new Failure(strings.permissionDenied);
      return client.send('status');
    });
  }

  const turnOff = () =>
    run('turn-off', async () => {
      await client.send('signOut');
      await client.removePermissions();
      return client.send('status');
    });

  const status = reply?.status;
  if (status?.state === 'unavailable') return null;

  return (
    <Section title={strings.teams} intro={strings.intro}>
      <div className="hm-settings__body">
        {!status && (
          <SettingRow label={strings.teams} icon={<TeamIcon />} value={strings.checking} />
        )}

        {status?.state === 'permission_needed' && (
          <>
            <SettingRow
              label={strings.teams}
              icon={<TeamIcon />}
              value={
                <button
                  type="button"
                  className="hm-btn hm-btn-primary"
                  onClick={turnOn}
                  disabled={busy !== null}
                  aria-busy={busy === 'turn-on'}
                >
                  {strings.turnOn}
                </button>
              }
              hint={strings.turnOnHint}
            />
          </>
        )}

        {status?.state === 'signed_out' && (
          <>
            <SettingRow
              label={strings.account}
              icon={<AccountIcon />}
              value={
                <button
                  type="button"
                  className="hm-btn hm-btn-primary"
                  onClick={() => run('sign-in', () => client.send('signIn'))}
                  disabled={busy !== null}
                  aria-busy={busy === 'sign-in'}
                >
                  {strings.signIn}
                </button>
              }
            />
            <p className="hm-setting-row__hint">{strings.signInHint}</p>
          </>
        )}

        {status?.state === 'signed_in' && (
          <>
            <SettingRow
              label={strings.account}
              icon={<AccountIcon />}
              value={
                <span className="hm-teams-account">
                  {status.me && <bdi>{status.me.user.email}</bdi>}
                  <button
                    type="button"
                    className="hm-btn hm-btn-ghost"
                    onClick={() => run('sign-out', () => client.send('signOut'))}
                    disabled={busy !== null}
                    aria-busy={busy === 'sign-out'}
                  >
                    {strings.signOut}
                  </button>
                </span>
              }
            />
            {status.me && (
              <>
                <SettingRow
                  label={strings.plan}
                  icon={<PlanIcon />}
                  value={
                    status.me.entitlement.state === 'active' && status.me.entitlement.until
                      ? strings.planActive(formatDate(status.me.entitlement.until, lang))
                      : strings.planNone
                  }
                />
                <SettingRow
                  label={strings.yourTeams}
                  icon={<TeamIcon />}
                  value={strings.memberOf(status.me.teams.length)}
                />
              </>
            )}
          </>
        )}
      </div>

      {(status?.state === 'signed_in' || status?.state === 'signed_out') && (
        <button
          type="button"
          className="hm-link hm-section__after"
          onClick={turnOff}
          disabled={busy !== null}
        >
          {strings.turnOff}
        </button>
      )}

      {notice && <InlineError>{notice}</InlineError>}
    </Section>
  );
}
